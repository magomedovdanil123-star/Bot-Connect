---
name: Financial short rendering
description: Operational constraints for the standalone financial explainer renderer and its voice path.
---

Long vertical financial explainers are rendered frame-by-frame from SVG and can take several minutes even when the final video is under two minutes. Universal topic renders also synthesize and concatenate one voice segment per scene so visual cuts follow the actual spoken scene.

**Why:** A real 72-second, 1080×1920 render with current voice synthesis completed successfully but took about six minutes. The SVG tag and presenter-layer mismatches also passed TypeScript and appeared only during FFmpeg rendering. A one-off esbuild bundle of the voice module needs a Node `createRequire` banner because the ElevenLabs SDK loads a CommonJS dependency.

**How to apply:** Keep the renderer separate from the production video pipeline, use the existing speech provider, keep long runs behind Telegram background tasks, and validate the final MP4 asynchronously with ffprobe. For SVG or overlay changes, render a short MP4 through the real FFmpeg path and inspect several frames; static checks cannot validate SVG strings or layer alignment.

The requested target duration is planning metadata, not a render-time cap: the final MP4 length comes from the synthesized and concatenated narration.

**Why:** Word-count estimates and AI-provided duration fields did not reliably predict the actual spoken runtime.

**How to apply:** Validate narration length before rendering, then use ffprobe on the produced MP4; never infer final runtime from the plan alone.

Standalone financial QA bundles must bundle workspace packages and preserve logger worker resolution; externalizing every package can make Node ESM reject TypeScript directory exports or resolve workers from the wrong path. The Pino esbuild plugin emits several worker entrypoints, so a fixed `entryNames` value can make outputs collide; stdin builds default to `stdin.mjs`.

**Why:** Direct harness bundles failed on both workspace schema imports and a missing worker module even though the managed API build succeeded.

**How to apply:** Mirror the API build's bundling and Pino worker setup for local test harnesses, use an output directory while preserving plugin-generated names, run the actual entry emitted by esbuild, and include the Node `createRequire` banner used by the voice SDK.

Sticker captions must preserve polarity: broad positive finance motifs should not match negative guarantee wording, and fallback captions must not drop negation.

**Why:** A rendered frame showed “Нет гарантии” beside a positive “она гарантирована” sticker, even though the narration clearly contained a disclaimer.

**How to apply:** Keep sticker matching polarity-aware and inspect extracted video frames for disclaimer contradictions, not only static SVG previews.

The premium creator look is the default for every production financial Short, not only futures. Keep it scoped to financial rendering; unrelated bot video formats and the isolated object-animation prototype retain their own styles.

**Why:** The user approved the local-preview treatment for financial Shorts as a category while excluding other video formats.

**How to apply:** Select the theme at the financial-plan boundary rather than moving it into shared video code.

Generated cutouts may still contain a fully opaque checkerboard despite a transparency request; diagonal checker tiles can also survive a single-corner flood fill.

**Why:** A real FFmpeg render exposed a lower-edge white patch that the corner-only asset check missed, and a later generated presenter arrived with no alpha channel at all.

**How to apply:** Check the alpha channel before compositing. If the checkerboard is baked in, use a modest-fuzz, 8-connected flood fill from all four corners, then inspect the cutout against its final dark background.

Financial Shorts visual prompts are handled one numbered point at a time. The user supplies production topics; do not generate topic examples or send test MP4s through Telegram.

**Why:** The user explicitly requested staged implementation and review, and prior example-topic generation was unwanted.

**How to apply:** Finish and verify only the current numbered point, then stop. Use neutral local FFmpeg previews for visual checks when needed.

For graphics-only checks, use the direct frame-preview path instead of the full topic render, which enters speech synthesis. Keep FFmpeg MP4 runs for changes that need audio, codec, compositor, or final-output validation.

**Why:** A local full-render preview synthesized voice and the multi-scene audio path required scene-boundary timestamps; neither was needed to inspect the visual concepts. A classic-theme frame preview also omits the structured micro-beat overlays, so it cannot validate sticker placement.

**How to apply:** Render static frames for theme and layout checks. Use the premium creator theme to inspect structured moments and sticker overlays. Use a short local FFmpeg video when validating audio/video integration, and never send QA media through Telegram.

Mixed raster media in financial Shorts is contextual only: stock imagery must be commercially usable without required attribution, and any financial values remain in verified narration or programmatic graphics.

**Why:** Raster images are embedded in SVG frames, increasing render cost; generated or photographed text can also introduce unsupported financial claims. FFmpeg's SVG renderer can silently omit external file URLs, while source links should remain visible in the Telegram plan preview.

**How to apply:** Keep raster layers to a small number per Short, preserve photo source/license metadata in the plan, keep embedded images compact and only in frames where their moment is active, and never use image content as a source for figures or market data.

Keyword overlays need a reserved band between infographic content and the presenter. Being above the face does not guarantee they are clear of a card's lower caption.

**Why:** A keyword badge placed above the presenter overlapped the lower caption of a centered risk infographic during local preview.

**How to apply:** Preview dense centered and hero moments as well as different presenter layouts. Adjust the visual region and keyword band together, and verify the badge clears both the graphic and the presenter.

Scene and moment progress may use normalized fractional boundaries as well as millisecond timestamps. Progress math must preserve spans smaller than one instead of flooring the denominator to one.

**Why:** A one-millisecond minimum made normalized scene spans behave like global clip progress, leaving later timed moments stuck on the first visual.

**How to apply:** Divide by the actual positive span and handle zero or reversed ranges explicitly. Preview a late moment in each scene to verify local progress reaches the expected visual.

