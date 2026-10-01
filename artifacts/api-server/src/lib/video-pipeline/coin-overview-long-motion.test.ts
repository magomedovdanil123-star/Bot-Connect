import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";
import {
  buildCoinOverviewLongSceneClipDurations,
  buildCoinOverviewLongCameraFilter,
  buildCoinOverviewLongMotionGraphics,
} from "./coin-overview-long-motion";

const execFileAsync = promisify(execFile);

test("coin long overview selects scene-relevant visual sketches", () => {
  const network = buildCoinOverviewLongMotionGraphics({
    width: 640,
    height: 360,
    durationSeconds: 12,
    voiceText: "Как устроены сеть и транзакции проекта",
    sceneIndex: 0,
  });
  const timeline = buildCoinOverviewLongMotionGraphics({
    width: 640,
    height: 360,
    durationSeconds: 12,
    voiceText: "История запуска и развития проекта",
    sceneIndex: 0,
  });

  assert.match(network, /drawbox=/);
  assert.notEqual(network, timeline);
  assert.match(network, /0x70dec8@0\.62/);
  assert.match(timeline, /0xe6bd70@0\.66/);
});

test("coin long overview visuals cover narration gaps and the full mixed-audio tail", () => {
  const targetDurationMs = 20_000;
  const transitionDurationMs = 140;
  const clipDurations = buildCoinOverviewLongSceneClipDurations({
    sceneIds: [1, 2, 3],
    voices: [
      { sceneId: 1, startTime: 0, endTime: 5_000 },
      { sceneId: 2, startTime: 7_000, endTime: 12_000 },
      { sceneId: 3, startTime: 14_000, endTime: 19_000 },
    ],
    durationMs: targetDurationMs,
    transitionDurationMs,
  });

  assert.deepEqual(clipDurations, [7_140, 7_140, 6_000]);
  assert.equal(
    clipDurations.reduce((sum, duration) => sum + duration, 0) - transitionDurationMs * 2,
    targetDurationMs,
  );
});

test("coin long overview motion filters are accepted by FFmpeg", async () => {
  const width = 640;
  const height = 360;
  const graphics = buildCoinOverviewLongMotionGraphics({
    width,
    height,
    durationSeconds: 12,
    voiceText: "История сети, рыночный риск и изменения цены",
    sceneIndex: 2,
  });
  const camera = buildCoinOverviewLongCameraFilter({
    width,
    height,
    frames: 45,
    sceneIndex: 2,
  });

  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=black:s=${width}x${height}:r=30:d=1.5`,
    "-vf", graphics,
    "-frames:v", "30",
    "-f", "null", "-",
  ]);
  await execFileAsync("ffmpeg", [
    "-hide_banner",
    "-loglevel", "error",
    "-f", "lavfi",
    "-i", `color=c=black:s=${width}x${height}:r=30:d=1.5`,
    "-vf", camera,
    "-frames:v", "30",
    "-f", "null", "-",
  ]);

  assert.match(camera, /zoompan=/);
});