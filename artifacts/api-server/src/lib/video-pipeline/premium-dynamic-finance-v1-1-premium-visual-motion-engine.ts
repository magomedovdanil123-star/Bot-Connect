import type { KineticSubtitleWord } from "./longform-kinetic-subtitles";
import type { LongformVisualBeat } from "./longform-visual-director";
import type { PremiumDynamicFinanceV1_1SemanticEvent } from "./premium-dynamic-finance-v1-1-semantic-director";
import type { LongformVisualMotionTreatment } from "./longform-visual-renderer";

type MotionCue = {
  word: string;
  startMs: number;
};

export type PremiumVisualMotionAuditEvent = {
  beatIndex: number;
  sceneId: number;
  semanticType: PremiumDynamicFinanceV1_1SemanticEvent["semanticType"];
  entrance: string;
  movement: string;
  reactionWord: string | null;
  reactionStartMs: number | null;
  exit: string;
  transition: string | null;
  animatedCounter: string | null;
};

export type PremiumVisualMotionSceneTransition = {
  fromSceneId: number;
  toSceneId: number;
  from: string;
  to: string;
  type: string;
};

export type PremiumVisualMotionAudit = {
  engine: "PremiumVisualMotionEngine";
  sceneCount: number;
  beatCount: number;
  appliedAnimationTypes: string[];
  sceneTransitions: PremiumVisualMotionSceneTransition[];
  events: PremiumVisualMotionAuditEvent[];
};

type PlannedBeat = {
  entrance: string;
  movement: string;
  exit: string;
  isSceneStart: boolean;
  isSceneEnd: boolean;
  reactionCue: MotionCue | null;
  counterCue: MotionCue | null;
  counterValue: number | null;
  counterHold: boolean;
  omitStaticMarketCapValue: boolean;
};

const ENTRANCE_BY_TYPE: Record<PremiumDynamicFinanceV1_1SemanticEvent["semanticType"], string> = {
  "genesis-history": "timeline_horizontal_reveal",
  "price-history": "chart_draw_on",
  "measured-rise": "chart_draw_on_with_acceleration",
  "measured-drawdown": "descending_line_reveal_with_endpoint_impact",
  "market-cap": "scale_in_with_sourced_number_counter",
  "bitcoin-comparison": "matched_period_axis_and_bars_reveal",
  "media-noise": "masked_fragment_slide",
  community: "nodes_fade_in_connections_draw",
  blockchain: "block_chain_trace_and_node_reveal",
  conclusion: "risk_frame_camera_settle",
};

const EXIT_BY_TYPE: Record<PremiumDynamicFinanceV1_1SemanticEvent["semanticType"], string> = {
  "genesis-history": "timeline_point_camera_push",
  "price-history": "zoom_through_final_chart_point",
  "measured-rise": "endpoint_punch_to_next_chart",
  "measured-drawdown": "descending_whip_to_value_frame",
  "market-cap": "counter_resolves_to_light_wipe",
  "bitcoin-comparison": "matched_axis_sweeps_out",
  "media-noise": "fragment_lanes_collapse",
  community: "connections_contract_to_next_scene",
  blockchain: "chain_trace_pushes_forward",
  conclusion: "risk_frame_closes_without_fade",
};

const KEYWORD_BY_TYPE: Record<PremiumDynamicFinanceV1_1SemanticEvent["semanticType"], RegExp> = {
  "genesis-history": /^(2013|генезис|историческ)/u,
  "price-history": /^(цена|значение|источником)/u,
  "measured-rise": /^(восходящ|рост|измеренн)/u,
  "measured-drawdown": /^(нисходящ|снижен|снижение)/u,
  "market-cap": /^(капитализац|рынок|обращающ)/u,
  "bitcoin-comparison": /^(биткоин|сравним|одинаков)/u,
  "media-noise": /^(шум|заголов|мем)/u,
  community: /^(сообществ|проекты|аудитори)/u,
  blockchain: /^(блокчейн|блоков|узлов)/u,
  conclusion: /^(история|риск|проверяйте)/u,
};

const TRANSITION_BY_PAIR: Record<string, string> = {
  "measured-rise>measured-drawdown": "endpoint-punch → descending chart wipe",
  "measured-drawdown>market-cap": "chart line resolves into scale-in counter",
  "market-cap>bitcoin-comparison": "counter pulls back into matched-period bars",
  "bitcoin-comparison>media-noise": "comparison axis wipes into masked fragments",
  "media-noise>community": "editorial fragments settle into connected nodes",
  "community>blockchain": "community connections extend into a block trace",
  "blockchain>conclusion": "chain trace pushes into a risk frame",
};

