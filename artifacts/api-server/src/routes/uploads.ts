import { Router, type IRouter, type Request, type Response } from "express";
import { storeAudioAsset } from "../lib/audio-design/storage";
import { prepareYoutubePublicationForStorage } from "../lib/telegram-bot";
import { consumeLargeVideoUploadToken, verifyLargeVideoUploadToken } from "../lib/large-video-upload";

const router: IRouter = Router();
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

function tokenParam(req: Request): string {
  const value = req.params.token;
  return Array.isArray(value) ? value[0] : value;
}

function page(token: string): string {
  const escaped = token.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
  return `<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Загрузка ролика</title><style>body{font-family:system-ui;max-width:560px;margin:12vh auto;padding:24px;background:#101114;color:#f4f4f5}main{background:#1b1d22;border:1px solid #343740;border-radius:18px;padding:28px}input,button{width:100%;box-sizing:border-box;padding:14px;border-radius:10px;margin-top:14px}button{background:#7c5cff;color:white;border:0;font-weight:700}progress{width:100%;margin-top:18px}#status{margin-top:18px;line-height:1.5}</style><main><h1>Загрузка ролика для SEO</h1><p>Выберите видео. Файл отправится напрямую в хранилище, поэтому лимит Telegram 20 МБ не применяется.</p><input id="file" type="file" accept="video/*"><button id="go">Загрузить ролик</button><progress id="progress" value="0" max="100" hidden></progress><div id="status"></div></main><script>const token="${escaped}",file=document.getElementById("file"),go=document.getElementById("go"),p=document.getElementById("progress"),s=document.getElementById("status");go.onclick=()=>{if(!file.files[0]){s.textContent="Выберите видео.";return}const x=new XMLHttpRequest();x.open("POST","/api/upload/"+token+"/file");x.upload.onprogress=e=>{if(e.lengthComputable){p.hidden=false;p.value=e.loaded/e.total*100;s.textContent="Загружено "+Math.round(p.value)+"%"}};x.onload=()=>{try{const d=JSON.parse(x.responseText);s.textContent=x.status<300?d.message||"Готово. Проверьте Telegram.":d.error||"Ошибка загрузки"}catch{s.textContent="Ошибка ответа сервера"}};x.onerror=()=>s.textContent="Не удалось загрузить файл.";x.setRequestHeader("Content-Type",file.files[0].type||"application/octet-stream");x.send(file.files[0])}</script></html>`;
}

router.get("/upload/:token", (req: Request, res: Response) => {
  try {
    const token = tokenParam(req);
    verifyLargeVideoUploadToken(token);
    res.type("html").send(page(token));
  } catch (error) {
    res.status(410).send(error instanceof Error ? error.message : "Upload link expired");
  }
});

router.post("/upload/:token/file", (req: Request, res: Response) => {
  void (async () => {
    try {
      const payload = consumeLargeVideoUploadToken(tokenParam(req));
      const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body);
      if (!buffer.length) throw new Error("Файл пустой.");
      if (buffer.length > MAX_UPLOAD_BYTES) throw new Error("Максимальный размер файла — 2 ГБ.");
      const videoStoragePath = await storeAudioAsset(buffer, "video", req.headers["content-type"] || "video/mp4", "mp4");
      await prepareYoutubePublicationForStorage(
        process.env["TELEGRAM_BOT_TOKEN"] || "",
        payload.chatId,
        videoStoragePath,
        payload.fileName.replace(/\.(mp4|mov|mkv|webm)$/iu, "").replace(/[_-]+/g, " ").trim() || "Готовый ролик",
        payload.caption || "Готовый ролик для публикации на YouTube Shorts.",
        payload.caption || payload.fileName,
        0,
      );
      res.json({ ok: true, message: "Ролик загружен. SEO и обложка отправлены в Telegram." });
    } catch (error) {
      res.status(400).json({ error: error instanceof Error ? error.message : "Не удалось обработать ролик" });
    }
  })();
});

export default router;