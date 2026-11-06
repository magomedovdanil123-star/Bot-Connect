# пересборка toon.js: заголовок/хвост — из текущего toon.js, середина — toon_parts.js + toon_shots.js + toon_scene.js + UI-блок world.js
import os
D = os.path.dirname(os.path.abspath(__file__)) + '/'
cur = open(D + 'toon.js').read(); w = open(D + 'world.js').read()
head = cur[:cur.index("/* Стикмены «как в мультфильме»")]
tail = cur[cur.index("\n/* ---------------- кадр: постановка фразы"):]
ui = w[w.index("/* ---------------- 2D-слой: цифры, плашки, субтитры */"):w.index("/* ---------------- кадр */")]
parts = [open(D + n).read() for n in ('toon_parts.js', 'toon_shots.js', 'toon_scene.js')]
open(D + 'toon.js', 'w').write(head + '\n'.join(parts) + '\n' + ui + tail)
