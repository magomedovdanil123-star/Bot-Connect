---
name: Inline mockup CSS checks
description: Visual verification guidance for React mockups that keep CSS in component template strings.
---

CSS inside a React component's inline `<style>` template string may pass TypeScript and production builds even when a brace error prevents later selectors from applying. After editing these styles, check the rendered preview rather than relying on compile success alone.

**Why:** A misplaced closing brace caused guide text styles to stop applying while both typecheck and Vite build still passed.

**How to apply:** When changing inline CSS in mockup components, inspect the edited rule boundaries and take a browser screenshot before presenting the frame.