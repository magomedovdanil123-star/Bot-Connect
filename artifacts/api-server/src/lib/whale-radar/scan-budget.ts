export type NansenScanState = {
  status: string;
  lastFetchedAt: Date | string | null;
  lastError: string | null;
  lastAttemptAt: Date | string | null;
};

export type NansenScanReuseReason = "successful_scan" | "credits_exhausted" | "recent_attempt";

const SUCCESS_SCAN_TTL_MS = 24 * 60 * 60 * 1_000;
const TRANSIENT_RETRY_TTL_MS = 15 * 60 * 1_000;

function timestampMs(value: Date | string | null): number | null {
  if (!value) return null;
  const valueMs = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(valueMs) ? valueMs : null;
}

function nextUtcReset(now: Date): number {
  const next = new Date(now);
  next.setUTCHours(24, 0, 0, 0);
  return next.getTime();
}

function isCreditExhaustion(message: string | null): boolean {
  return Boolean(message && /insufficient\s+credits|credits?\s+(?:are\s+)?(?:exhausted|depleted)|credit\s+balance|quota\s+(?:is\s+)?exhausted/iu.test(message));
}

export function getNansenScanReuseReason(
  state: NansenScanState | null,
  now = new Date(),
): NansenScanReuseReason | null {
  if (!state) return null;
  const nowMs = now.getTime();
  const fetchedAt = timestampMs(state.lastFetchedAt);
  if (
    (state.status === "ok" || state.status === "partial")
    && fetchedAt !== null
    && nowMs >= fetchedAt
    && nowMs - fetchedAt < SUCCESS_SCAN_TTL_MS
  ) {
    return "successful_scan";
  }

  const attemptedAt = timestampMs(state.lastAttemptAt);
  if (attemptedAt === null || nowMs < attemptedAt) return null;
  if (isCreditExhaustion(state.lastError)) {
    return nowMs < nextUtcReset(now) ? "credits_exhausted" : null;
  }
  if (state.status === "fetching" || state.status === "error") {
    return nowMs - attemptedAt < TRANSIENT_RETRY_TTL_MS ? "recent_attempt" : null;
  }
  return null;
}
