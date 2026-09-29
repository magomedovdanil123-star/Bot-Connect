import { motion } from 'framer-motion';

import type { Candle, PriceLevel } from './marketData';

interface MarketChartProps {
  candles: Candle[];
  levels?: PriceLevel[];
  minimum?: number;
  maximum?: number;
  revealDelay?: number;
  className?: string;
}

const VIEW_WIDTH = 900;
const VIEW_HEIGHT = 530;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 752;
const PLOT_TOP = 32;
const PLOT_BOTTOM = 363;
const VOLUME_TOP = 400;
const VOLUME_BOTTOM = 487;
const LEVEL_LABEL_X = 888;

function fixed(value: number, digits = 3) {
  return value.toFixed(digits);
}

export function MarketChart({
  candles,
  levels = [],
  minimum,
  maximum,
  revealDelay = 0.075,
  className,
}: MarketChartProps) {
  const values = candles.flatMap((candle) => [candle.low, candle.high]);
  const rawMin = Math.min(...values, ...levels.map((level) => level.price));
  const rawMax = Math.max(...values, ...levels.map((level) => level.price));
  const span = rawMax - rawMin || 0.01;
  const minPrice = minimum ?? rawMin - span * 0.07;
  const maxPrice = maximum ?? rawMax + span * 0.07;
  const volumeMax = Math.max(...candles.map((candle) => candle.volume));
  const candleStep =
    candles.length > 1 ? (PLOT_RIGHT - PLOT_LEFT) / (candles.length - 1) : 0;
  const bodyWidth = Math.max(10, Math.min(24, candleStep * 0.42));
  const yFor = (price: number) =>
    PLOT_BOTTOM - ((price - minPrice) / (maxPrice - minPrice)) * (PLOT_BOTTOM - PLOT_TOP);

  return (
    <svg
      className={['chart-svg', className].filter(Boolean).join(' ')}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      role="img"
      aria-label="График HBAR/USDT со свечами и объёмом"
    >
      {[0, 1, 2, 3, 4].map((line) => {
        const y = PLOT_TOP + ((PLOT_BOTTOM - PLOT_TOP) / 4) * line;
        const price = maxPrice - ((maxPrice - minPrice) / 4) * line;
        return (
          <g key={`grid-${line}`}>
            <line
              x1={PLOT_LEFT}
              y1={y}
              x2={PLOT_RIGHT + 12}
              y2={y}
              stroke="rgba(200, 216, 207, .12)"
              strokeDasharray="4 9"
              strokeWidth="1"
            />
            <text
              className="chart-axis-label"
              x="2"
              y={y + 6}
              textAnchor="start"
            >
              {fixed(price)}
            </text>
          </g>
        );
      })}
      <line
        x1={PLOT_LEFT}
        y1={VOLUME_TOP - 13}
        x2={PLOT_RIGHT + 12}
        y2={VOLUME_TOP - 13}
        stroke="rgba(200, 216, 207, .12)"
        strokeWidth="1"
      />
      <text className="chart-axis-label" x={PLOT_LEFT} y="518">
        ОБЪЁМ
      </text>

      {levels.map((level, index) => {
        const y = yFor(level.price);
        return (
          <motion.g
            key={`${level.label}-${level.price}`}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.28, duration: 0.35 }}
          >
            <line
              x1={PLOT_LEFT}
              y1={y}
              x2={PLOT_RIGHT + 14}
              y2={y}
              stroke={level.color}
              strokeWidth="2"
              strokeDasharray={level.label === 'СТОП' ? '7 7' : 'none'}
              opacity="0.82"
            />
            <rect
              x={PLOT_RIGHT + 22}
              y={y - 19}
              width="129"
              height="38"
              rx="9"
              fill="rgba(7, 11, 10, .94)"
              stroke={level.color}
              strokeWidth="1.4"
            />
            <text
              className="chart-level-text"
              x={LEVEL_LABEL_X}
              y={y - 2}
              fill={level.color}
              textAnchor="end"
            >
              {level.label}
            </text>
            <text
              className="chart-axis-label"
              x={LEVEL_LABEL_X}
              y={y + 13}
              fill={level.color}
              textAnchor="end"
            >
              {`$${level.price.toFixed(5)}`}
            </text>
          </motion.g>
        );
      })}

      {candles.map((candle, index) => {
        const x = PLOT_LEFT + candleStep * index;
        const yOpen = yFor(candle.open);
        const yClose = yFor(candle.close);
        const yHigh = yFor(candle.high);
        const yLow = yFor(candle.low);
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(3, Math.abs(yClose - yOpen));
        const volumeHeight = Math.max(
          2,
          ((candle.volume / volumeMax) * (VOLUME_BOTTOM - VOLUME_TOP)),
        );
        const color = candle.close >= candle.open ? '#75e8b2' : '#f17d78';
        const delay = 0.12 + index * revealDelay;

        return (
          <g key={`candle-${index}`}>
            <motion.line
              x1={x}
              x2={x}
              y1={yOpen}
              y2={yOpen}
              animate={{ y1: yHigh, y2: yLow }}
              transition={{ delay, duration: 0.4, ease: [0.2, 0.8, 0.2, 1] }}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <motion.rect
              x={x - bodyWidth / 2}
              width={bodyWidth}
              rx="3"
              initial={{ y: yOpen - 1, height: 2, opacity: 0.55 }}
              animate={{ y: bodyTop, height: bodyHeight, opacity: 1 }}
              transition={{ delay, duration: 0.42, ease: [0.2, 0.8, 0.2, 1] }}
              fill={color}
            />
            <motion.rect
              x={x - bodyWidth * 0.42}
              width={bodyWidth * 0.84}
              y={VOLUME_BOTTOM - volumeHeight}
              height={volumeHeight}
              rx="2"
              initial={{ opacity: 0, scaleY: 0.05 }}
              animate={{ opacity: candle.volume > volumeMax * 0.42 ? 0.72 : 0.35, scaleY: 1 }}
              transition={{ delay: delay + 0.12, duration: 0.35 }}
              style={{ transformOrigin: 'center bottom' }}
              fill={color}
            />
          </g>
        );
      })}
    </svg>
  );
}