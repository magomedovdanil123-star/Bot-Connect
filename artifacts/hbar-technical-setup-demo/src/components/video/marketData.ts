export interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PriceLevel {
  price: number;
  label: string;
  color: string;
}

export const MARKET_SNAPSHOT = {
  ticker: 'HBAR / USDT',
  changePercent: 5.706,
  open: 0.11199,
  current: 0.11838,
  high: 0.13096,
  low: 0.1111,
  investmentUsd: 1000,
  snapshotAt: '29.09.2026 · 09:39 UTC',
};

export const SETUP = {
  entry: 0.11752,
  stop: 0.115,
  target: 0.12561,
  priorFourHourVolume: 84_014_011,
  breakoutFourHourVolume: 650_326_595,
  investedUsd: 1000,
};

export const FOUR_HOUR_BREAKOUT: Candle[] = [
  { open: 0.09409, high: 0.09529, low: 0.09307, close: 0.09523, volume: 14_874_171 },
  { open: 0.09523, high: 0.09537, low: 0.09326, close: 0.09333, volume: 16_432_499 },
  { open: 0.09334, high: 0.09381, low: 0.09178, close: 0.0935, volume: 14_081_865 },
  { open: 0.0935, high: 0.09408, low: 0.09237, close: 0.09323, volume: 17_437_516 },
  { open: 0.09322, high: 0.09578, low: 0.0925, close: 0.09569, volume: 19_961_541 },
  { open: 0.09569, high: 0.0959, low: 0.09448, close: 0.09474, volume: 14_920_230 },
  { open: 0.09474, high: 0.09581, low: 0.09292, close: 0.09336, volume: 27_575_764 },
  { open: 0.09336, high: 0.09526, low: 0.09329, close: 0.09487, volume: 14_440_325 },
  { open: 0.09487, high: 0.09607, low: 0.09355, close: 0.09586, volume: 22_903_089 },
  { open: 0.09586, high: 0.09772, low: 0.09415, close: 0.09519, volume: 49_239_312 },
  { open: 0.0952, high: 0.09944, low: 0.09431, close: 0.09684, volume: 84_014_011 },
  { open: 0.09684, high: 0.1195, low: 0.0968, close: 0.11752, volume: 650_326_595 },
];

export const POST_ENTRY_FIFTEEN_MINUTE: Candle[] = [
  { open: 0.11753, high: 0.11988, low: 0.11632, close: 0.11956, volume: 23_424_671 },
  { open: 0.11956, high: 0.125, low: 0.11927, close: 0.12343, volume: 49_055_368 },
  { open: 0.12343, high: 0.1238, low: 0.11971, close: 0.12013, volume: 24_241_012 },
  { open: 0.12013, high: 0.12193, low: 0.11888, close: 0.11937, volume: 19_263_644 },
  { open: 0.11938, high: 0.11964, low: 0.11578, close: 0.11824, volume: 30_750_638 },
  { open: 0.11824, high: 0.11984, low: 0.1173, close: 0.11773, volume: 18_796_475 },
  { open: 0.11773, high: 0.12278, low: 0.11773, close: 0.12146, volume: 24_244_687 },
  { open: 0.12146, high: 0.12165, low: 0.11965, close: 0.12031, volume: 26_453_871 },
  { open: 0.12034, high: 0.1216, low: 0.11876, close: 0.12034, volume: 15_293_652 },
  { open: 0.12033, high: 0.12065, low: 0.11812, close: 0.1187, volume: 20_782_612 },
  { open: 0.11869, high: 0.12037, low: 0.11775, close: 0.11872, volume: 20_621_625 },
  { open: 0.11876, high: 0.11901, low: 0.11651, close: 0.11816, volume: 21_577_387 },
  { open: 0.11817, high: 0.11949, low: 0.11585, close: 0.11684, volume: 21_092_097 },
  { open: 0.11685, high: 0.118, low: 0.11538, close: 0.11758, volume: 19_832_752 },
  { open: 0.11758, high: 0.12344, low: 0.11709, close: 0.12316, volume: 28_687_325 },
  { open: 0.12315, high: 0.12669, low: 0.1219, close: 0.12561, volume: 38_192_231 },
];

export const SETUP_LEVELS: PriceLevel[] = [
  { price: SETUP.entry, label: 'ВХОД', color: '#75e8b2' },
  { price: SETUP.stop, label: 'СТОП', color: '#f17d78' },
  { price: SETUP.target, label: 'ЦЕЛЬ', color: '#d5ba7a' },
];

export function formatPrice(value: number): string {
  return `$${value.toFixed(5)}`;
}

export function formatUsd(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export const TWENTY_FOUR_HOUR_PNL =
  MARKET_SNAPSHOT.investmentUsd *
  (MARKET_SNAPSHOT.current / MARKET_SNAPSHOT.open - 1);

export const SETUP_PNL =
  SETUP.investedUsd * (SETUP.target / SETUP.entry - 1);