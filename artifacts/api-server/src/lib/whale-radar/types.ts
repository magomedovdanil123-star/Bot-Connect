export type WhaleAction = "BUY" | "SELL" | "TRANSFER";

export type WhaleEventType =
  | "SMART_MONEY_BUY"
  | "SMART_MONEY_SELL"
  | "LARGE_TRANSFER"
  | "EXCHANGE_DEPOSIT"
  | "EXCHANGE_WITHDRAWAL";

export type WhaleActivityItem = {
  transactionHash: string;
  action: WhaleAction;
  amountUsd: number;
  timestamp: string;
};

export type WhaleOhlcvCandle = {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number | null;
};

export type WhaleMarketContext = {
  source: "nansen";
  timeframe: string;
  candles: WhaleOhlcvCandle[];
  changePercent: number | null;
};

export type WhaleScoreBreakdown = {
  sizeScore: number;
  smartMoneyScore: number;
  unusualActivityScore: number;
  accumulationScore: number;
  marketContextScore: number;
  walletHistoryScore: number;
};

export type WhaleEvent = {
  id?: number;
  eventId: string;
  deduplicationKey: string;
  timestamp: string;
  blockchain: string;
  asset: string;
  symbol: string;
  tokenAddress: string | null;
  action: WhaleAction;
  eventType: WhaleEventType;
  amount: number;
  amountUsd: number;
  priceUsd: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  fromLabel: string | null;
  toLabel: string | null;
  walletType: string | null;
  walletLabel: string | null;
  transactionHash: string;
  dex: string | null;
  exchange: string | null;
  confidenceScore: number;
  whaleScore: number;
  scoreBreakdown: WhaleScoreBreakdown;
  previousActivity: WhaleActivityItem[];
  marketContext: WhaleMarketContext | null;
  dataSources: string[];
  rawData: unknown;
  passedSignificance: boolean;
};

export type WhaleStory = {
  title: string;
  hook: string;
  narration: string;
  keyFacts: string[];
  disclaimer: string;
};

export type WhaleVisualScene = {
  id: string;
  kind:
    | "HOOK"
    | "TRADE_FACT"
    | "MONEY_FLOW"
    | "WALLET"
    | "ACCUMULATION"
    | "DISTRIBUTION"
    | "WALLET_HISTORY"
    | "MARKET"
    | "SOURCE_PROOF"
    | "TAKEAWAY"
    | "CTA";
  title: string;
  subtitle: string;
  visualDescription: string;
};

export type WhaleVisualPlan = {
  format: "WHALE_RADAR_SHORTS_V1";
  source: "Nansen";
  targetDurationSeconds: number;
  aspectRatio: "9:16";
  scenes: WhaleVisualScene[];
};

export type WhaleYoutubeMetadata = {
  title: string;
  description: string;
  tags: string[];
  hashtags: string[];
};
