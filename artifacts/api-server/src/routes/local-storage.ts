// Отдача и приём файлов локального хранилища по подписанным ссылкам (только при OBJECT_STORAGE_DIR).
import { Router, type IRouter } from "express";
import { verifyLocalToken } from "../lib/local-object-storage";

const router: IRouter = Router();

router.get("/storage/local/:token", async (req, res) => {
  const file = verifyLocalToken(req.params.token, "GET");
  if (!file) { res.status(403).json({ error: "Link expired or invalid" }); return; }
  const [exists] = await file.exists();
  if (!exists) { res.status(404).json({ error: "Not found" }); return; }
  const [meta] = await file.getMetadata();
  res.setHeader("Content-Type", meta.contentType || "application/octet-stream");
  if (meta.size) res.setHeader("Content-Length", String(meta.size));
  res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.name.split("/").pop() || "file")}"`);
  file.createReadStream().on("error", () => res.end()).pipe(res);
});

router.put("/storage/local/:token", async (req, res) => {
  const file = verifyLocalToken(req.params.token, "PUT");
  if (!file) { res.status(403).json({ error: "Link expired or invalid" }); return; }
  try { await file.saveStream(req, req.headers["content-type"]); res.status(200).end(); }
  catch (e) { res.status(500).json({ error: String((e as Error).message) }); }
});

export default router;