function normalizedWord(value: string): string {
  return value.toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function easing(progress: string): string {
  return `(1-pow(1-min(${progress},1),3))`;
}

function ffmpegText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll(":", "\\:")
    .replaceAll("%", "\\%");
}

function compactCounter(value: number): { scaled: number; suffix: string } {
  const units = [
    { threshold: 1_000_000_000_000, suffix: "T" },
    { threshold: 1_000_000_000, suffix: "B" },
    { threshold: 1_000_000, suffix: "M" },
    { threshold: 1_000, suffix: "K" },
  ];
  const unit = units.find((item) => Math.abs(value) >= item.threshold);
  return unit
    ? { scaled: value / unit.threshold, suffix: unit.suffix }
    : { scaled: value, suffix: "" };
}

function semanticAccent(type: PremiumDynamicFinanceV1_1SemanticEvent["semanticType"]): string {
  if (type === "measured-rise") return "0x66e58c";
  if (type === "measured-drawdown") return "0xff6a70";
  if (type === "market-cap") return "0xf0c84b";
  if (type === "media-noise") return "0x59ceff";
  return "0x72e6d3";
}

function enterFilters(
  type: PremiumDynamicFinanceV1_1SemanticEvent["semanticType"],
  durationSeconds: number,
): string[] {
  const duration = Math.min(0.82, Math.max(0.55, durationSeconds * 0.48));
  const progress = `t/${duration.toFixed(3)}`;
  const eased = easing(progress);
  const accent = semanticAccent(type);
  if (type === "measured-rise" || type === "measured-drawdown" || type === "price-history") {
    return [
      `drawbox=x='iw*(0.12+0.78*${eased})':y='ih*0.18':w='iw*0.78*(1-${eased})':h='ih*0.34':color=0x0c1420@0.98:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
      `drawbox=x='iw*(0.12+0.78*${eased})':y='ih*0.20':w=7:h='ih*0.30':color=${accent}@0.82:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
    ];
  }
  if (type === "market-cap") {
    return [
      `drawbox=x=0:y='ih*${eased}':w=iw:h='ih*(1-${eased})':color=0x080b12@0.92:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
      `drawbox=x='iw*0.18':y='ih*(0.72-${eased}*0.18)':w='iw*0.64':h=4:color=${accent}@0.72:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
    ];
  }
  if (type === "bitcoin-comparison") {
    return [
      `drawbox=x='iw*${eased}':y=0:w='iw*(1-${eased})':h=ih:color=0x080b12@0.98:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
      `drawbox=x='iw*0.5':y='ih*0.23':w=4:h='ih*0.34':color=0xf5f7fa@0.68:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
    ];
  }
  if (type === "media-noise") {
    return [
      `drawbox=x='iw*${eased}':y=0:w='iw*(1-${eased})':h=ih:color=0x080b12@0.96:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
      `drawbox=x='iw*(1-${eased})':y='ih*0.27':w='iw*0.16':h=5:color=0xff5964@0.62:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
    ];
  }
  if (type === "community" || type === "blockchain") {
    return [
      `drawbox=x=0:y='ih*${eased}':w=iw:h='ih*(1-${eased})':color=0x080b12@0.98:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
      `drawbox=x='iw*(0.18+0.64*${eased})':y='ih*0.44':w=5:h=4:color=${accent}@0.75:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
    ];
  }
  return [
    `drawbox=x='iw*${eased}':y=0:w='iw*(1-${eased})':h=ih:color=0x080b12@0.95:t=fill:enable='lt(t,${duration.toFixed(3)})'`,
  ];
}

