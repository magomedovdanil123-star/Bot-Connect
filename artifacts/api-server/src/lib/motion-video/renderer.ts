// Моушн-видео по сценарию: кадры рисует headless Chromium (canvas-движок из motion-engine/),
// забираем их через Chrome DevTools Protocol и кодируем ffmpeg. Без Playwright и X11.
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export type MotionScene = {
  text: string;
  type: string;
  start?: number;
  dur?: number;
  speak?: number;
  [key: string]: unknown;
};

export type MotionPlan = {
  title: string;
  main: string;
  mainSym: string;
  cps: number;
  scenes: MotionScene[];
};

type LoadedPlanInfo = {
  total: number;
  frames: number;
  scenes: Array<{ type: string; start: number; dur: number; text: string }>;
};

const FPS = 30;

export function motionEngineDir(): string {
  const candidates = [
    path.join(process.cwd(), "motion-engine"),
    path.join(process.cwd(), "artifacts", "api-server", "motion-engine"),
    fileURLToPath(new URL("../motion-engine", import.meta.url)),
    fileURLToPath(new URL("../../../motion-engine", import.meta.url)),
  ];
  const found = candidates.find((dir) => existsSync(path.join(dir, "index.html")));
  if (!found) throw new Error("Не найдена папка motion-engine с движком анимации.");
  return found;
}

export async function buildMotionPlan(script: string): Promise<MotionPlan> {
  const plannerUrl = pathToFileURL(path.join(motionEngineDir(), "planner.mjs")).href;
  const planner = (await import(plannerUrl)) as { buildPlan: (text: string) => MotionPlan };
  return planner.buildPlan(script);
}

function chromiumBinary(): string {
  const candidates = [
    process.env["CHROMIUM_BIN"],
    "/repl/tools/bin/chromium",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/google-chrome",
    "/opt/pw-browsers/chromium",
  ].filter((value): value is string => Boolean(value));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error("Chromium не найден. Укажите путь в переменной CHROMIUM_BIN.");
  return found;
}

// ---------- минимальный CDP-клиент ----------

type CdpResponse = { id?: number; result?: unknown; error?: { message: string }; method?: string };

class CdpConnection {
  private seq = 0;
  private readonly pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void }>();

  private constructor(private readonly ws: WebSocket) {
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (message.id === undefined) return;
      const waiter = this.pending.get(message.id);
      if (!waiter) return;
      this.pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message));
      else waiter.resolve(message.result);
    });
    ws.addEventListener("close", () => {
      for (const waiter of this.pending.values()) waiter.reject(new Error("Соединение с Chromium закрыто."));
      this.pending.clear();
    });
  }

  static async connect(url: string): Promise<CdpConnection> {
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      ws.addEventListener("open", () => resolve(), { once: true });
      ws.addEventListener("error", () => reject(new Error("Не удалось подключиться к Chromium.")), { once: true });
    });
    return new CdpConnection(ws);
  }

  send<T>(method: string, params: Record<string, unknown> = {}, sessionId?: string): Promise<T> {
    const id = ++this.seq;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { resolve: (value) => resolve(value as T), reject });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  close(): void {
    this.ws.close();
  }
}

class MotionPage {
  private constructor(
    private readonly browser: ChildProcess,
    private readonly cdp: CdpConnection,
    private readonly sessionId: string,
    private readonly profileDir: string,
  ) {}

  static async open(plan: MotionPlan): Promise<{ page: MotionPage; info: LoadedPlanInfo }> {
    const profileDir = await mkdtemp(path.join(os.tmpdir(), "motion-chrome-"));
    const browser = spawn(chromiumBinary(), [
      "--headless=new",
      "--no-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--mute-audio",
      "--force-color-profile=srgb",
      "--allow-file-access-from-files",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--window-size=1920,1080",
      "about:blank",
    ], { stdio: ["ignore", "ignore", "pipe"] });

    const wsUrl = await new Promise<string>((resolve, reject) => {
      let log = "";
      const timer = setTimeout(() => reject(new Error(`Chromium не запустился: ${log.slice(-500)}`)), 30_000);
      browser.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
        log += chunk;
        const match = /DevTools listening on (ws:\/\/\S+)/u.exec(log);
        if (match?.[1]) {
          clearTimeout(timer);
          resolve(match[1]);
        }
      });
      browser.once("exit", (code) => {
        clearTimeout(timer);
        reject(new Error(`Chromium завершился с кодом ${code}: ${log.slice(-500)}`));
      });
    });

    const cdp = await CdpConnection.connect(wsUrl);
    const { targetId } = await cdp.send<{ targetId: string }>("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send<{ sessionId: string }>("Target.attachToTarget", { targetId, flatten: true });
    const page = new MotionPage(browser, cdp, sessionId, profileDir);
    try {
      await cdp.send("Page.enable", {}, sessionId);
      await cdp.send("Page.navigate", { url: pathToFileURL(path.join(motionEngineDir(), "index.html")).href }, sessionId);
      const deadline = Date.now() + 30_000;
      while (!(await page.evaluate<boolean>("document.readyState === 'complete' && typeof window.loadPlan === 'function'"))) {
        if (Date.now() > deadline) throw new Error("Движок анимации не загрузился в Chromium.");
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      await page.evaluate("window.fontsReady()", true);
      const info = await page.evaluate<LoadedPlanInfo>(`window.loadPlan(${JSON.stringify(plan)})`);
      return { page, info };
    } catch (error) {
      await page.close();
      throw error;
    }
  }

  async evaluate<T>(expression: string, awaitPromise = false): Promise<T> {
    const response = await this.cdp.send<{
      result: { value?: unknown };
      exceptionDetails?: { text?: string; exception?: { description?: string } };
    }>("Runtime.evaluate", { expression, returnByValue: true, awaitPromise }, this.sessionId);
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || "Ошибка в движке анимации.");
    }
    return response.result.value as T;
  }

  async frameJpeg(frame: number): Promise<Buffer> {
    const dataUrl = await this.evaluate<string>(`window.grab(${frame}, 0.92)`);
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  }

  async close(): Promise<void> {
    this.cdp.close();
    if (!this.browser.killed) this.browser.kill("SIGTERM");
    await new Promise((resolve) => setTimeout(resolve, 300));
    await rm(this.profileDir, { recursive: true, force: true });
  }
}

