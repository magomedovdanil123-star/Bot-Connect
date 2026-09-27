import { motion } from 'framer-motion';

import { DataGrid, EASE, Eyebrow, Ring, SourceLine } from './scene-common';

export function Scene03OpenInterest() {
  return (
    <motion.section
      className="film-scene scene-open-interest"
      initial={{ opacity: 0, clipPath: 'inset(0 0 0 100%)', rotateY: -8 }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)', rotateY: 0 }}
      exit={{ opacity: 0, rotateY: 18, scale: 0.96 }}
      transition={{ duration: 0.55, ease: EASE }}
    >
      <DataGrid />
      <motion.div
        className="oi-aperture"
        initial={{ scaleY: 0.08, opacity: 0.35 }}
        animate={{ scaleY: [0.08, 1.06, 1], opacity: [0.35, 1, 0.8] }}
        transition={{ duration: 1.1, ease: EASE }}
      />
      <Eyebrow className="oi-eyebrow">ОТКРЫТЫЙ ИНТЕРЕС</Eyebrow>
      <div className="oi-number-wrap">
        <Ring className="oi-ring">
          <motion.span
            className="oi-ring__sweep"
            initial={{ rotate: -80 }}
            animate={{ rotate: 280 }}
            transition={{ duration: 3.3, ease: 'linear' }}
          />
        </Ring>
        <motion.h2
          className="oi-number"
          initial={{ opacity: 0, rotateX: -26, y: 70, scale: 0.86 }}
          animate={{ opacity: 1, rotateX: 0, y: 0, scale: 1 }}
          transition={{ duration: 0.78, delay: 0.24, ease: EASE }}
        >
          $18<span>B</span>
        </motion.h2>
      </div>
      <motion.p
        className="oi-record"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.05, duration: 0.35 }}
      >
        РЕКОРД НА HYPERLIQUID
      </motion.p>
      <SourceLine className="oi-source">
        ОФИЦИАЛЬНЫЙ КАНАЛ · 22.09.2026
      </SourceLine>
      <div className="oi-causality">
        <motion.p
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 2.45, duration: 0.28 }}
        >
          СОВПАЛО ПО ВРЕМЕНИ
        </motion.p>
        <motion.p
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 3.0, duration: 0.3 }}
        >
          НЕ ДОКАЗЫВАЕТ ПРИЧИНУ РОСТА
        </motion.p>
      </div>
      <motion.div
        className="oi-fold"
        initial={{ scaleX: 0.08, rotate: -12 }}
        animate={{ scaleX: [0.08, 0.08, 1], rotate: [-12, -12, 0] }}
        transition={{ duration: 4.9, times: [0, 0.8, 1], ease: EASE }}
      />
    </motion.section>
  );
}