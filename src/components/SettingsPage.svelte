<script>
  import { ACCENT_GROUPS, accentGroups, chapters, renormalizeBook } from '../lib/stores.js'

  let { onBack } = $props()

  let hasBook = $derived($chapters.length > 0)

  function toggle(key) {
    accentGroups.update(g => ({ ...g, [key]: !g[key] }))
    if (hasBook) renormalizeBook()
  }
</script>

<div class="settings-page">
  <button class="back-button" onclick={onBack}>&larr; Back</button>

  <h2>Accent Settings</h2>
  <p class="description">Choose which accent groups to type exactly. Disabled groups simplify accented characters to ASCII.</p>

  <div class="group-list">
    {#each Object.entries(ACCENT_GROUPS) as [key, group]}
      <div class="group-row">
        <div class="group-info">
          <span class="group-label">{group.label}</span>
          <span class="group-chars">{group.chars}</span>
        </div>
        <label class="toggle-row">
          <input type="checkbox" checked={$accentGroups[key]} onchange={() => toggle(key)} class="sr-only" />
          <span class="slider" class:active={$accentGroups[key]}></span>
        </label>
      </div>
    {/each}
  </div>
</div>

<style>
  .settings-page {
    max-width: 600px;
    margin: 0 auto;
  }

  .back-button {
    background: var(--button-bg);
    border: 1px solid var(--border);
    color: var(--text-secondary);
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: background 0.2s, color 0.2s;
  }

  .back-button:hover {
    background: var(--button-hover);
    color: var(--text-primary);
  }

  h2 {
    margin: 24px 0 8px;
    color: var(--text-primary);
  }

  .description {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 0 0 24px;
  }

  .group-list {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .group-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
  }

  .group-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .group-label {
    font-weight: 600;
    font-size: 14px;
    color: var(--text-primary);
  }

  .group-chars {
    font-size: 13px;
    color: var(--text-muted);
    letter-spacing: 1px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  .toggle-row {
    cursor: pointer;
    flex-shrink: 0;
  }

  .slider {
    position: relative;
    display: block;
    width: 36px;
    height: 20px;
    background: var(--border);
    border-radius: 10px;
    transition: background 0.2s;
  }

  .slider::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    background: var(--bg-card);
    border-radius: 50%;
    transition: transform 0.2s;
  }

  .slider.active {
    background: var(--accent);
  }

  .slider.active::after {
    transform: translateX(16px);
  }

  :global(main.cyberpunk) .group-row {
    border-color: #3b3b5c;
  }

  :global(main.cyberpunk) .slider.active {
    box-shadow: 0 0 10px var(--accent);
  }
</style>
