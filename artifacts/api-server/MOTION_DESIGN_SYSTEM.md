# Finance Long Motion Design System

## Scope and source of truth

This is the visual standard for one Telegram entry only: **ФИНАНСЫ → Обзор монеты + свой сценарий**. It borrows the visual language of the approved Ethereum motion preview; it does not borrow Ethereum branding, symbols, facts, or coin-specific imagery. Other Finance Long routes keep their existing visual profiles.

This file is the source of truth for the route's art direction. The matching render tokens and event-sequence parser live in `src/lib/video-pipeline/ethereum-motion-design.ts`. Do not change this document or those tokens unless the user explicitly asks to change the style.

## Visual DNA

- Canvas: 16:9, 1920×1080.
- Render rate: constant 60 fps.
- Background: `#070B16`.
- Coral accent: `#FF5A67`.
- Cyan accent: `#16C7E8`.
- Yellow accent: `#E5D438`.
- Inactive: `#252B38`; secondary inactive: `#343A47`.
- Text: `#F3F3F3`.
- Typography: Montserrat ExtraBold for prominent labels and kinetic captions. Keep captions in a stable lower band, at a consistent size and position; remove sentence punctuation from caption display while preserving numeric separators. Never alter the saved narration.
- Use clean vector geometry, a restrained technical grid, visible node systems, data-flow paths, counters only for spoken or verified values, and clear scene hierarchy. Do not use paper, stone, or decorative gradients from the older Finance Long profile.
- Do not render invented prices, metrics, labels, forecasts, or branding. Do not use Ethereum's diamond or logo for other coins.

## Motion tokens

The machine-readable values are exported by `ethereum-motion-design.ts`:

- FPS: `60`
- Micro motion: `0.35 s`
- Normal motion: `0.7 s`
- Cinematic motion: `1.2 s`
- Scene transition: `0.8 s`
- Change the dominant visual event at least every `1.65 s` when the narration allows.

Use the existing FFmpeg vector primitives. Build line segments from `drawbox` filters; do not use FFmpeg `drawline`, which is unavailable in the deployed build.

## Scene event library

Each scene's final `MOTION_SEQUENCE:` line contains 5–8 ordered events. Use only these event tags:

`TECHNICAL_GRID`, `DATA_FLOW`, `NETWORK_REVEAL`, `FINANCIAL_CHART`, `TIMELINE`, `COMPARISON`, `PARTICLE_FLOW`, `NODE_SYSTEM`, `MORPH_TRANSITION`, `CAMERA_PUSH`, `MOTION_TEXT`.

The renderer maps the sequence to the existing technical-grid, network, chart, timeline, and particle primitives. It uses the event order across the scene's voice timeline. It must not add unsourced text to make a visual event readable.

## Quality gate

Before the storyboard is offered for approval, check that every scene has 5–8 valid motion events, the user's voice text is unchanged, and the static concept uses this palette and type system. Before final delivery, verify 16:9 H.264/AAC at 60 fps, legible captions in the lower band, clear illustrated forms, and visual continuity across scene boundaries. Final rendering must remain behind the user's explicit storyboard approval.