function exitFilters(
  type: PremiumDynamicFinanceV1_1SemanticEvent["semanticType"],
  durationSeconds: number,
): string[] {
  const exitDuration = Math.min(0.28, Math.max(0.18, durationSeconds * 0.18));
  const start = Math.max(0, durationSeconds - exitDuration);
  const progress = `pow(min((t-${start.toFixed(3)})/${exitDuration.toFixed(3)},1),3)`;
  const accent = semanticAccent(type);
  const x = type === "market-cap"
    ? `iw*0.5*(1-${progress})`
    : `iw*(1-${progress})`;
  const width = type === "market-cap" ? `iw*${progress}` : `iw*${progress}`;
  return [
    `drawbox=x='${x}':y=0:w='${width}':h=ih:color=0x05070d@0.94:t=fill:enable='gte(t,${start.toFixed(3)})'`,
    `drawbox=x='iw*(1-${progress})':y='ih*0.5':w='iw*${progress}':h=3:color=${accent}@0.72:t=fill:enable='gte(t,${start.toFixed(3)})'`,
    `gblur=sigma=1.2:steps=3:enable='gte(t,${start.toFixed(3)})'`,
  ];
}

export class PremiumVisualMotionEngine {
  private readonly planned = new Map<number, PlannedBeat>();
  private readonly auditEvents: PremiumVisualMotionAuditEvent[];
  private readonly sceneTransitions: PremiumVisualMotionSceneTransition[];

  constructor(input: {
    events: PremiumDynamicFinanceV1_1SemanticEvent[];
    beats: LongformVisualBeat[];
    subtitleWords: KineticSubtitleWord[];
    fontPath: string;
  }) {
    this.fontPath = input.fontPath;
    if (!input.fontPath.trim()) throw new Error("PremiumVisualMotionEngine requires a resolved font path");
    if (!input.events.length || input.events.length !== input.beats.length) {
      throw new Error("PremiumVisualMotionEngine requires one semantic event per existing beat");
    }
    for (const event of input.events) {
      const beat = input.beats.find((candidate) => candidate.index === event.beatIndex);
      if (!beat || beat.sceneId !== event.sceneId || beat.startMs !== event.startMs || beat.endMs !== event.endMs) {
        throw new Error(`Motion plan is not aligned with saved semantic beat ${event.beatIndex}`);
      }
    }

    const words = [...input.subtitleWords].sort((left, right) => left.startMs - right.startMs);
    const grouped = new Map<number, PremiumDynamicFinanceV1_1SemanticEvent[]>();
    for (const event of input.events) {
      const sceneEvents = grouped.get(event.sceneId) ?? [];
      sceneEvents.push(event);
      grouped.set(event.sceneId, sceneEvents);
    }

    const sceneCues = new Map<number, MotionCue>();
    for (const [sceneId, events] of grouped) {
      const first = events[0]!;
      const sceneWords = words.filter((word) =>
        word.startMs < events.at(-1)!.endMs && word.endMs > first.startMs,
      );
      const explicitWords = events
        .map((event) => event.premiumDynamic.emphasisWord)
        .filter((word): word is string => Boolean(word))
        .map(normalizedWord);
      const explicitCue = sceneWords.find((word) => explicitWords.includes(normalizedWord(word.text)));
      const semanticCue = sceneWords.find((word) => KEYWORD_BY_TYPE[first.semanticType].test(normalizedWord(word.text)));
      const cue = explicitCue ?? semanticCue;
      if (cue) sceneCues.set(sceneId, { word: cue.text, startMs: cue.startMs });
    }

    const counterCues = new Map<number, MotionCue>();
    const counterCuesByScene = new Map<number, MotionCue>();
    for (const [sceneId, events] of grouped) {
      if (events[0]!.semanticType !== "market-cap") continue;
      const sceneWords = words.filter((word) =>
        word.startMs < events.at(-1)!.endMs && word.endMs > events[0]!.startMs,
      );
      const cue = sceneWords.find((word) => normalizedWord(word.text).startsWith("капитализац"));
      if (!cue) continue;
      const cueEvent = events.find((event) =>
        cue.startMs >= event.startMs && cue.startMs < event.endMs,
      ) ?? events[0]!;
      counterCues.set(cueEvent.beatIndex, { word: cue.text, startMs: cue.startMs });
      counterCuesByScene.set(sceneId, { word: cue.text, startMs: cue.startMs });
    }

    const orderedEvents = [...input.events].sort((left, right) => left.startMs - right.startMs);
    const transitions: PremiumVisualMotionSceneTransition[] = [];
    for (let index = 1; index < orderedEvents.length; index += 1) {
      const previous = orderedEvents[index - 1]!;
      const next = orderedEvents[index]!;
      if (previous.sceneId === next.sceneId) continue;
      const type = TRANSITION_BY_PAIR[`${previous.semanticType}>${next.semanticType}`]
        ?? "eased camera push with type-specific masked reveal";
      transitions.push({
        fromSceneId: previous.sceneId,
        toSceneId: next.sceneId,
        from: previous.semanticType,
        to: next.semanticType,
        type,
      });
    }

    this.auditEvents = [];
    for (const event of orderedEvents) {
      const beat = input.beats.find((candidate) => candidate.index === event.beatIndex)!;
      const sceneEvents = grouped.get(event.sceneId)!;
      const cue = sceneCues.get(event.sceneId) ?? null;
      const reactionCue = cue && cue.startMs >= event.startMs && cue.startMs < event.endMs ? cue : null;
      const counterCue = counterCues.get(event.beatIndex) ?? null;
      const sceneCounterCue = counterCuesByScene.get(event.sceneId) ?? null;
      const counterHold = Boolean(
        sceneCounterCue
        && event.startMs >= sceneCounterCue.startMs
        && !counterCue,
      );
      const counterValue = sceneCounterCue ? event.market.marketCapUsd : null;
      const planned: PlannedBeat = {
        entrance: ENTRANCE_BY_TYPE[event.semanticType],
        movement: "three-plane eased parallax and continuous camera drift",
        exit: EXIT_BY_TYPE[event.semanticType],
        isSceneStart: beat.index === sceneEvents[0]!.beatIndex,
        isSceneEnd: beat.index === sceneEvents.at(-1)!.beatIndex,
        reactionCue,
        counterCue,
        counterValue,
        counterHold,
        omitStaticMarketCapValue: Boolean(sceneCounterCue),
      };
      this.planned.set(event.beatIndex, planned);
      this.auditEvents.push({
        beatIndex: event.beatIndex,
        sceneId: event.sceneId,
        semanticType: event.semanticType,
        entrance: planned.isSceneStart ? planned.entrance : "continuing scene build",
        movement: planned.movement,
        reactionWord: reactionCue?.word ?? null,
        reactionStartMs: reactionCue?.startMs ?? null,
        exit: planned.isSceneEnd ? planned.exit : "continuing into next beat",
        transition: null,
        animatedCounter: counterCue && event.market.marketCapUsd !== null
          ? this.formatCounter(event.market.marketCapUsd)
          : planned.counterHold && event.market.marketCapUsd !== null
            ? `hold ${this.formatCounter(event.market.marketCapUsd)}`
            : null,
      });
    }

    for (const transition of transitions) {
      const source = orderedEvents.filter((event) => event.sceneId === transition.fromSceneId).at(-1);
      const target = orderedEvents.find((event) => event.sceneId === transition.toSceneId);
      if (source) {
        const report = this.auditEvents.find((event) => event.beatIndex === source.beatIndex);
        if (report) report.transition = transition.type;
      }
      if (target) {
        const report = this.auditEvents.find((event) => event.beatIndex === target.beatIndex);
        if (report) report.transition = transition.type;
      }
    }
    this.sceneTransitions = transitions;
  }

