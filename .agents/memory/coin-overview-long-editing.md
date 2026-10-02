---
name: Finance Long v4 editing
description: User-approved visual language, palette rules, storyboard approval, and audio-preservation requirements for Finance Long videos.
---

For all three Telegram Finance → Long Video paths—automatic coin overview, coin plus user script, and pasted script—use the approved Finance Long v4 visual language: high-contrast 16:9 compositions, layered visible motion, varied graphic scenes, and large voice-timed captions. Select a textured gradient palette that fits the subject. HYPE's label and artwork are HYPE-specific and must not be reused for other assets.

Choose a prominent, legible graph or animated diagram from each scene's narration and visual description; do not rely on faint decorative strokes behind subtitles. Market moves need a visible trend line, and process explanations should use clear labeled steps.

For Aptos, positive statements about secure transaction processing describe the network, not a risk. Reserve risk visuals for explicit threats or problems. Keep the context of one explanatory chain (such as activity → transactions → fees → token burn) across its timed phrase beats, without spreading unrelated narration across the whole scene.

**Why:** Aptos narration describes secure processing positively and includes explanations that can be split across timed phrases; treating either as an isolated warning or an unrelated network motif misrepresents the spoken point.

**How to apply:** In Aptos scene classification, keep positive security language with network architecture and carry context only across phrases belonging to one explanatory sentence. Preserve separate motif changes between sentences.

Older approved Finance Long palettes—graphite/black, terracotta, chocolate brown, cool pale blue, plum, powder pink, and deep cobalt—are topic-specific options, not a requirement for every project. For the Aptos visual refresh, follow the supplied V4 reference: dark navy/black with neon cyan, yellow, and coral; use clean vector or 2.5D digital diagrams instead of photographed paper charts, documents, or stone/brick walls. Keep generated backgrounds free of text so accurate labels and captions can be composited separately. Treat supplied screenshots as visual references only: do not reproduce their social interface, account details, or controls.

For Aptos subtitles, use the user's supplied screenshots as a typography reference only: large, bold uppercase sans-serif words, with the spoken keyword prominent and word-timed high-contrast emphasis. Keep Aptos's own palette and do not copy the mobile browser framing.

**Why:** The user specifically pointed to the subtitle font and asked for large highlighted text like the examples.

**How to apply:** Use the kinetic caption renderer rather than plain static preview text, preserve the exact approved narration, and inspect a representative 16:9 render for type size and legibility.

The Telegram “Coin Overview — Long Video” format must work for new scripts about any coin, not only Aptos. Route the Finance Long format through the shared animated renderer even when older or missing script metadata would otherwise select image scenes. Keep Aptos-only palette and labels scoped to Aptos; use a script ticker when explicit and a neutral token label when it is not.

**Why:** The user wants to select coin overview, paste a different script, and get the same reliable long-video treatment without Aptos-specific branding leaking into it.

**How to apply:** Keep the format-level renderer fallback and regression-test at least one non-Aptos ticker plus a no-ticker flow. Preserve narration, audio, and the Telegram approval gate; do not treat a successful render test as approval to rebuild a finished video.

Before video production, send the storyboard and script in Telegram and wait for explicit approval. The pre-approval storyboard should be a clearly labeled static visual concept, not AI-generated sample frames; avoid generic alarm icons and derive its illustrations from each scene's visual description. Preserve the user's narration, approved script, voice timeline, and existing audio mix; visual changes must not rewrite or regenerate speech. Keep visual holds under 1.65 seconds where practical, output 16:9 at 30 fps, inspect finished long renders at two-second intervals, and deliver the MP4 in Telegram. Keep Shorts and story workflows separate and unchanged.

**Why:** The user approved the PUMP reference and HYPE v4 adaptation, then requested the same visual language across all Finance Long creation paths. The reusable part is the visual style and approval workflow, not HYPE-specific branding. The user later supplied a distinct Aptos V4 reference and rejected photo-like paper/wall visuals; that palette and treatment are scoped to Aptos unless they ask to reuse it elsewhere. They explicitly require visible, context-matched graphs or animated inserts rather than sparse background strokes. Storyboard approval catches mismatched composition or pacing before the expensive render, and preserving narration prevents visual edits from changing the spoken script. The user chose a redesigned static concept over pre-approval AI frames to avoid extra generation usage and delay. A completed Aptos job also exposed a silent profile-to-renderer mismatch that replaced the approved V4 design with static scene images.

**How to apply:** For each Finance Long draft, choose a deterministic topic-appropriate palette, create a static concept sheet from the scene visuals, and require approval before starting the pipeline. For Aptos, use the specified dark-neon graphic treatment and create readable text as overlays, not in generated backgrounds. Map narration and scene descriptions to explicit, high-contrast graphic motifs, and verify that the relevant graph or diagram is visible in rendered frames. Generate actual scene images only after approval. Build motion and captions from the completed voice timeline. Test the service-to-renderer profile handoff so Finance Long V4 cannot silently fall back to image scenes. Do not extend this treatment or approval gate to Shorts or stories.

For legal-case scenes, change the composition at each narrated stage instead of relabeling a shared timeline or card layout. Use distinct visuals for the SEC filing, blocked Gram transfer, refund and fine settlement, and the original Gram project's closure. Do not show TON's independent continuation unless that scene's narration says it. Inspect a montage of actual rendered frames before requesting approval.

**Why:** The user rejected an earlier preview because its shared structure still looked unchanged. The approved legal-scene narration describes the original Gram project's closure but does not mention TON's later independent development.

**How to apply:** Keep each legal stage visually distinct, reveal exact amounts only as they are spoken, preserve the source audio, and review multiple 16:9 frames before presenting a short preview.