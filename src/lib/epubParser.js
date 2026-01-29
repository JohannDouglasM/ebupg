import JSZip from 'jszip'

/**
 * Parse an EPUB file and extract chapter text in reading order.
 * @param {File} file - The EPUB file to parse
 * @returns {Promise<{title: string, chapters: Array<{title: string, content: string}>}>}
 */
export async function parseEpub(file) {
  const zip = await JSZip.loadAsync(file)

  // Read container.xml to find the OPF file location
  const containerXml = await zip.file('META-INF/container.xml')?.async('text')
  if (!containerXml) {
    throw new Error('Invalid EPUB: missing container.xml')
  }

  const parser = new DOMParser()
  const containerDoc = parser.parseFromString(containerXml, 'application/xml')
  const rootfileElement = containerDoc.querySelector('rootfile')
  const opfPath = rootfileElement?.getAttribute('full-path')

  if (!opfPath) {
    throw new Error('Invalid EPUB: cannot find OPF file path')
  }

  // Read the OPF file
  const opfContent = await zip.file(opfPath)?.async('text')
  if (!opfContent) {
    throw new Error('Invalid EPUB: cannot read OPF file')
  }

  const opfDoc = parser.parseFromString(opfContent, 'application/xml')
  const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : ''

  // Get book title
  const titleElement = opfDoc.querySelector('metadata title, dc\\:title')
  const bookTitle = titleElement?.textContent || 'Untitled'

  // Build manifest lookup (id -> href)
  const manifest = {}
  opfDoc.querySelectorAll('manifest item').forEach(item => {
    const id = item.getAttribute('id')
    const href = item.getAttribute('href')
    const mediaType = item.getAttribute('media-type')
    if (id && href) {
      manifest[id] = { href, mediaType }
    }
  })

  // Get spine (reading order)
  const spineItems = []
  opfDoc.querySelectorAll('spine itemref').forEach(itemref => {
    const idref = itemref.getAttribute('idref')
    if (idref && manifest[idref]) {
      spineItems.push(manifest[idref])
    }
  })

  // Build TOC map from NCX or nav document for better chapter titles
  const tocMap = await buildTocMap(opfDoc, manifest, opfDir, zip, parser)

  // Extract text from each spine item
  const chapters = []
  for (const item of spineItems) {
    // Only process HTML/XHTML content
    if (!item.mediaType?.includes('html') && !item.mediaType?.includes('xml')) {
      continue
    }

    const filePath = opfDir + item.href
    const content = await zip.file(filePath)?.async('text')

    if (content) {
      const doc = parser.parseFromString(content, 'application/xhtml+xml')

      const chapterTitle = findChapterTitle(doc, item.href, tocMap, chapters.length + 1, bookTitle)

      // Extract body text
      const body = doc.querySelector('body')
      const text = extractText(body)

      if (text.trim()) {
        chapters.push({
          title: chapterTitle,
          content: text.trim()
        })
      }
    }
  }

  return { title: bookTitle, chapters }
}

/**
 * Build a map of file hrefs to chapter titles from the EPUB's table of contents.
 * Tries NCX (EPUB2) and nav (EPUB3) formats.
 */
