# Рисованные ролики кодом (code-cartoon) — заготовка на будущее

Эксперимент: выпуск психологии №1003 «7 приёмов манипуляции» (7:03), перерисованный на движке
[code-cartoon](https://github.com/famfamfam/code-cartoon) (MIT) с готовой озвучкой.
Бот это не использует — ветка отдельная, в `motion-bot` не вливалась.

## Что здесь
- `skill/` — сам скилл code-cartoon (копия, MIT, лицензии внутри).
  Установить: `cp -R experiments/code-cartoon/skill ~/.claude/skills/code-cartoon`.
- `manipulation-7/` — проект ролика:
  - `story.js` — данные: миры (палитры), герои, реплики, позы, моменты «попался» (ниточки), перерезание;
  - `scene.js` — рисование: человечки с позами и эмоциями, облачка, ниточки кукловода, реквизит каждого листа,
    заставки глав, счётчик ниточек, шпаргалка в конце;
  - `build.mjs` — из озвучки строит `timing.js` (время каждой фразы) и `cues.js` (≈220 звуков + голос дорожкой);
  - `voice.ogg` + `voice_timings.json` — озвучка выпуска и её тайминги по фразам.

## Как собрать
Нужны Node 22+, ffmpeg, Python 3 с numpy/scipy/pillow.
```bash
cd experiments/code-cartoon/manipulation-7
C=~/.claude/skills/code-cartoon/scripts/cartoon
node build.mjs voice_timings.json voice.ogg   # timing.js, cues.js, audio/voice.wav
$C audio                                      # audio/mix.wav: голос + музыка + звуки, −15 LUFS
$C snapshot --at 20,60,200                    # проверить кадры
$C render --fps 24 --output out.mp4           # ~35 мин на 7 минут видео
```

## Понравившиеся фоны
Тетрадь в клетку (`notebook`), газетный коллаж (`collage`), мел на доске (`chalk`).
Идея на потом: конвертер сценариев `src/psy/scripts/*.mjs` → проект code-cartoon с чередованием этих фонов.
