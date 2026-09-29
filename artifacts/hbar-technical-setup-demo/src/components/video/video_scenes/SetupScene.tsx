import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';

import { MarketChart } from '../MarketChart';
import { FOUR_HOUR_BREAKOUT, SETUP, SETUP_LEVELS } from '../marketData';

const LEVEL_ROWS = [
  { label: 'ВХОД · ПОСЛЕ ЗАКРЫТИЯ 4H', value: SETUP.entry, color: '#75e8b2' },
  { label: 'СТОП · УРОВЕНЬ ОТМЕНЫ', value: SETUP.stop, color: '#f17d78' },
  { label: 'ЦЕЛЬ · ИСТОРИЧЕСКИЙ ВЫХОД', value: SETUP.target, color: '#d5ba7a' },
];

export function SetupScene() {
  return (
    <motion.section
      className="scene setup-scene"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0%)' }}
      exit={{ opacity: 0, scale: 1.06, filter: 'blur(5px)' }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="scene-header">
        <div className="scene-kicker">
          <strong>HBAR / USDT</strong>
          <span>ПОСЛЕ ЗАКРЫТИЯ 4H</span>
        </div>
        <div className="setup-pill">УЧЕБНЫЙ</div>
      </div>

      <motion.h1
        className="setup-headline"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.45 }}
      >
        ПРОБОЙ <span>$0.10000</span>
      </motion.h1>

      <div className="chart-wrap">
        <MarketChart
          candles={FOUR_HOUR_BREAKOUT}
          levels={SETUP_LEVELS}
          minimum={0.09}
          maximum={0.132}
          revealDelay={0.07}
        />
      </div>

      <div className="levels-list">
        {LEVEL_ROWS.map((row, index) => (
          <motion.div
            className="level-row"
            key={row.label}
            style={{ '--level-color': row.color } as CSSProperties}
            initial={{ opacity: 0, x: -26 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 + index * 0.45, duration: 0.35 }}
          >
            <span>{row.label}</span>
            <strong>${row.value.toFixed(5)}</strong>
          </motion.div>
        ))}
      </div>

      <div className="scene-footer" style={{ marginTop: '3vmin' }}>
        <span>УСЛОВНЫЙ СЦЕНАРИЙ · НЕ СИГНАЛ</span>
        <span>ВХОД ПОСЛЕ ПОДТВЕРЖДЕНИЯ</span>
      </div>
    </motion.section>
  );
}