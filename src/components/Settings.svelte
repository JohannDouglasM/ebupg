<script>
  import { strictMode, theme } from '../lib/stores.js'

  let isCyberpunk = $derived($theme === 'cyberpunk')

  function toggleTheme() {
    theme.update(t => t === 'cozy' ? 'cyberpunk' : 'cozy')
  }
</script>

<div class="settings">
  <label class="toggle-row">
    <input type="checkbox" bind:checked={$strictMode} class="sr-only" />
    <span class="slider" class:active={$strictMode}></span>
    <span class="toggle-label strict-label">{$strictMode ? 'Strict' : 'Lenient'}</span>
  </label>

  <label class="toggle-row">
    <input type="checkbox" checked={isCyberpunk} onchange={toggleTheme} class="sr-only" />
    <span class="slider" class:active={isCyberpunk}></span>
    <span class="toggle-label theme-label">{isCyberpunk ? 'Berlin' : 'Hay-on-Wye'}</span>
  </label>
</div>

<style>
  .settings {
    display: flex;
    gap: 20px;
    padding: 12px 16px;
    background: var(--bg-card);
    border-radius: 8px;
    border: 1px solid var(--border);
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
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    white-space: nowrap;
  }

  .slider {
    position: relative;
    width: 36px;
    height: 20px;
    background: var(--border);
    border-radius: 10px;
    transition: background 0.2s;
    flex-shrink: 0;
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

  .toggle-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .strict-label {
    min-width: 50px;
  }

  .theme-label {
    min-width: 75px;
  }

  :global(main.cyberpunk) .settings {
    border-color: #3b3b5c;
  }

  :global(main.cyberpunk) .slider.active {
    box-shadow: 0 0 10px var(--accent);
  }
</style>
