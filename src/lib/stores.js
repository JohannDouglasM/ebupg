import { writable, derived, get } from 'svelte/store'

// Normalize text to use only keyboard-typeable characters
function normalizeText(text) {
  return text
    // Curly/smart double quotes → straight double quote
    .replace(/[""„«»]/g, '"')
    // Curly/smart single quotes/apostrophes → straight apostrophe
    .replace(/[''‹›]/g, "'")
    // Em dash, en dash → hyphen
    .replace(/[—–]/g, '-')
    // Ellipsis character → three periods
    .replace(/…/g, '...')
    // Non-breaking space and other Unicode spaces → regular space
    .replace(/[\u00A0\u2000-\u200A\u202F\u205F]/g, ' ')
    // Multiplication sign → x
    .replace(/×/g, 'x')
    // Prime marks → quotes
    .replace(/′/g, "'")
    .replace(/″/g, '"')
    // Paragraph breaks (2+ newlines) → ¶ (requires Enter to type)
    .replace(/\n\s*\n+/g, '¶')
    // Single newlines → space (they're just line wrapping in the source)
    .replace(/\n/g, ' ')
    // Clean up multiple spaces
    .replace(/  +/g, ' ')
}

// Book data
export const bookTitle = writable('')
export const chapters = writable([])
export const currentChapterIndex = writable(0)

// Typing state
export const currentPosition = writable(0)
export const typedChars = writable([]) // Array of { char, correct: boolean, skipped?: boolean }
export const errorPositions = writable(new Set()) // Positions where errors occurred
export const startTime = writable(null)
export const isTyping = writable(false)
export const keystrokeHistory = writable([]) // Array of { timestamp, correct } for WPM calculation
export const lastSessionWpm = writable(null) // WPM from last typing session (after 2s pause)

// WPM Records - separate for strict and lenient modes
const MAX_VALID_WPM = 300 // Filter out glitched records
const savedRecords = JSON.parse(localStorage.getItem('typingGameRecords') || '{}')

function validateRecord(val) {
  return (val && val <= MAX_VALID_WPM) ? val : 0
}

export const wpmRecordsStrict = writable({
  best5s: validateRecord(savedRecords.strict?.best5s),
  best10s: validateRecord(savedRecords.strict?.best10s),
  best30s: validateRecord(savedRecords.strict?.best30s)
})

export const wpmRecordsLenient = writable({
  best5s: validateRecord(savedRecords.lenient?.best5s),
  best10s: validateRecord(savedRecords.lenient?.best10s),
  best30s: validateRecord(savedRecords.lenient?.best30s)
})

// Save records whenever they change
function saveAllRecords() {
  localStorage.setItem('typingGameRecords', JSON.stringify({
    strict: get(wpmRecordsStrict),
    lenient: get(wpmRecordsLenient)
  }))
}

wpmRecordsStrict.subscribe(saveAllRecords)
wpmRecordsLenient.subscribe(saveAllRecords)

// Settings
const savedStrictMode = typeof localStorage !== 'undefined' ? localStorage.getItem('typingGameStrictMode') : null
export const strictMode = writable(savedStrictMode !== null ? savedStrictMode === 'true' : false) // default to lenient
export const theme = writable(localStorage.getItem('typingGameTheme') || 'cozy')

// Save strict mode preference
strictMode.subscribe(s => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('typingGameStrictMode', String(s))
  }
})

// Current mode's WPM records (switches automatically with strictMode)
export const wpmRecords = derived(
  [strictMode, wpmRecordsStrict, wpmRecordsLenient],
  ([$strict, $strictRecords, $lenientRecords]) => $strict ? $strictRecords : $lenientRecords
)

// Save theme preference
theme.subscribe(t => {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('typingGameTheme', t)
  }
})

// Current chapter text
export const currentChapterText = derived(
  [chapters, currentChapterIndex],
  ([$chapters, $index]) => $chapters[$index]?.content || ''
)

export const currentChapterTitle = derived(
  [chapters, currentChapterIndex],
  ([$chapters, $index]) => $chapters[$index]?.title || ''
)

// Calculate WPM for a given time window from keystroke history
function calculateWpmForWindow(history, windowMs, startTime, minKeystrokes = 12) {
  if (!startTime) return 0

  // Only calculate if the full window time has passed
  const typingDuration = Date.now() - startTime
  if (typingDuration < windowMs) return 0

  const now = Date.now()
  const windowStart = now - windowMs
  const recentStrokes = history.filter(k => k.timestamp >= windowStart)
  const correctStrokes = recentStrokes.filter(k => k.correct).length
  if (correctStrokes < minKeystrokes) return 0

  // Use the full window duration for calculation
  const elapsed = windowMs / 1000 / 60 // minutes

  return Math.round((correctStrokes / 5) / elapsed)
}

