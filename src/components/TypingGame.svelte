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
    calculateLastSessionWpm
  } from '../lib/stores.js'
  import { onMount } from 'svelte'

  let textContainer = $state(null)
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
    if (e.ctrlKey || e.metaKey || e.altKey) return
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) return

    // Prevent default to avoid scrolling, etc
    e.preventDefault()

    // Start timer on first keypress
    if (!$isTyping) {
      startTime.set(Date.now())
      isTyping.set(true)
    }

    if (e.key === 'Backspace') {
      if (typed.length > 0) {
        currentPosition.update(p => p - 1)
        typedChars.update(t => t.slice(0, -1))
      }
      return
    }

    // If chapter complete, Enter dismisses overlay and goes to next chapter
    if (position >= text.length) {
      if (e.key === 'Enter') {
        showCompleteOverlay = false
        if (chapterIndex < allChapters.length - 1) {
          goToNextChapter()
        }
      }
      return
    }

    const currentChar = text[position]

    // Handle paragraph marker (¶) - requires Enter
    let typedKey
    if (currentChar === '¶') {
      if (e.key !== 'Enter') {
        // Wrong key for paragraph - show error
        if (strict) {
          showError = true
          setTimeout(() => showError = false, 150)
        }
        return
      }
      typedKey = '¶'
    } else {
      // Ignore Enter for non-paragraph characters
      if (e.key === 'Enter') return
      // Only accept single characters
      if (e.key.length !== 1) return
      typedKey = e.key
      // Normalize typed quote characters to match normalized text
      // (handles macOS smart quotes, international keyboards, etc.)
      typedKey = typedKey
        .replace(/[""„«»″]/g, '"')
        .replace(/[''‹›′]/g, "'")
        .replace(/[—–]/g, '-')
    }

    const isCorrect = typedKey === currentChar

    if (!isCorrect) {
      // Mark this position as having an error
      errorPositions.update(s => {
        const newSet = new Set(s)
        newSet.add(position)
        return newSet
      })

      if (strict) {
        showError = true
        setTimeout(() => showError = false, 150)
        // Don't return - let typing continue but show as error
      }
    }

    // Record keystroke for WPM tracking
    recordKeystroke(isCorrect)

    // Clear last session WPM when typing resumes
    lastSessionWpm.set(null)

    // Reset session timeout - calculate last session WPM after 2s of no typing
    if (sessionTimeout) clearTimeout(sessionTimeout)
    sessionTimeout = setTimeout(() => {
      calculateLastSessionWpm()
    }, 2000)

    // Record the keystroke and advance position
    // Track if error was made in strict mode (for red cascade effect)
    typedChars.update(t => [...t, { char: typedKey, correct: isCorrect, strictError: !isCorrect && strict }])
    currentPosition.update(p => p + 1)

    // Show chapter complete overlay when typing the last character
    if (position + 1 >= text.length) {
      showCompleteOverlay = true
    }

    // Update WPM records (use setTimeout to get updated stats after keystroke)
    setTimeout(() => {
      updateWpmRecords(currentStats.wpm5s, currentStats.wpm10s, currentStats.wpm30s)
    }, 0)

    // Save progress periodically
    if (position % 50 === 0) {
      saveProgress()
    }

    // Scroll to keep current position visible
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
    textContainer?.focus()
    saveProgress()
  }

  function handleCharClick(e, index) {
    e.stopPropagation()
    jumpToPosition(index)
  }

  onMount(() => {
    // Focus the container to capture keyboard events
    textContainer?.focus()

    // If restored from a previous session, scroll to the current position
    if (position > 0) {
      // Use setTimeout to ensure the DOM has rendered the characters
      setTimeout(() => scrollToPosition(), 50)
    }

    // Global keydown listener to auto-focus text container
    function globalKeyHandler(e) {
      // If typing a character and text container exists but isn't focused
      if (textContainer && document.activeElement !== textContainer) {
        // Only for printable characters, backspace, or enter
        if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Enter') {
          textContainer.focus()
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

  <div
    class="text-container"
    bind:this={textContainer}
    tabindex="0"
    role="textbox"
    aria-label="Typing area - type the text shown"
    aria-multiline="true"
    onkeydown={handleKeydown}
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

  .text-container:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--focus-ring);
  }

  :global(main.cyberpunk) .text-container {
    border-color: #3b3b5c;
    box-shadow: 0 0 30px rgba(168, 85, 247, 0.15), inset 0 0 50px rgba(168, 85, 247, 0.02);
  }

  :global(main.cyberpunk) .text-container:focus {
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
