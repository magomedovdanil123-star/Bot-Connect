import assert from "node:assert/strict";
import test from "node:test";
import {
  hasNonStoryVisualMetadata,
  removeNonStoryVisualMetadata,
  resolveVideoProjectVisualPolicy,
} from "./project-visual-policy";

test("a financial project ignores story and horoscope metadata", () => {
  const policy = resolveVideoProjectVisualPolicy({
    isHoroscopeProject: false,
    isStoryProject: false,
    projectMetadata: {
      story_banner_storage_path: "old/nox-banner.mp4",
      story_banner_kind: "video",
      horoscope_nox_banner: true,
      horoscope_visual_library_used: true,
    },
  });

  assert.deepEqual(policy, {
    useHoroscopeVisualLibrary: false,
    bannerSource: null,
    bannerStoragePath: null,
    bannerKind: null,
  });
});

test("only an explicitly linked story project can use its saved banner", () => {
  const storyPolicy = resolveVideoProjectVisualPolicy({
    isHoroscopeProject: false,
    isStoryProject: true,
    projectMetadata: {
      story_banner_storage_path: "story/channel-banner.png",
      story_banner_kind: "image",
    },
  });
  const unlinkedPolicy = resolveVideoProjectVisualPolicy({
    isHoroscopeProject: false,
    isStoryProject: false,
    projectMetadata: {
      story_banner_storage_path: "story/channel-banner.png",
      story_banner_kind: "image",
    },
  });

  assert.equal(storyPolicy.bannerSource, "story-metadata");
  assert.equal(storyPolicy.bannerStoragePath, "story/channel-banner.png");
  assert.equal(storyPolicy.bannerKind, "image");
  assert.equal(unlinkedPolicy.bannerStoragePath, null);
});

test("horoscope workflow is explicit and keeps its dedicated NOX banner path", () => {
  const policy = resolveVideoProjectVisualPolicy({
    isHoroscopeProject: true,
    isStoryProject: false,
    projectMetadata: { story_banner_storage_path: "ignored/story.png" },
  });

  assert.equal(policy.useHoroscopeVisualLibrary, true);
  assert.equal(policy.bannerSource, "horoscope-nox");
  assert.equal(policy.bannerKind, "video");
  assert.equal(policy.bannerStoragePath, null);
});

test("legacy visual metadata is removed without changing unrelated project fields", () => {
  const metadata = {
    title: "PUMP review",
    scenes: [{ scene_number: 1 }],
    story_banner_storage_path: "old/nox-banner.mp4",
    story_banner_kind: "video",
    horoscope_visual_library_used: true,
  };

  const cleaned = removeNonStoryVisualMetadata(metadata);

  assert.equal(hasNonStoryVisualMetadata(metadata), true);
  assert.equal(hasNonStoryVisualMetadata(cleaned), false);
  assert.deepEqual(cleaned, {
    title: "PUMP review",
    scenes: [{ scene_number: 1 }],
  });
});