import type { AudioAsset, SoundDesignPlan } from "./types";

export const MAX_COIN_OVERVIEW_LONG_SFX = 18;
const MIN_COIN_OVERVIEW_SFX_SPACING_MS = 30_000;

export function calmCoinOverviewLongSoundPlan(plan: SoundDesignPlan): SoundDesignPlan {
  const firstSceneStart = plan.scenes[0]?.start_time || 0;
  const lastSceneEnd = plan.scenes.at(-1)?.end_time || firstSceneStart;
  const projectDuration = Math.max(0, lastSceneEnd - firstSceneStart);
  const distributedSpacing = projectDuration > 0
    ? Math.ceil(projectDuration / Math.max(1, MAX_COIN_OVERVIEW_LONG_SFX - 1))
    : MIN_COIN_OVERVIEW_SFX_SPACING_MS;
  const cueSpacing = Math.max(MIN_COIN_OVERVIEW_SFX_SPACING_MS, distributedSpacing);
  let lastCueAt = Number.NEGATIVE_INFINITY;
  let lastCueType = "";
  let acceptedCues = 0;

  return {
    ...plan,
    scenes: plan.scenes.map((scene) => {
      const candidates = [...scene.sfx].sort((left, right) => left.start_time - right.start_time);
      const cue = acceptedCues < MAX_COIN_OVERVIEW_LONG_SFX
        ? candidates.find((candidate) =>
          candidate.start_time - lastCueAt >= cueSpacing
          && candidate.type.trim().toLocaleLowerCase("en-US") !== lastCueType)
        : undefined;
      const ambience = { ...scene.ambience, enabled: false };
      if (!cue) return { ...scene, sfx: [], ambience };
      lastCueAt = cue.start_time;
      lastCueType = cue.type.trim().toLocaleLowerCase("en-US");
      acceptedCues += 1;
      return {
        ...scene,
        sfx: [{ ...cue, volume: Math.min(cue.volume, 0.21) }],
        ambience,
      };
    }),
  };
}

export function selectCoinOverviewLongSfxAsset(
  assets: AudioAsset[],
  effect: SoundDesignPlan["scenes"][number]["sfx"][number],
  usedAssetIds: Set<string>,
): AudioAsset | undefined {
  const queryAndType = `${effect.type} ${effect.query}`.toLocaleLowerCase("en-US");
  const titleMatchers = /whoosh|swish|swoosh|sweep|transition|air/i.test(queryAndType)
    ? /whoosh|swish|swoosh|sweep|transition|air/i
    : /pencil|paper|draw|scribbl|writing|write/i.test(queryAndType)
      ? /pencil|paper|draw|scribbl|writing|write/i
    : /impact|thump|thud|low accent|muted/i.test(queryAndType)
        ? /impact|thump|thud|soft hit|low hit|subtle|light/i
        : /pulse|network|data|digital|tick|click/i.test(queryAndType)
          ? /puls|network|data|digital|tick|click|process|interface|gui/i
          : null;
  if (!titleMatchers) return undefined;

  const selected = assets.find((asset) => {
    const license = asset.license.trim().toUpperCase().split(/\s+/)[0];
    if (!["CC0", "PDM"].includes(license) || asset.requiresAttribution) return false;
    const title = `${asset.title} ${asset.category}`;
    if (/game|arcade|cartoon|casino|jackpot|cash|register|coin|money|bell|chime|alarm|siren|beep|notification|alert|8.?bit|pixel|laser|weapon|explosion|scream|voice|spoken|speech|saying/i.test(title)
      || /\b(car|vehicle|radio)\b/i.test(title)) {
      return false;
    }
    return titleMatchers.test(title) && !usedAssetIds.has(`${asset.provider}:${asset.externalId}`);
  });
  if (selected) usedAssetIds.add(`${selected.provider}:${selected.externalId}`);
  return selected;
}