Premium finance renders composite presenter art over the base SVG, then place subtitles in a later overlay. Persistent text that must stay visible above the presenter belongs in that top overlay.

**Why:** A footer drawn in the base frame was covered by the separately composited presenter in the final MP4, even though static inline previews looked correct.

**How to apply:** Put persistent disclosures in the final overlay plane and verify a rendered frame where the presenter crosses the target area.

Premium financial Shorts should show the presenter, synchronized subtitles, and topic-specific animated sticker/emoji illustrations. Avoid full chart layouts, infographic cards, diagrams, dashboards, and standalone number counters. A compact animated price line is allowed only when narration explicitly discusses price direction or movement; never invent financial values or outcomes.

**Why:** The user wants visual changes to follow complete sentence or clause meaning, not an arbitrary two-word cadence. A compact price-line sticker is useful when the narration discusses price, but full chart panels remain out of scope.

**How to apply:** Segment the exact voice track at sentence and clause boundaries; show one primary topical sticker and optionally one distinct companion/action visual per cue. Keep at most two visible, animate each motif appropriately, sync entrance to the spoken phrase, and inspect a local 9:16 render before delivery.

Crypto F2 must not add separate lower word insertions (including their badge/icon and rule); keep the phrase text on stickers and the normal subtitle track.

**Why:** The user specifically wants the detached words removed consistently in every Crypto F2 render while retaining the text above the stickers.

**How to apply:** Suppress only the lower micro-beat word overlay in Crypto F2. Do not remove sticker captions or the regular subtitles.

Crypto F2 visual moments should generally hold for about 2.5–4 seconds, with restrained entry, exit, and looping motion; narration and subtitles keep their original timing.

**Why:** The user asked for fewer, less abrupt visual changes and a roughly 3–4-second hold without slowing the spoken track.

**How to apply:** Scope longer segmentation and gentler motion to Crypto F2 only. Preserve sticker text, normal subtitles, and the existing lower-word suppression.

Sticker events should have a short phrase-length hold, and duplicate adjacent captions should not stack. Numeric cues must not suppress the sticker rail.

**Why:** Long holds caused unrelated ideas to linger across scene changes, while number-specific interruptions created empty stretches.

**How to apply:** Cap event linger near the next phrase, allow no more than two simultaneous stickers, and inspect concept-to-number transitions.

Financial topic Shorts must persist the plan, each completed scene voice file, and the rendered MP4 before advancing to the next stage. Resume retries should reuse the same saved job and regenerate only missing, unreadable, or stale assets; voice segments are stale when their source narration changes.

**Why:** A Lumean timeout previously failed before the in-memory plan and temporary MP3 files had been stored, making the requested run impossible to resume exactly. Separately, actual TTS can exceed the plan's target duration; replaying valid audio from superseded narration repeats the same render failure.

**How to apply:** Save scene audio to durable object storage immediately after synthesis, update the job checkpoint after each scene, preserve the MP4 before Telegram delivery, and validate Telegram resume callbacks against the originating chat. When narration changes, clear only dependent voice-segment references and retain the market snapshot, visual plan, and unrelated completed assets.

Financial Shorts must use the configured speech provider and voice. Never substitute free or alternate audio automatically; a provider failure should leave the job resumable.

**Why:** The user confirmed the configured account has funds and explicitly rejected alternate audio; preserving the intended voice is more important than silently delivering a different one.

**How to apply:** Persist the plan and completed assets, report the configured provider's error, and expose the resume button. Retry with the same voice unless the user chooses a different provider.

When a longer natural narration outgrows its existing music bed and replacement music is unavailable, preserve the established score with pitch-preserving time stretch rather than a hard loop. Mix the stretched bed and scene-offset voice clips into one continuous master.

**Why:** Extending an existing short's runtime by repeating its 30-second music bed would introduce an obvious seam and disrupt the approved musical identity.

**How to apply:** Use moderate high-quality time stretching only when regeneration is unavailable; verify the composite duration, scene-boundary voice tails, and peak level. If stretching is audible, adjust the arrangement or regenerate the music.

Telegram may display an MP4 with the wrong aspect ratio if `sendVideo` omits its dimensions. The Bot API accepts explicit width, height, and `supports_streaming`, and its response exposes the dimensions it registered.

**Why:** A stored file probed as 1080×1920 (9:16) appeared square in Telegram until the upload included explicit 1080×1920 metadata; the Bot API then returned those same dimensions.

**How to apply:** Route every Telegram video through the shared sender, probe the source MP4's actual geometry with ffprobe, pass its width and height with `supports_streaming=true`, and compare Telegram's returned aspect ratio with the source.

Financial Shorts should sound like a warm host talking to a beginner: open with a friendly, topic-specific hook, then explain figures and unfamiliar terms in plain language. Avoid empty greetings, canned filler, and clickbait while preserving factual caveats. The conditional $1,000 example is specific to the 24-hour market-focus format; do not reuse it in formats with different examples.

**Why:** The user said current scripts need more simplicity, humanity, and clarity, and approved a direct greeting followed by the coin and period.

**How to apply:** Set this as the default for generated financial scripts and deterministic market-focused openings. Keep hooks tied to the topic and verified data, and leave user-authored scripts untouched.

Standalone financial renders can stall when the configured bot voice is routed directly through Lumean instead of the shared provider dispatcher. In an observed test, the Lumean order remained pending for more than five minutes, while a short narration through the dispatcher completed promptly.

**Why:** The direct financial-renderer path can bypass the configured provider dispatcher and has no overall deadline across order polling, so a local preview may wait before FFmpeg starts.

**How to apply:** For local QA assets, synthesize narration through the shared provider dispatcher and pass the audio into the audio-track rendering path. Keep the selected voice unchanged and bound the external TTS test.