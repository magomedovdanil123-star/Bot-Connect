import { motion } from 'framer-motion';

import { EASE, Eyebrow, SourceLine } from './scene-common';

export function Scene05Hypothetical() {
  return (
    <motion.section
      className="film-scene scene-hypothetical"
      initial={{ opacity: 0, rotateY: -9, clipPath: 'inset(0 100% 0 0)' }}
      animate={{ opacity: 1, rotateY: 0, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, clipPath: 'polygon(0 0, 100% 0, 100% 70%, 0 100%)', scale: 0.98 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <div className="paper-crease" aria-hidden="true" />
      <Eyebrow className="hypo-eyebrow">ЕСЛИ БЫ $100 БЫЛИ ВЛОЖЕНЫ</Eyebrow>
      <motion.p
        className="hypo-window"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.34, duration: 0.41 }}
      >
        30 ДНЕЙ НАЗАД
      </motion.p>
      <div className="hypo-equation">
        <motion.div
          className="hypo-input"
          initial={{ opacity: 0, x: -65, rotate: -3 }}
          animate={{ opacity: 1, x: 0, rotate: 0 }}
          transition={{ delay: 0.89, duration: 0.76, ease: EASE }}
        >
          $100
        </motion.div>
        <motion.div
          className="hypo-multiplier"
          initial={{ opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ delay: 1.74, duration: 0.65, ease: EASE }}
        >
          × 1.110968
        </motion.div>
        <motion.div
          className="hypo-result"
          initial={{ opacity: 0, scale: 0.78, y: 34 }}
          animate={{ opacity: [0, 1, 1], scale: [0.78, 1.035, 1], y: [34, -3, 0] }}
          transition={{ delay: 2.59, duration: 0.84, ease: EASE }}
        >
          $111.10
        </motion.div>
      </div>
      <motion.div
        className="hypo-caveats"
        initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
        animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
        transition={{ delay: 3.88, duration: 0.71, ease: EASE }}
      >
          <p>ИТОГО $111.10 · ПРИБЫЛЬ $11.10</p>
        <p>ДО КОМИССИЙ, СПРЕДА И НАЛОГОВ</p>
      </motion.div>
      <motion.p
        className="hypo-not-forecast"
        initial={{ opacity: 0, scale: 1.2, y: 16 }}
        animate={{ opacity: [0, 1, 1], scale: [1.2, 1, 1], y: [16, 0, 0] }}
        transition={{ delay: 4.84, duration: 0.60, ease: EASE }}
      >
        НЕ ПРОГНОЗ
      </motion.p>
      <SourceLine className="hypo-source">CoinGecko · изменение за 30 дней</SourceLine>
      <motion.div
        className="hypo-ribbon"
        initial={{ scaleX: 0, rotate: 0 }}
        animate={{ scaleX: [0, 1, 1.25], rotate: [0, 0, 9] }}
        transition={{ duration: 7.49, times: [0, 0.72, 1], ease: EASE }}
      />
    </motion.section>
  );
}