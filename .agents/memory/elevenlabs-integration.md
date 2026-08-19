---
name: ElevenLabs integration
description: The project uses the official @elevenlabs/elevenlabs-js SDK and requires runtime Secrets for voice generation.
---

The ElevenLabs skills repository is a reference/usage guide, not an application runtime dependency. The production integration uses the official `@elevenlabs/elevenlabs-js` package behind a server-side provider layer. Voice generation must fail explicitly with a configuration error when `ELEVENLABS_API_KEY` is absent; never simulate completed audio.

**Why:** The repository documents the current SDK, supported models, voice settings, and output formats, while secrets must stay outside source code and frontend bundles.

**How to apply:** Keep ElevenLabs HTTP/SDK calls inside the audio-generation provider layer, use `ELEVENLABS_MODEL_ID` with `eleven_multilingual_v2` as the Russian-safe default, and expose a clear 400/503 configuration state to the UI.