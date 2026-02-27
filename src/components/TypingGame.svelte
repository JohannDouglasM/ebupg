<script>
  import {
    currentChapterText,
    currentChapterTitle,
    currentPosition,
    typedChars,
    errorPositions,
    startTime,
    isTyping,
    strictMode,
    nextChapter,
    prevChapter,
    chapters,
    currentChapterIndex,
    saveProgress,
    recordKeystroke,
    updateWpmRecords,
    stats,
    keystrokeHistory,
    lastSessionWpm,
    calculateLastSessionWpm,
    isAccentMatch
  } from '../lib/stores.js'
  import { onMount } from 'svelte'

  let textContainer = $state(null)
  let hiddenInput = $state(null)
  let isComposing = $state(false)
  let showError = $state(false)
  let scrollPending = $state(false)
  let sessionTimeout = $state(null)

  // Get current values from stores
  let text = $derived($currentChapterText)
  let position = $derived($currentPosition)
  let typed = $derived($typedChars)
  let errors = $derived($errorPositions)
  let strict = $derived($strictMode)
  let chapterIndex = $derived($currentChapterIndex)
  let allChapters = $derived($chapters)
  let currentStats = $derived($stats)

  // Show overlay only when user actively types the last character
  let showCompleteOverlay = $state(false)
  let isChapterComplete = $derived(showCompleteOverlay)

  // Windowed rendering with scroll-based expansion
  const WINDOW_SIZE = 2000
  const SCROLL_LOAD_SIZE = 500
  let viewStart = $state(0)
  let viewEnd = $state(WINDOW_SIZE)
  let lastChapterIndex = $state(-1)

  // Reset view window when chapter changes - always start at beginning
  $effect(() => {
    if (chapterIndex !== lastChapterIndex) {
      lastChapterIndex = chapterIndex
      viewStart = 0
      viewEnd = Math.min(text.length || WINDOW_SIZE, WINDOW_SIZE)
      // Scroll to top when chapter changes
      if (textContainer) {
        textContainer.scrollTop = 0
      }
    }
  })

  // Keep view window around current position
  $effect(() => {
    // Position is before visible area - move window back
    if (position < viewStart + 100) {
      viewStart = Math.max(0, position - WINDOW_SIZE)
    }
    // Position is after visible area - move window forward
    if (position > viewEnd - 100) {
      viewEnd = Math.min(text.length, position + WINDOW_SIZE)
      // Also move viewStart forward if position jumped way ahead (e.g. restored progress)
      if (position > viewStart + WINDOW_SIZE * 2) {
        viewStart = Math.max(0, position - WINDOW_SIZE)
      }
    }
  })

  function handleScroll() {
    if (!textContainer) return
    const { scrollTop, scrollHeight, clientHeight } = textContainer

    // Load more at bottom
    if (scrollTop + clientHeight >= scrollHeight - 200) {
      if (viewEnd < text.length) {
        viewEnd = Math.min(text.length, viewEnd + SCROLL_LOAD_SIZE)
      }
    }

    // Load more at top
    if (scrollTop <= 200) {
      if (viewStart > 0) {
        viewStart = Math.max(0, viewStart - SCROLL_LOAD_SIZE)
      }
    }
  }

  function handleKeydown(e) {
    // Ignore modifier keys and special keys
    if (e.ctrlKey || e.metaKey) return
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return

    // Let dead keys and composing events through so accent composition works
    if (e.key === 'Dead' || e.isComposing) return

    if (e.key === 'Backspace') {
      e.preventDefault()
      if (!$isTyping) {
        startTime.set(Date.now())
        isTyping.set(true)
      }
      if (typed.length > 0) {
        currentPosition.update(p => p - 1)
        typedChars.update(t => t.slice(0, -1))
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()

      // If chapter complete, Enter dismisses overlay and goes to next chapter
      if (position >= text.length) {
        showCompleteOverlay = false
        if (chapterIndex < allChapters.length - 1) {
          goToNextChapter()
        }
        return
      }

      const currentChar = text[position]
      if (currentChar === '¶') {
        processChar('¶')
      } else if (strict) {
        showError = true
        setTimeout(() => showError = false, 150)
      }
      return
    }

    // All other character input flows into the hidden input's oninput handler
  }

  // Handles composed character input from the hidden input element
  function handleInput(e) {
    // Skip input events during composition (dead keys, IME)
    // The final result comes after compositionend
    if (isComposing) return

    const data = e.data
    if (!data) return

    // Clear the hidden input
    if (hiddenInput) hiddenInput.value = ''

    // Process each character (usually just one)
    for (const char of data) {
      if (position >= text.length) break

      const currentChar = text[position]
      // Skip Enter-requiring chars from regular input
      if (currentChar === '¶') {
        if (strict) {
          showError = true
          setTimeout(() => showError = false, 150)
        }
        continue
      }

      let typedKey = char
      // Normalize typed quote characters to match normalized text
      typedKey = typedKey
        .replace(/[\u201C\u201D\u201E\u00AB\u00BB\u2033]/g, '"')
        .replace(/[\u2018\u2019\u2039\u203A\u2032]/g, "'")
        .replace(/[—–]/g, '-')

      processChar(typedKey)
    }
  }

  function handleCompositionStart() {
    isComposing = true
  }

  function handleCompositionEnd(e) {
    isComposing = false
    // Process the composed result (e.g. é from ´+e)
    if (e.data) {
      if (hiddenInput) hiddenInput.value = ''
      for (const char of e.data) {
        if (position >= text.length) break
        const currentChar = text[position]
        if (currentChar === '¶') {
          if (strict) {
            showError = true
            setTimeout(() => showError = false, 150)
          }
          continue
        }
        let typedKey = char
        typedKey = typedKey
          .replace(/[\u201C\u201D\u201E\u00AB\u00BB\u2033]/g, '"')
          .replace(/[\u2018\u2019\u2039\u203A\u2032]/g, "'")
          .replace(/[—–]/g, '-')
        processChar(typedKey)
      }
    }
  }

  function processChar(typedKey) {
    if (!$isTyping) {
      startTime.set(Date.now())
      isTyping.set(true)
    }

    const currentChar = text[position]
    const isCorrect = typedKey === currentChar || isAccentMatch(typedKey, currentChar)
    console.log(`[typing] typed="${typedKey}" (U+${typedKey.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}) | expected="${currentChar}" (U+${currentChar.charCodeAt(0).toString(16).toUpperCase().padStart(4,'0')}) | match=${isCorrect}`)

    if (!isCorrect) {
      errorPositions.update(s => {
        const newSet = new Set(s)
        newSet.add(position)
        return newSet
      })

      if (strict) {
        showError = true
        setTimeout(() => showError = false, 150)
      }
    }

    recordKeystroke(isCorrect)
    lastSessionWpm.set(null)

    if (sessionTimeout) clearTimeout(sessionTimeout)
    sessionTimeout = setTimeout(() => {
      calculateLastSessionWpm()
    }, 2000)

    typedChars.update(t => [...t, { char: typedKey, correct: isCorrect, strictError: !isCorrect && strict }])
    currentPosition.update(p => p + 1)

    if (position + 1 >= text.length) {
      showCompleteOverlay = true
    }

    setTimeout(() => {
      updateWpmRecords(currentStats.wpm5s, currentStats.wpm10s, currentStats.wpm30s)
    }, 0)

    if (position % 50 === 0) {
      saveProgress()
    }

    scrollToPosition()
  }

  function scrollToPosition() {
    if (scrollPending) return
    scrollPending = true
    requestAnimationFrame(() => {
      scrollPending = false
      if (!textContainer) return
      const currentSpan = textContainer.querySelector('.current')
      if (currentSpan) {
        // Use instant scroll for better typing feel
        currentSpan.scrollIntoView({ behavior: 'instant', block: 'center' })
      }
    })
  }

  function goToNextChapter() {
    nextChapter()
  }

  function goToPrevChapter() {
    prevChapter()
  }

  function jumpToPosition(targetIndex) {
    // Sync typedChars length with target position
    // Fill with skipped markers so indices align
    typedChars.update(t => {
      if (targetIndex > t.length) {
        // Jumping forward - fill gap with skipped markers
        const skipped = []
        for (let i = t.length; i < targetIndex; i++) {
          skipped.push({ char: text[i], correct: true, skipped: true })
        }
        return [...t, ...skipped]
      } else if (targetIndex < t.length) {
        // Jumping backward - truncate
        return t.slice(0, targetIndex)
      }
      return t
    })
    currentPosition.set(targetIndex)

    // Reset timer and history for fresh start from new position
    startTime.set(null)
    isTyping.set(false)
    keystrokeHistory.set([])

    // Focus the container after jumping
    focusInput()
    saveProgress()
  }

  function focusInput() {
    hiddenInput?.focus()
  }

  function handleCharClick(e, index) {
    e.stopPropagation()
    jumpToPosition(index)
  }

  onMount(() => {
    // Focus the hidden input to capture keyboard events
    focusInput()

    // If restored from a previous session, scroll to the current position
    if (position > 0) {
      setTimeout(() => scrollToPosition(), 50)
    }

    // Global keydown listener to auto-focus hidden input
    function globalKeyHandler(e) {
      if (hiddenInput && document.activeElement !== hiddenInput) {
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter' || e.key === 'Dead') {
          focusInput()
        }
      }
    }

    window.addEventListener('keydown', globalKeyHandler)
    return () => window.removeEventListener('keydown', globalKeyHandler)
  })

  // Build character array with states - only for visible window
  let characters = $derived(() => {
    const result = []

    // In strict mode, find the first uncorrected error that was made in strict mode
    let firstUncorrectedError = -1
    if (strict) {
      for (let j = 0; j < typed.length; j++) {
        if (typed[j] && !typed[j].correct && typed[j].strictError) {
          firstUncorrectedError = j
          break
        }
      }
    }

    for (let i = viewStart; i < viewEnd; i++) {
      const char = text[i]
      let state = 'pending'
      if (i < position) {
        const typedEntry = typed[i]
        if (!typedEntry) {
          // No entry means this position was skipped
          state = 'skipped'
        } else if (strict && firstUncorrectedError >= 0 && i >= firstUncorrectedError) {
          // In strict mode, everything from first uncorrected error onwards is red
          state = 'incorrect'
        } else if (typedEntry.correct) {
          if (errors.has(i)) {
            // Corrected chars from previous session look like normal correct text
            state = typedEntry.restored ? 'correct' : 'corrected'
          } else {
            state = 'correct'
          }
        } else {
          state = 'incorrect'
        }
      } else if (i === position) {
        state = showError ? 'error-flash' : 'current'
      }
      result.push({ char, state, index: i })
    }
    return result
  })
