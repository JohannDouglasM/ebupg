<script>
  import { parseEpub } from '../lib/epubParser.js'
  import { loadBook } from '../lib/stores.js'

  let isDragging = $state(false)
  let error = $state('')
  let isLoading = $state(false)

  async function handleFile(file) {
    if (!file.name.endsWith('.epub')) {
      error = 'Please upload an EPUB file'
      return
    }

    error = ''
    isLoading = true

    try {
      const book = await parseEpub(file)
      if (book.chapters.length === 0) {
        error = 'No readable content found in this EPUB'
        return
      }
      loadBook(book.title, book.chapters)
    } catch (e) {
      error = `Failed to parse EPUB: ${e.message}`
    } finally {
      isLoading = false
    }
  }

  function handleDrop(e) {
    e.preventDefault()
    isDragging = false
    const file = e.dataTransfer?.files[0]
    if (file) handleFile(file)
  }

  function handleDragOver(e) {
    e.preventDefault()
    isDragging = true
  }

  function handleDragLeave() {
    isDragging = false
  }

  function handleInputChange(e) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }
</script>

<div
  class="upload-zone"
  class:dragging={isDragging}
  role="region"
  aria-label="File upload drop zone"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
>
  {#if isLoading}
    <div class="loading">
      <div class="spinner"></div>
      <p>Parsing EPUB...</p>
    </div>
  {:else}
    <div class="upload-content">
      <div class="icon">📚</div>
      <h2>Upload an EPUB</h2>
      <p>Drag and drop your EPUB file here, or click to browse</p>
      <input
        type="file"
        accept=".epub"
        onchange={handleInputChange}
        id="file-input"
      />
      <label for="file-input" class="browse-btn">Browse Files</label>
    </div>
  {/if}

  {#if error}
    <p class="error">{error}</p>
  {/if}
</div>

<style>
  .upload-zone {
    border: 2px dashed var(--border);
    border-radius: 12px;
    padding: 60px 40px;
    text-align: center;
    transition: all 0.2s ease;
    background: var(--bg-card);
    max-width: 500px;
    margin: 0 auto;
  }

  .upload-zone.dragging {
    border-color: var(--accent);
    background: var(--bg-secondary);
  }

  :global(main.cyberpunk) .upload-zone {
    border-color: #3b3b5c;
    box-shadow: 0 0 30px rgba(168, 85, 247, 0.1), inset 0 0 50px rgba(168, 85, 247, 0.02);
  }

  :global(main.cyberpunk) .upload-zone.dragging {
    box-shadow: 0 0 40px var(--accent), inset 0 0 50px rgba(168, 85, 247, 0.05);
  }

  .upload-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .icon {
    font-size: 48px;
  }

  h2 {
    margin: 0;
    color: var(--text-primary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
  }

  input[type="file"] {
    display: none;
  }

  .browse-btn {
    display: inline-block;
    padding: 12px 24px;
    background: var(--accent);
    color: var(--bg-primary);
    border-radius: 6px;
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s;
    margin-top: 8px;
  }

  .browse-btn:hover {
    background: var(--accent-hover);
  }

  :global(main.cyberpunk) .browse-btn {
    box-shadow: 0 0 20px var(--accent);
    color: #ffffff;
  }

  :global(main.cyberpunk) .browse-btn:hover {
    box-shadow: 0 0 30px var(--accent), 0 0 50px rgba(168, 85, 247, 0.4);
  }

  .error {
    color: var(--incorrect);
    margin-top: 16px;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    color: var(--text-primary);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  :global(main.cyberpunk) .spinner {
    box-shadow: 0 0 20px var(--accent);
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
