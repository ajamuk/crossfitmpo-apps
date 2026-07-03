---
name: claude-design
description: Design guidance for building polished HTML design artifacts — prototypes, landing pages, decks, UI components. Use when creating or restyling HTML/CSS designs, mockups, slides, or interactive prototypes, or when the user asks for design help, visual polish, or "claude-design".
---

# claude-design

This skill packages the design guidance from `reference.md` (source:
https://github.com/asgeirtj/system_prompts_leaks/blob/main/Anthropic/claude-design.md).

The document was written for the claude.ai artifacts/design environment, so parts of it
reference tools that do not exist in Claude Code (`dc_write`, `dc_html_str_replace`,
`ready_for_verification`, Design Components / `.dc.html` runtime, etc.). Ignore those
tool-specific mechanics — apply the transferable design guidance instead.

## How to use

1. Read the relevant sections of `reference.md` in this directory before writing any design code.
   The most transferable sections are:
   - **Output creation guidelines** — color usage, respecting existing visual vocabulary,
     targeted edits vs. redesigns, canonical HTML.
   - **Anti-patterns — DO NOT** — the list of design and code smells to avoid.
   - **Skills** — craft guidance on typography, spacing, layout, motion, and visual hierarchy.
2. When the environment-specific instructions in `reference.md` conflict with this project's
   setup (plain static HTML pages under the repo root), follow the project's conventions:
   write standard self-contained `.html` files, not `.dc.html` Design Components.
3. When adding to an existing page, first study its palette, typography, spacing, and tone,
   and match them rather than introducing a new style.