</script>

<div class="typing-game">
  <div class="chapter-nav">
    <button onclick={goToPrevChapter} disabled={chapterIndex === 0}>
      Previous
    </button>
    <h2 class="chapter-title">{$currentChapterTitle}</h2>
    <button onclick={goToNextChapter} disabled={chapterIndex >= allChapters.length - 1}>
      Next
    </button>
  </div>

  {#if isChapterComplete}
    <div class="complete-overlay">
      <div class="complete-message">
        <h3>Chapter Complete!</h3>
        {#if chapterIndex < allChapters.length - 1}
          <button onclick={() => { showCompleteOverlay = false; goToNextChapter() }}>Continue to Next Chapter</button>
        {:else}
          <p>You've finished the entire book!</p>
        {/if}
      </div>
    </div>
  {/if}

  <!-- Hidden input captures composed character input (dead keys, accents) -->
  <input
    bind:this={hiddenInput}
    class="hidden-input"
    oninput={handleInput}
    onkeydown={handleKeydown}
    oncompositionstart={handleCompositionStart}
    oncompositionend={handleCompositionEnd}
    autocomplete="off"
    autocorrect="off"
    autocapitalize="off"
    spellcheck="false"
    aria-label="Typing input"
  />

  <div
    class="text-container"
    bind:this={textContainer}
    tabindex="-1"
    role="textbox"
    aria-label="Typing area - type the text shown"
    aria-multiline="true"
    onclick={focusInput}
    onkeydown={focusInput}
    onscroll={handleScroll}
  >
    {#if viewStart > 0}<span class="ellipsis">...</span>{/if}
    {#each characters() as { char, state, index } (index)}
      <span
        class="{state} clickable"
        role="button"
        tabindex="-1"
        onclick={(e) => handleCharClick(e, index)}
        onkeydown={(e) => e.key === 'Enter' && handleCharClick(e, index)}
      >{char === '¶' ? '¶\n' : char}</span>
    {/each}
    {#if viewEnd < text.length}<span class="ellipsis">...</span>{/if}
    <div class="scroll-padding"></div>
  </div>

  <p class="hint">
    {#if strict}
      Press backspace to fix errors · Press Enter at ¶ for new paragraph
    {:else}
      Errors are highlighted but you can continue typing · Press Enter at ¶
    {/if}
  </p>
</div>

<style>
  .hidden-input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
    width: 0;
    height: 0;
  }

  .typing-game {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .chapter-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }

  .chapter-nav button {
    padding: 8px 16px;
    background: var(--button-bg);
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    color: var(--text-primary);
    transition: background 0.2s;
  }

  .chapter-nav button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chapter-nav button:not(:disabled):hover {
    background: var(--button-hover);
  }

  :global(main.cyberpunk) .chapter-nav button {
    border-color: #3b3b5c;
  }

  :global(main.cyberpunk) .chapter-nav button:not(:disabled):hover {
    border-color: var(--accent);
    box-shadow: 0 0 10px rgba(168, 85, 247, 0.3);
  }

  .chapter-title {
    margin: 0;
    font-size: 18px;
    color: var(--text-primary);
    text-align: center;
    flex: 1;
  }

  .text-container {
    font-family: 'Consolas', 'Monaco', monospace;
    font-size: 18px;
    line-height: 1.8;
    padding: 24px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    max-height: 400px;
    overflow-y: auto;
    outline: none;
    white-space: pre-wrap;
    word-wrap: break-word;
    color: var(--text-primary);
  }

  .typing-game:has(.hidden-input:focus) .text-container {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  :global(main.cyberpunk) .text-container {
    border-color: #3b3b5c;
    box-shadow: 0 0 30px rgba(168, 85, 247, 0.15), inset 0 0 50px rgba(168, 85, 247, 0.02);
  }

  :global(main.cyberpunk) .typing-game:has(.hidden-input:focus) .text-container {
    border-color: var(--accent);
    box-shadow: 0 0 15px var(--accent), 0 0 40px rgba(168, 85, 247, 0.3), inset 0 0 30px rgba(168, 85, 247, 0.03);
  }

  .ellipsis {
    color: var(--text-muted);
    user-select: none;
  }

  .scroll-padding {
    height: 150px;
  }

  .clickable {
    cursor: pointer;
  }

  .clickable:hover {
    background: var(--button-hover);
    border-radius: 2px;
  }

  .pending {
    color: var(--pending);
  }

  .skipped {
    color: var(--text-muted);
    opacity: 0.6;
  }

  .current {
    background: var(--current-bg);
    color: var(--text-primary);
    border-bottom: 2px solid var(--current-border);
  }

  :global(main.cyberpunk) .current {
    text-shadow: 0 0 10px var(--accent), 0 0 20px var(--accent);
  }

  .correct {
    color: var(--correct);
  }

  :global(main.cyberpunk) .correct {
    text-shadow: 0 0 1px rgba(196, 181, 253, 0.5);
  }

  .corrected {
    color: var(--corrected);
    background: var(--corrected-bg);
  }

  :global(main.cyberpunk) .corrected {
    text-shadow: 0 0 8px var(--corrected);
  }

  .incorrect {
    background: var(--incorrect-bg);
    color: var(--incorrect);
    text-decoration: underline;
  }

  .error-flash {
    background: var(--error-flash);
    color: white;
    border-bottom: 2px solid var(--error-flash);
  }

  :global(main.cyberpunk) .error-flash {
    box-shadow: 0 0 10px var(--error-flash);
  }

  .hint {
    text-align: center;
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0;
  }

  .complete-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .complete-message {
    background: var(--bg-card);
    padding: 32px 48px;
    border-radius: 12px;
    text-align: center;
    border: 1px solid var(--border);
  }

  :global(main.cyberpunk) .complete-message {
    border-color: var(--accent);
    box-shadow: 0 0 30px var(--accent), inset 0 0 30px rgba(168, 85, 247, 0.05);
  }

  .complete-message h3 {
    margin: 0 0 16px;
    color: var(--accent);
  }

  .complete-message button {
    padding: 12px 24px;
    background: var(--accent);
    color: var(--bg-primary);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: background 0.2s;
  }

  .complete-message button:hover {
    background: var(--accent-hover);
  }

  :global(main.cyberpunk) .complete-message button {
    box-shadow: 0 0 10px var(--accent);
  }
</style>
