<script>
  import FileUpload from './components/FileUpload.svelte'
  import TypingGame from './components/TypingGame.svelte'
  import Stats from './components/Stats.svelte'
  import Settings from './components/Settings.svelte'
  import { chapters, bookTitle, currentChapterTitle, theme, restoreBook, closeBook } from './lib/stores.js'

  // Try to restore previously loaded book on page load
  restoreBook()

  let hasBook = $derived($chapters.length > 0)
  let currentTheme = $derived($theme)

  // Apply theme class to body for full-width background
  $effect(() => {
    document.body.className = currentTheme
  })
</script>

<main class={currentTheme}>
  <header>
    <h1>EPUBG</h1>
    {#if hasBook}
      <div class="book-info">
        <p class="book-title">Reading: {$bookTitle}{$currentChapterTitle ? ` — ${$currentChapterTitle}` : ''}</p>
        <button class="close-book" onclick={closeBook} title="Close book and choose another">×</button>
      </div>
    {/if}
  </header>

  {#if !hasBook}
    <FileUpload />
  {:else}
    <div class="game-container">
      <div class="top-bar">
        <Stats />
        <Settings />
      </div>
      <TypingGame />
    </div>
  {/if}
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(body) {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
    transition: background-color 0.3s, color 0.3s;
  }

  :global(body.cozy) {
    background: #d8ccca;
  }

  :global(body.cyberpunk) {
    background: #050508;
  }

  /* Cozy Theme - Pleasant warm tones */
  main.cozy {
    --bg-primary: #d8ccca;
    --bg-secondary: #ebe4e2;
    --bg-card: #f5f0ef;
    --text-primary: #3d3533;
    --text-secondary: #6b5f5c;
    --text-muted: #8a7e7b;
    --border: #c4b5b2;
    --accent: #a67c6d;
    --accent-hover: #8b6355;
    --correct: #3d3533;
    --corrected: #9c6644;
    --corrected-bg: #f0e6d3;
    --incorrect: #a63d3d;
    --incorrect-bg: #f5dede;
    --current-bg: #f5e6c8;
    --current-border: #a67c6d;
    --error-flash: #a63d3d;
    --pending: #a89e9b;
    --button-bg: #ebe4e2;
    --button-hover: #ddd5d3;
    --focus-ring: rgba(166, 124, 109, 0.3);
  }

  /* Cyberpunk Theme - Purple/blue neon */
  main.cyberpunk {
    --bg-primary: #050508;
    --bg-secondary: #0a0a12;
    --bg-card: #0d0d18;
    --text-primary: #e8e8f0;
    --text-secondary: #9090a0;
    --text-muted: #606070;
    --border: #2a2a4a;
    --accent: #a855f7;
    --accent-hover: #9333ea;
    --accent-secondary: #3b82f6;
    --correct: #c4b5fd;
    --corrected: #f472b6;
    --corrected-bg: rgba(244, 114, 182, 0.15);
    --incorrect: #ef4444;
    --incorrect-bg: rgba(239, 68, 68, 0.2);
    --current-bg: rgba(168, 85, 247, 0.2);
    --current-border: #a855f7;
    --error-flash: #ef4444;
    --pending: #707090;
    --button-bg: #12121f;
    --button-hover: #1a1a2e;
    --focus-ring: rgba(168, 85, 247, 0.4);
  }

  main {
    max-width: 1200px;
    margin: 0 auto;
    padding: 24px;
    min-height: 100vh;
    color: var(--text-primary);
  }

  header {
    text-align: center;
    margin-bottom: 32px;
  }

  h1 {
    margin: 0 0 8px;
    color: var(--text-primary);
  }

  main.cyberpunk h1 {
    color: #a855f7;
    text-shadow:
      0 0 10px #a855f7,
      0 0 20px #a855f7,
      0 0 40px rgba(168, 85, 247, 0.5);
  }

  .book-info {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .book-title {
    margin: 0;
    color: var(--text-secondary);
    font-style: italic;
  }

  .close-book {
    background: var(--button-bg);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.2s, color 0.2s;
  }

  .close-book:hover {
    background: var(--button-hover);
    color: var(--text-primary);
  }

  .game-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .top-bar {
    display: flex;
    align-items: flex-start;
    gap: 16px;
  }

  .top-bar :global(.stats) {
    flex: 1;
  }

  .top-bar :global(.settings) {
    flex-shrink: 0;
  }

  @media (max-width: 768px) {
    .top-bar {
      flex-direction: column;
    }

    .top-bar :global(.settings) {
      width: 100%;
    }
  }
</style>