// Stats
export const stats = derived(
  [startTime, keystrokeHistory],
  ([$startTime, $history]) => {
    if (!$startTime || $history.length === 0) {
      return { wpm: 0, accuracy: 100, wpm5s: 0, wpm10s: 0, wpm30s: 0 }
    }

    const correctCount = $history.filter(k => k.correct).length
    const accuracy = Math.round((correctCount / $history.length) * 100)

    return {
      wpm: calculateWpmForWindow($history, 4000, $startTime, 5),
      accuracy,
      wpm5s: calculateWpmForWindow($history, 5000, $startTime),
      wpm10s: calculateWpmForWindow($history, 10000, $startTime),
      wpm30s: calculateWpmForWindow($history, 30000, $startTime)
    }
  }
)

// Progress
export const progress = derived(
  [currentPosition, currentChapterText, currentChapterIndex, chapters],
  ([$pos, $text, $chapterIndex, $chapters]) => {
    const chapterProgress = $text.length > 0 ? Math.round(($pos / $text.length) * 100) : 0
    const totalChapters = $chapters.length
    return {
      chapter: $chapterIndex + 1,
      totalChapters,
      chapterProgress
    }
  }
)

// Reset typing state for new chapter
export function resetTypingState() {
  currentPosition.set(0)
  typedChars.set([])
  errorPositions.set(new Set())
  startTime.set(null)
  isTyping.set(false)
  keystrokeHistory.set([])
  lastSessionWpm.set(null)
}

// Calculate and store last session WPM (call this 2s after typing stops)
export function calculateLastSessionWpm() {
  const history = get(keystrokeHistory)
  if (history.length < 5) return lastSessionWpm.set(null)

  // Find the last "session" - keystrokes with < 2s gaps between them
  let sessionStart = history.length - 1
  for (let i = history.length - 1; i > 0; i--) {
    if (history[i].timestamp - history[i - 1].timestamp > 2000) break
    sessionStart = i - 1
  }

  const session = history.slice(sessionStart)
  if (session.length < 5) return lastSessionWpm.set(null)

  const correctCount = session.filter(k => k.correct).length
  const elapsed = (session[session.length - 1].timestamp - session[0].timestamp) / 1000 / 60

  if (elapsed <= 0) return lastSessionWpm.set(null)

  const wpm = Math.round((correctCount / 5) / elapsed)
  lastSessionWpm.set(wpm > 300 ? null : wpm)
}

// Record a keystroke for WPM tracking
export function recordKeystroke(correct) {
  keystrokeHistory.update(h => [...h, { timestamp: Date.now(), correct }])
}

// Get the WPM records store for current mode
function getCurrentRecordsStore() {
  return get(strictMode) ? wpmRecordsStrict : wpmRecordsLenient
}

// Update WPM records if current rolling WPM is higher (capped at 300)
export function updateWpmRecords(wpm5s, wpm10s, wpm30s) {
  const cap = v => Math.min(v, 300)
  getCurrentRecordsStore().update(r => ({
    best5s: Math.max(r.best5s, cap(wpm5s)),
    best10s: Math.max(r.best10s, cap(wpm10s)),
    best30s: Math.max(r.best30s, cap(wpm30s))
  }))
}

// Reset WPM records for current mode
export function resetWpmRecords() {
  getCurrentRecordsStore().set({ best5s: 0, best10s: 0, best30s: 0 })
}

// Save book data to localStorage for persistence across refreshes
function saveBookData(title, normalizedChapters, hash) {
  try {
    localStorage.setItem('typingGameBook', JSON.stringify({
      title,
      chapters: normalizedChapters,
      hash
    }))
  } catch (e) {
    console.warn('Could not save book to localStorage (may be too large):', e)
  }
}

// Restore book from localStorage on page load
export function restoreBook() {
  try {
    const saved = localStorage.getItem('typingGameBook')
    if (!saved) return false

    const { title, chapters: savedChapters, hash } = JSON.parse(saved)
    if (!title || !savedChapters?.length) return false

    bookTitle.set(title)
    chapters.set(savedChapters)
    setBookHash(hash)

    const progress = loadProgressForBook(hash)
    if (progress) {
      const chapterIdx = progress.lastChapter || 0
      currentChapterIndex.set(chapterIdx)
      const chapterText = savedChapters[chapterIdx]?.content || ''
      restoreChapterProgress(progress.chapters?.[chapterIdx], chapterText)
    } else {
      currentChapterIndex.set(0)
      resetTypingState()
    }

    return true
  } catch (e) {
    console.warn('Could not restore book from localStorage:', e)
    return false
  }
}

