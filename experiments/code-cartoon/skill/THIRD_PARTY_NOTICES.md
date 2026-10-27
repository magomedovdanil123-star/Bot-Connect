# Third-party notices

The code of this repository is MIT-licensed (see LICENSE). These bundled or used components keep
their own licences.

## Bundled

| Component | Where | Licence |
|---|---|---|
| three.js r181 (`three.module.min.js`, `three.core.min.js`, `RoomEnvironment.js`) | `skills/code-cartoon/assets/template-3d/vendor/` | MIT, © Three.js Authors (`LICENSE-three-MIT.txt`) |
| GSAP 3.15.0 (`gsap.min.js`) | `skills/code-cartoon/assets/template/vendor/` | GSAP Standard "No Charge" License, © Webflow / GreenSock — https://gsap.com/standard-license. The file keeps its original notice. GSAP is the timeline HyperFrames seeks; this project is not a visual animation builder. |
| Caveat | `skills/code-cartoon/assets/template/fonts/` | SIL Open Font License 1.1 (`LICENSE-Caveat-OFL.txt`) |
| Inter | `skills/code-cartoon/assets/template/fonts/` | SIL Open Font License 1.1 (`LICENSE-Inter-OFL.txt`) |
| Ruslan Display | `skills/code-cartoon/assets/template/fonts/` | SIL Open Font License 1.1 (`LICENSE-RuslanDisplay-OFL.txt`) |
| Lora | `skills/code-cartoon/assets/template-photo3d/fonts/` | SIL Open Font License 1.1 (`LICENSE-Lora-OFL.txt`) |
| Sample photo "Bdg parkKochanowskiego a 10 10-2013.jpg" by Pit1233 | `skills/code-cartoon/assets/template-photo3d/assets/sample-photo.jpg` | CC0 1.0 (public domain dedication), from Wikimedia Commons: https://commons.wikimedia.org/wiki/File:Bdg_parkKochanowskiego_a_10_10-2013.jpg (record: `sample-photo.LICENSE.json`) |

The sample crayon drawing (`sample-drawing.jpg`), the plugin icon and all demo videos were made with
this project's own code (`skills/code-cartoon/examples/`).

## Used, not bundled

| Component | How | Licence |
|---|---|---|
| HyperFrames | renderer, fetched with `npx` at a pinned version | Apache-2.0, © HeyGen |
| Piper TTS (`piper-tts`) | optional narration engine, installed by the user, run as a separate program | GPL-3.0-or-later. Each Piper voice has its own licence (see the voice's MODEL_CARD on huggingface.co/rhasspy/piper-voices). |
| FFmpeg, Node.js, Python, NumPy, SciPy, Pillow | system tools and libraries | their own licences |