  private formatCounter(value: number): string {
    const { scaled, suffix } = compactCounter(value);
    return `$${scaled.toFixed(2)}${suffix}`;
  }

  private counterFilters(
    value: number,
    startSeconds: number,
    durationSeconds: number,
    fontPath: string,
  ): string[] {
    const { scaled, suffix } = compactCounter(value);
    const totalDuration = Math.max(0.35, Math.min(0.82, durationSeconds - startSeconds - 0.025));
    const values = [0, 0.25, 0.5, 0.75, 1].map((fraction) =>
      `$${(scaled * fraction).toFixed(2)}${suffix}`,
    );
    const times = [0, 0.14, 0.32, 0.56, 0.8];
    const escapedFont = fontPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    return values.map((text, index) => {
      const currentStart = startSeconds + totalDuration * times[index]!;
      const nextStart = index < values.length - 1
        ? startSeconds + totalDuration * times[index + 1]!
        : durationSeconds;
      const enable = index === values.length - 1
        ? `gte(t,${currentStart.toFixed(3)})`
        : `gte(t,${currentStart.toFixed(3)})*lt(t,${nextStart.toFixed(3)})`;
      return `drawtext=fontfile='${escapedFont}':text='${ffmpegText(text)}':fontcolor=0xf5f7fa:fontsize=72:x='w-text_w-0.08*w':y='0.18*h':shadowcolor=black@0.65:shadowx=3:shadowy=4:enable='${enable}'`;
    });
  }

