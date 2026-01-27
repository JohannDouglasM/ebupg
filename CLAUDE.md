# CLAUDE.md - Project Guidelines

## Project Overview
EPUB Typing Game - A Svelte web app where users upload EPUB files and practice typing by typing through the book content.

## Development Commands
- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run build` - Build for production

## Code Style
- Use Svelte 5 runes syntax ($state, $derived, $effect)
- Keep components focused and single-purpose
- Prefer explicit over implicit behavior

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