// ---------- ffmpeg ----------

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let log = "";
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => { log += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg ${code}: ${log.slice(-800)}`))));
  });
}

export type MotionRenderOptions = {
  audioPath?: string;
  audioOffsetSeconds?: number;
  maxBytes?: number;
  workers?: number;
  onProgress?: (fraction: number) => void;
};

export type MotionRenderResult = {
  buffer: Buffer;
  durationSeconds: number;
  sceneCount: number;
};

export async function renderMotionVideo(plan: MotionPlan, options: MotionRenderOptions = {}): Promise<MotionRenderResult> {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "motion-video-"));
  const workers = Math.max(1, Math.min(options.workers ?? (Number(process.env["MOTION_RENDER_WORKERS"] || 0) || os.cpus().length), 6));
  try {
    const probe = await MotionPage.open(plan);
    const info = probe.info;
    await probe.page.close();
    const totalFrames = info.frames;
    const durationSeconds = totalFrames / FPS;
    const audioKbps = options.audioPath ? 128 : 0;
    const maxBytes = options.maxBytes ?? 47 * 1024 * 1024;
    const videoKbps = Math.max(400, Math.min(6_000, Math.floor((maxBytes * 8 * 0.94) / 1024 / durationSeconds - audioKbps)));
    const perWorker = Math.ceil(totalFrames / workers);
    let done = 0;

    const parts = await Promise.all(Array.from({ length: workers }, async (_unused, worker) => {
      const from = worker * perWorker;
      const to = Math.min(totalFrames, from + perWorker);
      if (from >= to) return undefined;
      const partPath = path.join(workDir, `part-${worker}.mp4`);
      const { page } = await MotionPage.open(plan);
      const encoder = spawn("ffmpeg", [
        "-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-",
        "-c:v", "libx264", "-preset", "medium", "-b:v", `${videoKbps}k`, "-maxrate", `${Math.round(videoKbps * 1.5)}k`,
        "-bufsize", `${videoKbps * 3}k`, "-tune", "animation", "-pix_fmt", "yuv420p", partPath,
      ], { stdio: ["pipe", "ignore", "pipe"] });
      let encoderLog = "";
      encoder.stderr?.setEncoding("utf8").on("data", (chunk: string) => { encoderLog += chunk; });
      const encoderExit = new Promise<number | null>((resolve) => encoder.once("exit", resolve));
      try {
        for (let frame = from; frame < to; frame++) {
          const jpeg = await page.frameJpeg(frame);
          if (!encoder.stdin?.write(jpeg)) await new Promise((resolve) => encoder.stdin?.once("drain", resolve));
          done++;
          if (done % 60 === 0) options.onProgress?.(done / totalFrames);
        }
      } finally {
        encoder.stdin?.end();
        await page.close();
      }
      const code = await encoderExit;
      if (code !== 0) throw new Error(`ffmpeg не смог закодировать кадры: ${encoderLog.slice(-800)}`);
      return partPath;
    }));

    const listPath = path.join(workDir, "parts.txt");
    await writeFile(listPath, parts.filter(Boolean).map((part) => `file '${part}'`).join("\n"));
    const output = path.join(workDir, "motion.mp4");
    const args = ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listPath];
    if (options.audioPath) {
      args.push("-itsoffset", String(options.audioOffsetSeconds ?? 0), "-i", options.audioPath,
        "-map", "0:v", "-map", "1:a", "-c:a", "aac", "-b:a", `${audioKbps}k`, "-shortest");
    }
    args.push("-c:v", "copy", "-movflags", "+faststart", output);
    await runFfmpeg(args);
    options.onProgress?.(1);
    const size = (await stat(output)).size;
    if (!size) throw new Error("ffmpeg создал пустой файл.");
    return { buffer: await readFile(output), durationSeconds, sceneCount: info.scenes.length };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
