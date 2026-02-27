<script>
  import { ACCENT_GROUPS, accentGroups } from '../lib/stores.js'

  let { onBack } = $props()

  let expandedGroup = $state(null)

  // Master toggle: set all chars in a group on or off
  function toggleGroup(key) {
    const chars = $accentGroups[key]
    const allOn = Object.values(chars).every(v => v)
    const newVal = !allOn
    const updated = {}
    for (const ch of Object.keys(chars)) updated[ch] = newVal
    accentGroups.update(g => ({ ...g, [key]: updated }))
  }

  // Individual char toggle
  function toggleChar(groupKey, char) {
    accentGroups.update(g => ({
      ...g,
      [groupKey]: { ...g[groupKey], [char]: !g[groupKey][char] }
    }))
  }

  function toggleExpand(key) {
    expandedGroup = expandedGroup === key ? null : key
  }

  function groupState(chars) {
    const vals = Object.values(chars)
    const onCount = vals.filter(v => v).length
    if (onCount === vals.length) return 'all'
    if (onCount === 0) return 'none'
    return 'partial'
  }
</script>

<div class="settings-page">
  <button class="back-button" onclick={onBack}>&larr; Back</button>

  <h2>Accent Settings</h2>
  <p class="description">Toggle entire language groups or expand to control individual characters.</p>

  <div class="group-list">
    {#each Object.entries(ACCENT_GROUPS) as [key, group]}
      {@const chars = $accentGroups[key]}
      {@const state = groupState(chars)}
      {@const expanded = expandedGroup === key}
      <div class="group-card" class:expanded>
        <div class="group-header">
          <button class="expand-button" onclick={() => toggleExpand(key)} title={expanded ? 'Collapse' : 'Expand'}>
            <span class="chevron" class:open={expanded}>&#9656;</span>
          </button>
          <button class="group-info" onclick={() => toggleExpand(key)}>
            <span class="group-label">{group.label}</span>
            <span class="group-chars">{group.chars}</span>
          </button>
          <label class="toggle-row">
            <input type="checkbox" checked={state === 'all'} indeterminate={state === 'partial'} onchange={() => toggleGroup(key)} class="sr-only" />
            <span class="slider" class:active={state === 'all'} class:partial={state === 'partial'}></span>
          </label>
        </div>
        {#if expanded}
          <div class="char-grid">
            {#each Object.entries(chars) as [char, enabled]}
              <label class="char-toggle">
                <input type="checkbox" checked={enabled} onchange={() => toggleChar(key, char)} class="sr-only" />
                <span class="char-chip" class:active={enabled}>{char}</span>
              </label>
            {/each}
          </div>
        {/if}
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

  .group-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
  }

  .group-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
  }

  .expand-button {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 0;
    font-size: 14px;
    line-height: 1;
    flex-shrink: 0;
    width: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .chevron {
    display: inline-block;
    transition: transform 0.2s;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .group-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    color: inherit;
    font: inherit;
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

  .slider.partial {
    background: var(--accent);
    opacity: 0.5;
  }

  .slider.active::after,
  .slider.partial::after {
    transform: translateX(16px);
  }

  /* Character grid */
  .char-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px 12px 44px;
  }

  .char-toggle {
    cursor: pointer;
  }

  .char-chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 32px;
    height: 32px;
    padding: 0 8px;
    border-radius: 6px;
    font-size: 15px;
    font-weight: 500;
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    color: var(--text-muted);
    transition: background 0.15s, color 0.15s, border-color 0.15s;
    user-select: none;
  }

  .char-chip.active {
    background: var(--accent);
    color: white;
    border-color: var(--accent);
  }

  :global(main.cyberpunk) .group-card {
    border-color: #3b3b5c;
  }

  :global(main.cyberpunk) .slider.active {
    box-shadow: 0 0 10px var(--accent);
  }

  :global(main.cyberpunk) .char-chip.active {
    box-shadow: 0 0 8px var(--accent);
  }
</style>
