export type ProjectVisualMetadata = Record<string, unknown>;

export type VideoProjectVisualPolicy = {
  useHoroscopeVisualLibrary: boolean;
  bannerSource: "horoscope-nox" | "story-metadata" | null;
  bannerStoragePath: string | null;
  bannerKind: "image" | "video" | null;
};

const NON_STORY_VISUAL_METADATA_KEYS = [
  "story_banner_storage_path",
  "story_banner_kind",
  "story_channel_visual_pool_size",
  "story_channel_connection_id",
  "story_avatar_storage_path",
  "horoscope_nox_banner",
  "horoscope_visual_library_used",
  "horoscope_visual_library_kinds",
] as const;

export function resolveVideoProjectVisualPolicy(input: {
  isHoroscopeProject: boolean;
  isStoryProject: boolean;
  projectMetadata: ProjectVisualMetadata;
}): VideoProjectVisualPolicy {
  if (input.isHoroscopeProject) {
    return {
      useHoroscopeVisualLibrary: true,
      bannerSource: "horoscope-nox",
      bannerStoragePath: null,
      bannerKind: "video",
    };
  }

  if (input.isStoryProject && typeof input.projectMetadata.story_banner_storage_path === "string") {
    return {
      useHoroscopeVisualLibrary: false,
      bannerSource: "story-metadata",
      bannerStoragePath: input.projectMetadata.story_banner_storage_path,
      bannerKind: input.projectMetadata.story_banner_kind === "video" ? "video" : "image",
    };
  }

  return {
    useHoroscopeVisualLibrary: false,
    bannerSource: null,
    bannerStoragePath: null,
    bannerKind: null,
  };
}

export function removeNonStoryVisualMetadata(
  projectMetadata: ProjectVisualMetadata,
): ProjectVisualMetadata {
  const cleaned = { ...projectMetadata };
  for (const key of NON_STORY_VISUAL_METADATA_KEYS) {
    delete cleaned[key];
  }
  return cleaned;
}

export function hasNonStoryVisualMetadata(projectMetadata: ProjectVisualMetadata): boolean {
  return NON_STORY_VISUAL_METADATA_KEYS.some((key) => key in projectMetadata);
}