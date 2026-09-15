import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  generateSpeech,
  getConfiguredVoiceId,
  getElevenLabsModel,
  prepareSpeechText,
} from "./audio-generation/elevenlabs-client";
import { readAudioAsset, storeAudioAsset } from "./audio-design/storage";
import { ensureYoutubeBrandMarkers, type YoutubeMetadata } from "./youtube";

const execFileAsync = promisify(execFile);

type ChannelStyle = {
  contrast: number;
  saturation: number;
  brightness: number;
  hue: number;
  speed: number;
  hook: string;
  musicTag: string;
  mirror: boolean;
  accentFrequency: number;
};

const CHANNEL_STYLES: ChannelStyle[] = [
  { contrast: 1.04, saturation: 1.08, brightness: 0.01, hue: 0, speed: 0.98, hook: "Главное — что произошло дальше", musicTag: "story", mirror: false, accentFrequency: 220 },
  { contrast: 1.1, saturation: 1.2, brightness: 0.02, hue: 3, speed: 1.02, hook: "Эта история началась обычно", musicTag: "energetic", mirror: true, accentFrequency: 247 },
  { contrast: 1.02, saturation: 0.92, brightness: -0.01, hue: -3, speed: 0.95, hook: "Такого поворота никто не ожидал", musicTag: "cinematic", mirror: false, accentFrequency: 277 },
  { contrast: 1.08, saturation: 1.28, brightness: 0.015, hue: 6, speed: 1.04, hook: "Один момент изменил весь день", musicTag: "bright", mirror: false, accentFrequency: 294 },
  { contrast: 0.98, saturation: 1.05, brightness: -0.015, hue: -6, speed: 0.93, hook: "Сначала всё выглядело нормально", musicTag: "documentary", mirror: true, accentFrequency: 330 },
  { contrast: 1.06, saturation: 1.14, brightness: 0.005, hue: 10, speed: 1.01, hook: "Вот чем закончилась эта ситуация", musicTag: "tension", mirror: false, accentFrequency: 349 },
  { contrast: 1.12, saturation: 1.0, brightness: 0.025, hue: -10, speed: 1.06, hook: "Редко увидишь такое в обычной доставке", musicTag: "fast", mirror: false, accentFrequency: 392 },
  { contrast: 1.0, saturation: 1.22, brightness: -0.005, hue: 14, speed: 0.97, hook: "История, которую хочется досмотреть", musicTag: "warm", mirror: true, accentFrequency: 440 },
  { contrast: 1.07, saturation: 0.96, brightness: 0.018, hue: -14, speed: 1.03, hook: "Необычный заказ привёл к неожиданной встрече", musicTag: "mystery", mirror: false, accentFrequency: 494 },
  { contrast: 1.03, saturation: 1.16, brightness: 0, hue: 18, speed: 0.99, hook: "Один день — одна история — один вывод", musicTag: "reflective", mirror: false, accentFrequency: 523 },
  { contrast: 1.09, saturation: 1.1, brightness: -0.01, hue: 22, speed: 1.05, hook: "Казалось бы, обычная поездка", musicTag: "urban", mirror: false, accentFrequency: 587 },
  { contrast: 1.01, saturation: 1.26, brightness: 0.012, hue: -22, speed: 0.96, hook: "Финал этой истории удивил всех", musicTag: "surprise", mirror: true, accentFrequency: 622 },
  { contrast: 1.05, saturation: 1.03, brightness: 0.02, hue: 26, speed: 1.0, hook: "Что скрывалось за этим заказом", musicTag: "investigation", mirror: false, accentFrequency: 659 },
  { contrast: 1.11, saturation: 1.18, brightness: -0.02, hue: -26, speed: 1.07, hook: "Эта встреча точно была не случайной", musicTag: "dramatic", mirror: false, accentFrequency: 698 },
  { contrast: 1.02, saturation: 1.09, brightness: 0.008, hue: 30, speed: 0.94, hook: "Самая неожиданная часть — в конце", musicTag: "cliffhanger", mirror: true, accentFrequency: 740 },
];

type ProbeResult = {
  streams?: Array<{ codec_type?: string; duration?: string }>;
  format?: { duration?: string };
};

async function probeVideo(filePath: string): Promise<{ duration: number; hasAudio: boolean }> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,duration:format=duration",
    "-of", "json",
    filePath,
  ]);
  const probe = JSON.parse(stdout) as ProbeResult;
  const duration = Number.parseFloat(
    probe.format?.duration
      || probe.streams?.find((stream) => stream.codec_type === "video")?.duration
      || "0",
  );
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new Error("Не удалось определить длительность варианта канала.");
  }
  return {
    duration,
    hasAudio: Boolean(probe.streams?.some((stream) => stream.codec_type === "audio")),
  };
}

function escapeDrawtext(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(":", "\\:")
    .replaceAll("'", "\\'");
}

function styleForChannel(connectionId: number): ChannelStyle {
  return CHANNEL_STYLES[Math.abs(connectionId) % CHANNEL_STYLES.length]!;
}

function channelGreeting(channelTitle: string): string {
  const safeTitle = channelTitle.trim() || "этот канал";
  return `Всем привет! С вами канал ${safeTitle}.`;
}

