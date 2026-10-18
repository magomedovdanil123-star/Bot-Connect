// Тест формата «конфетка» без озвучки: node scripts/candy-test.mjs <сценарий> <out.mp4> [seed]
import fs from 'fs';
import { makeVideo } from '../src/make.js';
const [,, file, out, seed] = process.argv;
const r = await makeVideo(fs.readFileSync(file, 'utf8'), { out, newId: process.env.NEW_ID || null, vertical: true, theme: 'ink', mascot: true, candy: true, seed: seed ? +seed : 7,
  tg: { username: 'traffichomyak', title: 'Хомяк на Трафике', promise: 'Таблица «сначала себе»' }, seoHints: { title: 'Мой кореш Крот слепой как котёнок 🙈', topic: 'как накопить', tags: [] },
  onProgress: p => process.stdout.write(`\r${Math.round(p * 100)}%`) });
console.log('\n', r.duration.toFixed(1), 'c', r.sizeMB.toFixed(1), 'МБ');
