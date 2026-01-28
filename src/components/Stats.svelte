<script>
  import { stats, progress, wpmRecords, resetWpmRecords, lastSessionWpm } from '../lib/stores.js'
  import { onMount } from 'svelte'

  let confirmReset = $state(false)
  let resetBtn = $state(null)

  function handleReset(e) {
    e.stopPropagation()
    if (confirmReset) {
      resetWpmRecords()
      confirmReset = false
    } else {
      confirmReset = true
    }
  }

  function handleClickOutside(e) {
    if (confirmReset && resetBtn && !resetBtn.contains(e.target)) {
      confirmReset = false
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  })
</script>

<div class="stats">
  <div class="stat-group">
    <div class="stat">
      {#if $lastSessionWpm !== null}
        <span class="value session-wpm">{$lastSessionWpm < 31 ? '🐌' : $lastSessionWpm}</span>
      {:else}
        <span class="value">{$stats.wpm < 31 ? '🐌' : $stats.wpm}</span>
      {/if}
      <span class="label">WPM</span>
    </div>
    <div class="stat">
      <span class="value">{$stats.accuracy}%</span>
      <span class="label">Accuracy</span>
    </div>
    <div class="stat">
      <span class="value">{$progress.chapter}/{$progress.totalChapters}</span>
      <span class="label">Chapter</span>
    </div>
    <div class="stat">
      <span class="value">{$progress.chapterProgress}%</span>
      <span class="label">Progress</span>
    </div>
  </div>
  <div class="divider"></div>
  <div class="stat-group records">
    <div class="stat">
      <span class="value record">{$wpmRecords.best5s < 31 ? '🐌' : $wpmRecords.best5s}</span>
      <span class="label">Best 5s</span>
    </div>
    <div class="stat">
      <span class="value record">{$wpmRecords.best10s < 31 ? '🐌' : $wpmRecords.best10s}</span>
      <span class="label">Best 10s</span>
    </div>
    <div class="stat">
      <span class="value record">{$wpmRecords.best30s < 31 ? '🐌' : $wpmRecords.best30s}</span>
      <span class="label">Best 30s</span>
    </div>
    <button class="reset-btn" class:confirm={confirmReset} onclick={handleReset} bind:this={resetBtn}>
      {confirmReset ? 'Sure you want to reset your highscores?' : '×'}
    </button>
  </div>
</div>

<style>
  .stats {
    display: flex;
    gap: 16px;
    align-items: center;
    justify-content: flex-start;
    padding: 12px 20px;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
  }

  :global(main.cyberpunk) .stats {
    border-color: #3b3b5c;
    box-shadow: 0 0 20px rgba(168, 85, 247, 0.15);
  }

  .stat-group {
    display: flex;
    gap: 24px;
  }

  .records {
    gap: 16px;
  }

  .divider {
    width: 1px;
    height: 40px;
    background: var(--border);
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }

  .value {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .value.record {
    font-size: 16px;
    color: var(--text-secondary);
  }

  .value.session-wpm {
    color: var(--corrected);
  }

  :global(main.cyberpunk) .value {
    color: var(--accent);
    text-shadow: 0 0 10px var(--accent);
  }

  :global(main.cyberpunk) .value.record {
    color: var(--accent-secondary);
    text-shadow: 0 0 8px var(--accent-secondary);
  }

  :global(main.cyberpunk) .value.session-wpm {
    color: var(--corrected);
    text-shadow: 0 0 8px var(--corrected);
  }

  .label {
    font-size: 12px;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .records .label {
    font-size: 10px;
  }

  .reset-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    width: 20px;
    height: 20px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 12px;
    line-height: 1;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    align-self: center;
  }

  .reset-btn:hover {
    border-color: var(--text-secondary);
    color: var(--text-secondary);
  }

  .reset-btn.confirm {
    background: var(--incorrect);
    border-color: var(--incorrect);
    color: white;
    width: auto;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    white-space: nowrap;
  }
</style>