async function buildTocMap(opfDoc, manifest, opfDir, zip, parser) {
  const tocMap = {}

  // Try EPUB2 NCX file
  const spineEl = opfDoc.querySelector('spine')
  const tocId = spineEl?.getAttribute('toc')
  if (tocId && manifest[tocId]) {
    try {
      const ncxPath = opfDir + manifest[tocId].href
      const ncxContent = await zip.file(ncxPath)?.async('text')
      if (ncxContent) {
        const ncxDoc = parser.parseFromString(ncxContent, 'application/xml')
        ncxDoc.querySelectorAll('navPoint').forEach(navPoint => {
          const label = navPoint.querySelector('navLabel text')?.textContent?.trim()
          const src = navPoint.querySelector('content')?.getAttribute('src')
          if (label && src) {
            // Only store the first TOC entry per file (later entries are sub-sections)
            const baseHref = src.split('#')[0]
            if (!tocMap[baseHref]) {
              tocMap[baseHref] = label
            }
          }
        })
      }
    } catch (e) {
      // NCX parsing failed, continue
    }
  }

  // Try EPUB3 nav document
  for (const [id, item] of Object.entries(manifest)) {
    if (item.mediaType?.includes('html')) {
      try {
        const navPath = opfDir + item.href
        const navContent = await zip.file(navPath)?.async('text')
        if (navContent && navContent.includes('epub:type="toc"')) {
          const navDoc = parser.parseFromString(navContent, 'application/xhtml+xml')
          const tocNav = navDoc.querySelector('[epub\\:type="toc"], nav')
          if (tocNav) {
            tocNav.querySelectorAll('a').forEach(a => {
              const label = a.textContent?.trim()
              const href = a.getAttribute('href')
              if (label && href) {
                // Only store the first TOC entry per file
                const baseHref = href.split('#')[0]
                if (!tocMap[baseHref]) {
                  tocMap[baseHref] = label
                }
              }
            })
            if (Object.keys(tocMap).length > 0) break
          }
        }
      } catch (e) {
        // Nav parsing failed, continue
      }
    }
  }

  return tocMap
}

/**
 * Find the best chapter title using multiple strategies.
 */
function findChapterTitle(doc, href, tocMap, fallbackNum, bookTitle) {
  const isBookTitle = (text) => text.toLowerCase() === bookTitle?.toLowerCase()

  // 1. Check TOC map first (most reliable)
  const baseHref = href.split('#')[0]
  if (tocMap[baseHref] && !isBookTitle(tocMap[baseHref])) {
    return tocMap[baseHref]
  }

  // 2. Try heading elements (h1, h2, h3)
  for (const selector of ['h1', 'h2', 'h3']) {
    const el = doc.querySelector(selector)
    if (el) {
      const text = el.textContent?.trim()
      if (text && text.length < 200 && !isBookTitle(text)) return text
    }
  }

  // 3. Try elements with title/chapter class or id
  const titleEl = doc.querySelector(
    '[class*="title"], [class*="chapter"], [class*="heading"], ' +
    '[id*="title"], [id*="chapter"], [id*="heading"]'
  )
  if (titleEl) {
    const text = titleEl.textContent?.trim()
    if (text && text.length < 200 && !isBookTitle(text)) return text
  }

  // 4. Try <title> element, skip if it matches the book title
  const titleTag = doc.querySelector('title')
  if (titleTag) {
    const text = titleTag.textContent?.trim()
    if (text && text.length < 200 && !isBookTitle(text)) return text
  }

  // 5. Check first lines of body text for chapter patterns
  const body = doc.querySelector('body')
  if (body) {
    const bodyText = body.textContent?.trim()
    const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 0)

    // Look for "CHAPTER X" / "Chapter X" pattern, then use the next line as title
    if (lines.length > 0) {
      const chapterPattern = /^chapter\s+[\divxlc]+/i
      if (chapterPattern.test(lines[0]) && lines.length > 1 && lines[1].length < 80 && !lines[1].includes('.')) {
        return `${lines[0]} — ${lines[1]}`
      }
    }

    // Use first line if it looks like a title (short, no period, not book title)
    if (lines.length > 0) {
      const firstLine = lines[0]
      if (firstLine.length > 0 && firstLine.length < 80 && !firstLine.includes('.') && !isBookTitle(firstLine)) {
        return firstLine
      }
    }
  }

  return `Chapter ${fallbackNum}`
}

/**
 * Extract readable text from an HTML element, preserving paragraph structure.
 */
function extractText(element) {
  if (!element) return ''

  let text = ''

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase()

      // Skip non-content elements
      if (['script', 'style', 'nav', 'header', 'footer'].includes(tagName)) {
        continue
      }

      // Add spacing for block elements
      const isBlock = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'br'].includes(tagName)

      if (isBlock && text && !text.endsWith('\n')) {
        text += '\n\n'
      }

      text += extractText(node)

      if (isBlock && !text.endsWith('\n')) {
        text += '\n\n'
      }
    }
  }

  // Normalize whitespace: collapse multiple spaces/newlines
  return text.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
}