export function buildChannelMetadataVariant(
  metadata: YoutubeMetadata,
  channelTitle: string,
  connectionId: number,
): YoutubeMetadata {
  const style = styleForChannel(connectionId);
  const baseTitle = metadata.title.trim() || "История, которую стоит досмотреть";
  const title = `${style.hook}: ${baseTitle}`.slice(0, 100);
  const channelLead = `На канале «${channelTitle || "AI Content Factory"}» — новая история с неожиданным развитием.`;
  const description = ensureYoutubeBrandMarkers(
    `${channelLead}\n\n${metadata.description.trim()}`,
  );
  const channelTag = channelTitle
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/giu, " ")
    .trim();
  return {
    title,
    description,
    tags: [...new Set([...(metadata.tags || []), channelTag, style.musicTag])].filter(Boolean).slice(0, 30),
    hashtags: metadata.hashtags,
  };
}

export async function createYoutubeChannelVariant(params: {
  sourceStoragePath: string;
  channelTitle: string;
  connectionId: number;
  voiceId?: string | null;
}): Promise<string> {
  const source = await readAudioAsset(params.sourceStoragePath);
  if (!source.length) throw new Error("Исходное видео канала пустое.");

  const style = styleForChannel(params.connectionId);
  const greeting = channelGreeting(params.channelTitle);
  const voiceId = params.voiceId || getConfiguredVoiceId();
  if (!voiceId) {
    throw new Error("Для приветствия канала не настроен голос.");
  }

  const introAudio = await generateSpeech(
    prepareSpeechText(greeting),
    voiceId,
    getElevenLabsModel(),
    {
      speed: style.speed,
      stability: 0.48,
      similarity: 0.78,
      style: 0.24,
      speakerBoost: true,
    },
  );

  const dir = await mkdtemp(join(tmpdir(), "youtube-channel-variant-"));
  const sourcePath = join(dir, "source.mp4");
  const introPath = join(dir, "intro.mp3");
  const outputPath = join(dir, "variant.mp4");
  try {
    await writeFile(sourcePath, source);
    await writeFile(introPath, introAudio);
    const sourceProbe = await probeVideo(sourcePath);
    const introProbe = await probeVideo(introPath);
    const introDuration = Math.max(0.5, introProbe.duration);
    const bodyDuration = Math.max(0.5, sourceProbe.duration - introDuration);
    const totalDuration = sourceProbe.duration;
    const escapedGreeting = escapeDrawtext(greeting);
    const videoEffects = [
      style.mirror ? "hflip" : "",
      `eq=contrast=${style.contrast}:saturation=${style.saturation}:brightness=${style.brightness}`,
      `hue=h=${style.hue}`,
      "format=yuv420p",
    ].filter(Boolean).join(",");
    const videoFilter = [
      `[0:v]${videoEffects}[bodySource]`,
      `[bodySource]trim=duration=${bodyDuration.toFixed(3)},setpts=PTS-STARTPTS,`
        + `tpad=start_mode=clone:start_duration=${introDuration.toFixed(3)},`
        + `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.22:t=fill:enable='between(t,0,${introDuration.toFixed(3)})',`
        + `drawtext=text='${escapedGreeting}':fontcolor=white:fontsize=48:`
        + "x=(w-text_w)/2:y=h*0.12:box=1:boxcolor=black@0.52:boxborderw=22:"
        + `enable='between(t,0,${introDuration.toFixed(3)})'[video]`,
    ];
    const audioFilter = sourceProbe.hasAudio
      ? [
          `[1:a]atrim=duration=${introDuration.toFixed(3)},asetpts=PTS-STARTPTS[introBase]`,
          `sine=frequency=${style.accentFrequency}:duration=0.24,volume=0.18,afade=t=out:st=0.12:d=0.12[accent]`,
          "[introBase][accent]amix=inputs=2:duration=first:dropout_transition=0[introAudio]",
          `[0:a]atrim=duration=${bodyDuration.toFixed(3)},asetpts=PTS-STARTPTS[bodyAudio]`,
          "[introAudio][bodyAudio]concat=n=2:v=0:a=1[audio]",
        ]
      : [
          `[1:a]atrim=duration=${introDuration.toFixed(3)},asetpts=PTS-STARTPTS[introBase]`,
          `sine=frequency=${style.accentFrequency}:duration=0.24,volume=0.18,afade=t=out:st=0.12:d=0.12[accent]`,
          "[introBase][accent]amix=inputs=2:duration=first:dropout_transition=0[introAudio]",
          `anullsrc=channel_layout=stereo:sample_rate=44100,atrim=duration=${bodyDuration.toFixed(3)}[bodyAudio]`,
          "[introAudio][bodyAudio]concat=n=2:v=0:a=1[audio]",
        ];
    await execFileAsync("ffmpeg", [
      "-y",
      "-i", sourcePath,
      "-i", introPath,
      "-filter_complex", [...videoFilter, ...audioFilter].join(";"),
      "-map", "[video]",
      "-map", "[audio]",
      "-t", totalDuration.toFixed(3),
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "20",
      "-maxrate", "2600k",
      "-bufsize", "5200k",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-b:a", "160k",
      "-movflags", "+faststart",
      outputPath,
    ], { timeout: 15 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 });
    const output = await readFile(outputPath);
    if (!output.length) throw new Error("FFmpeg не создал вариант канала.");
    return storeAudioAsset(output, "video", "video/mp4", "mp4");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export function listChannelStyleCount(): number {
  return CHANNEL_STYLES.length;
}