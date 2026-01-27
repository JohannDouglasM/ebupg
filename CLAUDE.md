# CLAUDE.md - Project Guidelines

## Project Overview
**EPUBG** - A Svelte 5 typing game where users upload EPUB files and practice typing through book content.

## Development Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production

## Architecture

### Key Files
- `src/lib/stores.js` - All state management (Svelte stores), WPM calculations, progress saving
- `src/components/TypingGame.svelte` - Main typing interface, keystroke handling, windowed rendering
- `src/components/Stats.svelte` - WPM display, accuracy, highscores
- `src/components/Settings.svelte` - Strict/Lenient toggle, theme toggle
- `src/lib/epubParser.js` - EPUB file parsing

### Key Features
- **WPM**: Rolling 4-second window for responsive speed display
- **Last session WPM**: Shows WPM from last typing burst after 2s pause (same "WPM" label, different color)
- **Highscores**: Best 5s/10s/30s, separate for Strict vs Lenient mode, auto-switches with toggle
- **Themes**: "Hay-on-Wye" (cozy) and "Berlin" (cyberpunk neon)
- **Text normalization**: Smart quotes → straight quotes, double newlines → ¶ (requires Enter)
- **Progress**: Auto-saved per book (identified by content hash), persists across refresh
- **Windowed rendering**: Only renders ~2000 chars around cursor for performance

### Patterns Used
- Use `get()` from svelte/store to read store values in functions
- Derived stores for computed values (stats, progress, current WPM records)
- localStorage for persistence (book data, progress, theme, highscores)

## Code Style
- Svelte 5 runes: $state, $derived, $effect
- Keep components focused
- Prefer explicit over implicit

## GitHub
- Repo: https://github.com/JohannDouglasM/ebupg

---

## AI Assistant Guidelines

**These guidelines address common failure modes when using AI coding assistants.**

### 1. Don't Make Assumptions
- If requirements are unclear, ASK before implementing
- Don't guess what the user wants and run with it
- Surface ambiguities and inconsistencies immediately
- Present tradeoffs when multiple approaches exist

### 2. Manage Confusion
- If something doesn't make sense, say so
- Don't paper over confusion with plausible-sounding code
- Ask for clarification rather than guessing
- Push back when requests seem problematic

### 3. Keep It Simple
- Prefer 100 lines of clear code over 1000 lines of "flexible" code
- Don't bloat abstractions - solve the actual problem
- Avoid premature generalization
- Question: "Could this be simpler?"

### 4. Clean Up After Yourself
- Remove dead code, don't leave it commented out
- If you add something then remove it, delete it fully
- Don't leave TODO comments for things you could just do
- Keep the codebase lean

### 5. Don't Touch Unrelated Code
- Stay focused on the task at hand
- Don't "improve" code that's working and orthogonal to the request
- Don't remove or change comments you don't understand
- Avoid side-effect modifications

### 6. Be Direct, Not Sycophantic
- Give honest assessments
- Point out when an approach has problems
- Don't just agree with everything
- Technical accuracy over politeness

### 7. Watch for Subtle Errors
- The bugs won't be syntax errors - they'll be conceptual mistakes
- A slightly wrong assumption can propagate through the codebase
- Double-check logic, especially edge cases
- Verify the code actually does what it claims to do
