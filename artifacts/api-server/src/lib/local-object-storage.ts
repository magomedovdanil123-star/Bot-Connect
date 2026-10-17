// Локальная замена объектного хранилища Replit для запуска на обычном сервере (VPS / Docker).
// Включается переменной OBJECT_STORAGE_DIR: файлы лежат в <OBJECT_STORAGE_DIR>/<bucket>/<object>,
// метаданные — рядом в <object>.meta.json. Повторяет ту часть API @google-cloud/storage, которой пользуется бот.
// Подписанные ссылки (GET/PUT) ведут на /api/storage/local/:token и проверяются HMAC-подписью (SESSION_SECRET).
import { createHmac, timingSafeEqual } from "crypto";
import fs from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import type { Readable } from "stream";

const ROOT = () => path.resolve(process.env.OBJECT_STORAGE_DIR || "./object-storage");

function safeJoin(bucket: string, object: string): string {
  const full = path.resolve(ROOT(), bucket, object);
  if (!full.startsWith(ROOT() + path.sep)) throw new Error("Invalid object path");
  return full;
}

type Meta = { contentType?: string; cacheControl?: string; metadata?: Record<string, string>; size?: number };

export class LocalFile {
  constructor(public bucket: { name: string }, public name: string) {}
  private get filePath() { return safeJoin(this.bucket.name, this.name); }
  private get metaPath() { return this.filePath + ".meta.json"; }
  private readMeta(): Meta { try { return JSON.parse(fs.readFileSync(this.metaPath, "utf8")); } catch { return {}; } }
  private writeMeta(m: Meta) { fs.writeFileSync(this.metaPath, JSON.stringify(m)); }

  async save(data: Buffer | string, opts: { metadata?: Meta; contentType?: string } = {}): Promise<void> {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    await fs.promises.writeFile(this.filePath, data);
    const m = opts.metadata || {};
    this.writeMeta({ ...this.readMeta(), ...m, contentType: m.contentType || opts.contentType || this.readMeta().contentType });
  }
  async download(): Promise<[Buffer]> {
    try { return [await fs.promises.readFile(this.filePath)]; }
    catch { throw Object.assign(new Error(`No such object: ${this.bucket.name}/${this.name}`), { code: 404 }); }
  }
  createReadStream(): Readable { return fs.createReadStream(this.filePath); }
  async exists(): Promise<[boolean]> { return [fs.existsSync(this.filePath)]; }
  async delete(opts: { ignoreNotFound?: boolean } = {}): Promise<void> {
    try { await fs.promises.unlink(this.filePath); } catch (e) { if (!opts.ignoreNotFound) throw e; }
    fs.rmSync(this.metaPath, { force: true });
  }
  async getMetadata(): Promise<[Meta & { name: string; bucket: string }]> {
    const st = await fs.promises.stat(this.filePath).catch(() => null);
    if (!st) throw Object.assign(new Error(`No such object: ${this.bucket.name}/${this.name}`), { code: 404 });
    return [{ ...this.readMeta(), size: st.size, name: this.name, bucket: this.bucket.name }];
  }
  async setMetadata(update: Meta): Promise<void> {
    const cur = this.readMeta();
    this.writeMeta({ ...cur, ...update, metadata: { ...(cur.metadata || {}), ...(update.metadata || {}) } });
  }
  /** Запись из потока (для загрузок по подписанной ссылке). */
  async saveStream(stream: Readable, contentType?: string): Promise<void> {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    await pipeline(stream, fs.createWriteStream(this.filePath));
    if (contentType) this.writeMeta({ ...this.readMeta(), contentType });
  }
}

export const localStorageClient = {
  bucket(name: string) {
    const b = { name };
    return { name, file: (object: string) => new LocalFile(b, object) };
  },
};

// ---------- подписанные ссылки ----------
function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is required to sign local storage links");
  return s;
}
const b64 = (s: string) => Buffer.from(s).toString("base64url");
function sign(payload: string): string { return createHmac("sha256", secret()).update(payload).digest("base64url"); }

export function signLocalObjectURL({ bucketName, objectName, method, ttlSec }: { bucketName: string; objectName: string; method: string; ttlSec: number }): string {
  const base = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
  if (!base) throw new Error("PUBLIC_APP_URL is required for download links (e.g. http://<server-ip>:8080)");
  const payload = b64(JSON.stringify({ b: bucketName, o: objectName, m: method, e: Date.now() + ttlSec * 1000 }));
  return `${base}/api/storage/local/${payload}.${sign(payload)}`;
}

export function verifyLocalToken(token: string, method: string): LocalFile | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload)), got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const p = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { b: string; o: string; m: string; e: number };
  if (p.m !== method || Date.now() > p.e) return null;
  return localStorageClient.bucket(p.b).file(p.o);
}