  private counterHoldFilter(value: number, fontPath: string): string {
    const escapedFont = fontPath.replaceAll("\\", "\\\\").replaceAll(":", "\\:");
    return `drawtext=fontfile='${escapedFont}':text='${ffmpegText(this.formatCounter(value))}':fontcolor=0xf5f7fa:fontsize=72:x='w-text_w-0.08*w':y='0.18*h':shadowcolor=black@0.65:shadowx=3:shadowy=4`;
  }

  getTreatment(input: {
    beat: LongformVisualBeat;
    event: PremiumDynamicFinanceV1_1SemanticEvent;
    durationSeconds: number;
  }): LongformVisualMotionTreatment {
    const { beat, event } = input;
    const durationSeconds = Math.max(0.2, input.durationSeconds);
    const plan = this.planned.get(beat.index);
    if (!plan) throw new Error(`No PremiumVisualMotionEngine profile for beat ${beat.index}`);
    const intensityScale = event.premiumDynamic.intensity === "impact"
      ? 1.018
      : event.premiumDynamic.intensity === "dynamic"
        ? 1.008
        : 1;
    const filters: string[] = [];

    if (plan.isSceneStart) {
      filters.push(
        ...enterFilters(event.semanticType, durationSeconds),
        "gblur=sigma=0.95:steps=2:enable='lt(t,0.075)'",
      );
    }
    if (plan.reactionCue) {
      const localCueSeconds = Math.max(0, (plan.reactionCue.startMs - beat.startMs) / 1_000);
      const pulseEnd = Math.min(durationSeconds, localCueSeconds + 0.105);
      filters.push(
        `drawbox=x='iw*0.43':y='ih*0.16':w='iw*0.14':h=4:color=${semanticAccent(event.semanticType)}@0.78:t=fill:enable='gte(t,${localCueSeconds.toFixed(3)})*lt(t,${pulseEnd.toFixed(3)})'`,
        `gblur=sigma=1.1:steps=3:enable='gte(t,${localCueSeconds.toFixed(3)})*lt(t,${pulseEnd.toFixed(3)})'`,
      );
    }
    if (plan.counterCue && plan.counterValue !== null) {
      const localCueSeconds = Math.max(0, (plan.counterCue.startMs - beat.startMs) / 1_000);
      filters.push(...this.counterFilters(
        plan.counterValue,
        localCueSeconds,
        durationSeconds,
        this.fontPath,
      ));
    } else if (plan.counterHold && plan.counterValue !== null) {
      filters.push(this.counterHoldFilter(plan.counterValue, this.fontPath));
    }
    if (plan.isSceneEnd) filters.push(...exitFilters(event.semanticType, durationSeconds));

    return {
      backgroundScale: 1.018 * intensityScale,
      midgroundScale: 1.038 * intensityScale,
      foregroundScale: 1.058 * intensityScale,
      backgroundDrift: 2.2,
      midgroundDrift: 5.2,
      foregroundDrift: 8.8,
      filters,
      omitStaticMarketCapValue: plan.omitStaticMarketCapValue,
    };
  }

  private readonly fontPath: string;

  getAudit(): PremiumVisualMotionAudit {
    const allTypes = new Set<string>();
    for (const event of this.auditEvents) {
      if (event.entrance !== "continuing scene build") allTypes.add(event.entrance);
      allTypes.add(event.movement);
      if (event.reactionWord) allTypes.add("subtitle-word-synchronized visual pulse");
      if (event.animatedCounter) allTypes.add("animated market-cap number counter");
      if (event.animatedCounter?.startsWith("hold ")) {
        allTypes.add("resolved market-cap value held in upper-right subtitle-safe area");
      }
      if (event.exit !== "continuing into next beat") allTypes.add(event.exit);
    }
    allTypes.add("easeOutCubic entrance and exit masks");
    allTypes.add("brief motion blur on fast entries, reactions, and exits");
    allTypes.add("scene-local ambient sweep and particle motion");
    return {
      engine: "PremiumVisualMotionEngine",
      sceneCount: new Set(this.auditEvents.map((event) => event.sceneId)).size,
      beatCount: this.auditEvents.length,
      appliedAnimationTypes: [...allTypes],
      sceneTransitions: this.sceneTransitions,
      events: this.auditEvents,
    };
  }
}