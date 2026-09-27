import { motion } from 'framer-motion';

import { DataGrid, EASE, Eyebrow, SourceLine } from './scene-common';

const comparisons = [
  { symbol: 'HYPE', value: 11.1, exact: '+11.1%', color: '#d6ff39' },
  { symbol: 'ETH', value: 8.1, exact: '+8.1%', color: '#c9d0ca' },
  { symbol: 'BTC', value: 5.6, exact: '+5.6%', color: '#7db1ff' },
];

export function Scene04Comparisons() {
  return (
    <motion.section
      className="film-scene scene-comparisons"
      initial={{ opacity: 0, clipPath: 'polygon(50% 0, 50% 0, 50% 100%, 50% 100%)' }}
      animate={{ opacity: 1, clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%)' }}
      exit={{ opacity: 0, scale: 1.04, clipPath: 'inset(0 0 0 100%)' }}
      transition={{ duration: 0.48, ease: EASE }}
    >
      <DataGrid />
      <Eyebrow className="compare-eyebrow">30 ДНЕЙ · ОДИН СРЕЗ</Eyebrow>
      <div className="compare-axis" aria-hidden="true" />
      <div className="compare-bars">
        {comparisons.map((item, index) => (
          <div className="compare-column" key={item.symbol}>
            <motion.div
              className="compare-bar"
              style={{ backgroundColor: item.color }}
              initial={{ height: 0, rotateX: -18 }}
              animate={{ height: `${item.value * 6.2}vmin`, rotateX: 0 }}
              transition={{
                duration: 0.75,
                delay: 0.28 + index * 0.36,
                ease: EASE,
              }}
            />
            <motion.strong
              className="compare-value"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.36, duration: 0.28 }}
            >
              {item.exact}
            </motion.strong>
            <motion.span
              className="compare-symbol"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.68 + index * 0.36 }}
            >
              {item.symbol}
            </motion.span>
          </div>
        ))}
      </div>
      <div className="compare-delta">
        <motion.p
          initial={{ opacity: 0, x: -25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.95, duration: 0.34, ease: EASE }}
        >
          HYPE: <b>+5.5 п.п.</b> К BTC
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 25 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 2.48, duration: 0.34, ease: EASE }}
        >
          <b>+3.0 п.п.</b> К ETH
        </motion.p>
      </div>
      <SourceLine className="compare-source">
        CoinGecko · 27.09.2026 · 05:46 UTC
      </SourceLine>
      <motion.div
        className="compare-carrier"
        initial={{ scaleY: 1, originY: 1 }}
        animate={{ scaleY: [1, 1, 0.12], originY: 1 }}
        transition={{ duration: 4.6, times: [0, 0.8, 1], ease: EASE }}
      />
    </motion.section>
  );
}