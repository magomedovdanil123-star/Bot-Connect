import assert from "node:assert/strict";
import test from "node:test";
import {
  calmCoinOverviewLongSoundPlan,
  MAX_COIN_OVERVIEW_LONG_SFX,
  selectCoinOverviewLongSfxAsset,
} from "./coin-overview-long-sfx";
import type { AudioAsset, SoundDesignPlan } from "./types";

function makeLongPlan(): SoundDesignPlan {
  const scenes = Array.from({ length: 60 }, (_unused, index) => ({
    scene_id: index + 1,
    start_time: index * 20_000,
    end_time: (index + 1) * 20_000,
    music: {
      enabled: true,
      mood: "calm" as const,
      energy: 0.2,
      category: "financial documentary",
      volume: 0.12,
    },
    sfx: [{
      type: index % 2 === 0 ? "scene transition" : "data marker",
      query: index % 2 === 0 ? "soft transition whoosh" : "subtle digital data tick",
      start_time: index * 20_000 + 10_000,
      volume: 0.38,
    }],
    ambience: {
      enabled: true,
      type: "room",
      query: "quiet room",
      volume: 0.05,
    },
  }));
  return {
    project_id: 1,
    overall: {
      mood: "calm",
      energy: 0.2,
      tension: 0.1,
      music_style: "financial documentary",
    },
    scenes,
  };
}

function makeAsset(input: {
  id: string;
  title: string;
  license: string;
  requiresAttribution: boolean;
}): AudioAsset {
  return {
    provider: "openverse:freesound",
    externalId: input.id,
    title: input.title,
    creator: null,
    sourceUrl: `https://example.test/${input.id}`,
    previewUrl: null,
    downloadUrl: `https://cdn.freesound.org/${input.id}.mp3`,
    license: input.license,
    licenseUrl: null,
    requiresAttribution: input.requiresAttribution,
    duration: 2_000,
    category: "sound effect",
    metadata: {},
  };
}

test("coin overview effects stay quiet, sparse, and distributed through a long video", () => {
  const plan = calmCoinOverviewLongSoundPlan(makeLongPlan());
  const cues = plan.scenes.flatMap((scene) => scene.sfx.map((cue) => ({
    ...cue,
    ambienceEnabled: scene.ambience.enabled,
  })));

  assert.ok(cues.length > 0);
  assert.ok(cues.length <= MAX_COIN_OVERVIEW_LONG_SFX);
  assert.ok(cues.at(-1)!.start_time > 1_000_000);
  assert.ok(cues.every((cue) => cue.volume <= 0.21 && !cue.ambienceEnabled));
  assert.ok(plan.scenes.every((scene) => scene.sfx.length <= 1));
});

test("coin overview selects distinct, matching CC0 effects and rejects gamey or attributed audio", () => {
  const assets = [
    makeAsset({ id: "attributed", title: "Deep Whoosh", license: "CC BY 4.0", requiresAttribution: true }),
    makeAsset({ id: "game", title: "Arcade game whoosh", license: "CC0 1.0", requiresAttribution: false }),
    makeAsset({ id: "voice", title: "A simple voice saying Whoosh", license: "CC0 1.0", requiresAttribution: false }),
    makeAsset({ id: "whoosh-1", title: "Deep Whoosh #1", license: "CC0 1.0", requiresAttribution: false }),
    makeAsset({ id: "whoosh-2", title: "Swipe Whoosh", license: "PDM", requiresAttribution: false }),
    makeAsset({ id: "8bit", title: "8-bit Soft Impact", license: "CC0 1.0", requiresAttribution: false }),
  ];
  const effect = {
    type: "scene transition",
    query: "soft cinematic transition whoosh",
    start_time: 5_000,
    volume: 0.18,
  };
  const used = new Set<string>();

  const first = selectCoinOverviewLongSfxAsset(assets, effect, used);
  const second = selectCoinOverviewLongSfxAsset(assets, effect, used);
  const third = selectCoinOverviewLongSfxAsset(assets, effect, used);

  assert.equal(first?.externalId, "whoosh-1");
  assert.equal(second?.externalId, "whoosh-2");
  assert.equal(third, undefined);

  const digital = selectCoinOverviewLongSfxAsset([
    makeAsset({ id: "game-click", title: "Game sound menu", license: "CC0 1.0", requiresAttribution: false }),
    makeAsset({ id: "beep", title: "beep beep", license: "CC0 1.0", requiresAttribution: false }),
    makeAsset({ id: "digital-life", title: "Digital life 1", license: "CC0 1.0", requiresAttribution: false }),
    makeAsset({ id: "processing", title: "Data Processing", license: "CC0 1.0", requiresAttribution: false }),
  ], {
    type: "data marker",
    query: "digital click",
    start_time: 15_000,
    volume: 0.18,
  }, new Set());
  assert.equal(digital?.externalId, "digital-life");
});