// Load book with automatic progress restoration
// Detect if a chapter is likely front matter (credits, copyright, etc.)
function isFrontMatter(chapter) {
  const title = chapter.title.toLowerCase().trim()
  const content = chapter.content.toLowerCase()

  // Skip based on exact or near-exact title matches
  const skipExact = [
    'cover', 'copyright', 'rights', 'license', 'legal notice',
    'table of contents', 'contents', 'toc',
    'dedication', 'epigraph', 'frontispiece',
    'preface', 'foreword', 'prologue',
    'acknowledgments', 'acknowledgements',
    'about the author', 'front matter', 'title page'
  ]

  for (const skip of skipExact) {
    if (title === skip || title === `the ${skip}`) return true
  }

  // Skip very short sections (likely title pages, etc.)
  if (chapter.content.length < 300) return true

  // Skip if content looks like copyright notice
  if (content.includes('public domain') ||
      content.includes('project gutenberg') ||
      content.includes('all rights reserved') ||
      content.includes('copyright ©')) {
    return true
  }

  return false
}

// Find the first chapter that looks like actual book content
function findStartingChapter(chapterList) {
  for (let i = 0; i < chapterList.length; i++) {
    if (!isFrontMatter(chapterList[i])) {
      return i
    }
  }
  // If all chapters look like front matter, just start at 0
  return 0
}

export function loadBook(title, chapterList) {
  // Normalize all chapter content to use keyboard-typeable characters
  const normalizedChapters = chapterList.map(ch => ({
    ...ch,
    content: normalizeText(ch.content)
  }))

  bookTitle.set(title)
  chapters.set(normalizedChapters)

  // Generate hash and check for saved progress
  const hash = generateBookHash(chapterList)
  setBookHash(hash)

  // Save book data for persistence across refreshes
  saveBookData(title, normalizedChapters, hash)

  const saved = loadProgressForBook(hash)
  if (saved) {
    const chapterIdx = saved.lastChapter || 0
    currentChapterIndex.set(chapterIdx)
    const chapterText = normalizedChapters[chapterIdx]?.content || ''
    restoreChapterProgress(saved.chapters?.[chapterIdx], chapterText)
  } else {
    // Find first real chapter (skip front matter)
    const startIdx = findStartingChapter(normalizedChapters)
    currentChapterIndex.set(startIdx)
    resetTypingState()
  }
}

// Navigate to a different chapter
function goToChapter(newIdx) {
  saveProgress()
  const chapterList = get(chapters)
  if (newIdx < 0 || newIdx >= chapterList.length) return

  currentChapterIndex.set(newIdx)
  const saved = loadProgressForBook(currentBookHash)
  restoreChapterProgress(saved?.chapters?.[newIdx], chapterList[newIdx]?.content || '')
}

export function nextChapter() {
  goToChapter(get(currentChapterIndex) + 1)
}

export function prevChapter() {
  goToChapter(get(currentChapterIndex) - 1)
}

// Current book hash for identifying saved progress
let currentBookHash = null

// Generate a simple hash from content
function hashContent(content) {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  return hash.toString(16)
}

// Generate hash for entire book
export function generateBookHash(chapterList) {
  const fullText = chapterList.map(c => c.title + c.content).join('')
  return hashContent(fullText)
}

// Get all saved progress from localStorage
function getAllProgress() {
  return JSON.parse(localStorage.getItem('typingGameProgress') || '{}')
}

// Save all progress to localStorage
function setAllProgress(data) {
  localStorage.setItem('typingGameProgress', JSON.stringify(data))
}

// Save progress for current chapter (auto-save by book hash + chapter)
export function saveProgress() {
  if (!currentBookHash) return

  const chapterIdx = get(currentChapterIndex)
  const allProgress = getAllProgress()

  if (!allProgress[currentBookHash]) {
    allProgress[currentBookHash] = { lastChapter: chapterIdx, chapters: {} }
  }

  allProgress[currentBookHash].lastChapter = chapterIdx
  allProgress[currentBookHash].chapters[chapterIdx] = {
    position: get(currentPosition),
    typedChars: get(typedChars),
    errorPositions: [...get(errorPositions)]
  }

  setAllProgress(allProgress)
}

// Load book progress data
export function loadProgressForBook(hash) {
  const allProgress = getAllProgress()
  return allProgress[hash] || null
}

// Restore chapter progress from saved data
function restoreChapterProgress(chapterData, chapterText) {
  if (!chapterData) {
    resetTypingState()
    return
  }

  const preFilled = []
  for (let i = 0; i < chapterData.position && i < chapterText.length; i++) {
    if (chapterData.typedChars && chapterData.typedChars[i]) {
      // Mark as restored from previous session
      preFilled.push({ ...chapterData.typedChars[i], restored: true })
    } else {
      preFilled.push({ char: chapterText[i], correct: true, restored: true })
    }
  }

  typedChars.set(preFilled)
  currentPosition.set(chapterData.position)
  errorPositions.set(new Set(chapterData.errorPositions || []))
  startTime.set(null)
  isTyping.set(false)
}

// Set the current book hash
export function setBookHash(hash) {
  currentBookHash = hash
}

// Close current book and clear saved book data
export function closeBook() {
  saveProgress() // Save progress before closing
  bookTitle.set('')
  chapters.set([])
  currentChapterIndex.set(0)
  resetTypingState()
  currentBookHash = null
  localStorage.removeItem('typingGameBook')
}
