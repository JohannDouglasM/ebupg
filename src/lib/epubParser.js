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

      // Get chapter title from h1, h2, or title element
      const titleEl = doc.querySelector('h1, h2, title')
      const chapterTitle = titleEl?.textContent?.trim() || `Chapter ${chapters.length + 1}`

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
