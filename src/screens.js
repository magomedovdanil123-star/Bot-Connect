// Сцена «Экран»: бот сам открывает сайт из сценария, снимает страницу и находит на ней кнопки-призывы
// (регистрация, «стать агентом», «начать»), чтобы в ролике камера наехала на них и обвела маркером.
// Снимки кэшируются в папке проекта: повторная сборка сайт заново не открывает.
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = createRequire('/opt/node22/lib/node_modules/')('playwright')); }

const VIEW = { width: 1440, height: 900 }, MAX_H = 2700;
const CTA = 'регистр|зарегистр|стать агент|стать партн|начать|заработ|присоедин|подключ|получить|оформить|попробовать|sign ?up|register|get started|join';

const dataUrl = f => 'data:image/jpeg;base64,' + fs.readFileSync(f).toString('base64');

async function shoot(browser, url, file) {
  const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;   // в песочнице разработки трафик идёт через прокси
  const ctx = await browser.newContext({ viewport: VIEW, locale: 'ru-RU', ignoreHTTPSErrors: Boolean(proxy),
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36' });
  try {
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    // плашки cookie и всплывающие окна: жмём «Принять/Понятно», если есть
    await page.evaluate(() => {
      for (const b of document.querySelectorAll('button, a, [role=button]')) {
        if (/^(принять|согласен|понятно|хорошо|ok|accept|got it|закрыть)/i.test((b.innerText || '').trim()) && b.offsetWidth < 400) { try { b.click(); } catch { /* ничего */ } }
      }
    }).catch(() => {});
    // ленивые картинки грузятся только при прокрутке — пролистываем и возвращаемся наверх
    await page.evaluate(async H => { for (let y = 0; y < H; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } window.scrollTo(0, 0); }, MAX_H).catch(() => {});
    await page.waitForTimeout(900);
    const info = await page.evaluate(([re, H]) => {
      const rx = new RegExp(re, 'i'), out = [];
      for (const el of document.querySelectorAll('a, button, [role=button], input[type=submit]')) {
        const t = (el.innerText || el.value || '').trim().replace(/\s+/g, ' ');
        if (!t || t.length > 40 || !rx.test(t)) continue;
        const r = el.getBoundingClientRect(), st = getComputedStyle(el);
        if (r.width < 40 || r.height < 18 || st.visibility === 'hidden' || st.display === 'none' || +st.opacity < .2) continue;
        const y = r.top + window.scrollY; if (y > H - 60) continue;
        out.push({ x: r.left, y, w: r.width, h: r.height, label: t });
      }
      out.sort((a, b) => a.y - b.y);
      return { marks: out.slice(0, 2), title: document.title.slice(0, 80), height: Math.min(H, document.documentElement.scrollHeight) };
    }, [CTA, MAX_H]);
    await page.screenshot({ path: file, type: 'jpeg', quality: 78, fullPage: true, clip: { x: 0, y: 0, width: VIEW.width, height: Math.max(VIEW.height, info.height) } });
    return info;
  } finally { await ctx.close(); }
}

/** Снимает сайты для всех сцен «Экран» плана и вкладывает снимки в сцены (p.img, p.marks, p.imgH). */
export async function captureScreens(plan, dir, onStatus) {
  const scenes = plan.scenes.filter(s => s.type === 'screen' && s.p?.url);
  if (!scenes.length) return 0;
  let browser = null, ok = 0;
  try {
    for (const s of scenes) {
      const key = crypto.createHash('md5').update(s.p.url).digest('hex').slice(0, 10);
      const file = path.join(dir, `screen_${key}.jpg`), meta = file + '.json';
      let info = null;
      if (fs.existsSync(file) && fs.existsSync(meta)) info = JSON.parse(fs.readFileSync(meta, 'utf8'));
      else {
        onStatus?.(s.p.domain);
        const proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
        browser ||= await chromium.launch({ args: ['--no-sandbox'], ...(proxy ? { proxy: { server: proxy } } : {}) });
        try { info = await shoot(browser, s.p.url, file); fs.writeFileSync(meta, JSON.stringify(info)); }
        catch (e) { console.error('screen', s.p.url, e.message); continue; }
      }
      Object.assign(s.p, { img: dataUrl(file), imgH: info.height, marks: info.marks, title: info.title }); ok++;
    }
  } finally { if (browser) await browser.close(); }
  return ok;
}
