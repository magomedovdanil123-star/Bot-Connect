import { motion } from 'framer-motion';

import { CryptoToken } from '../CryptoToken';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene2() {
  return (
    <motion.section
      className="crypto-scene crypto-scene--record"
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 0.5, scale: 1.04 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1, scale: 1 }}
      exit={{ clipPath: 'inset(0 0 0 92%)', x: -20, opacity: 0, rotateY: -8 }}
      transition={{ duration: 0.52, ease: EASE }}
    >
      <div className="record-grid" />
      <motion.div
        className="record-heading"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.22, duration: 0.42, ease: EASE }}
      >
        <span>НЕ ФИЗИЧЕСКАЯ</span>
        <span>МОНЕТА</span>
      </motion.div>
      <motion.div
        className="record-card"
        initial={{ scale: 0.76, rotateY: -24, rotateZ: 5, opacity: 0.25 }}
        animate={{ scale: [0.76, 1.04, 1], rotateY: [-24, 4, 0], rotateZ: [5, -1, 0], opacity: 1 }}
        transition={{ duration: 0.82, ease: EASE }}
      >
        <div className="record-card__seal">
          <CryptoToken className="crypto-token--small" />
        </div>
        <div className="record-card__rows">
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.68, duration: 0.42, ease: EASE }} />
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 0.84 }} transition={{ delay: 0.9, duration: 0.38, ease: EASE }} />
          <motion.i initial={{ scaleX: 0 }} animate={{ scaleX: 0.66 }} transition={{ delay: 1.08, duration: 0.34, ease: EASE }} />
        </div>
        <motion.span
          className="record-card__check"
          initial={{ scale: 0, rotate: -24, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={{ delay: 1.95, type: 'spring', stiffness: 320, damping: 24 }}
        />
      </motion.div>
      <motion.p
        className="record-caption"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.12, duration: 0.4, ease: EASE }}
      >
        ДАННЫЕ В ЦИФРОВОЙ СИСТЕМЕ
      </motion.p>
      <motion.div
        className="record-stamp"
        initial={{ opacity: 0, scale: 1.4, rotate: -8 }}
        animate={{ opacity: 1, scale: 1, rotate: -3 }}
        transition={{ delay: 3.05, duration: 0.32, ease: EASE }}
      >
        ЗАПИСЬ
      </motion.div>
      <motion.div
        className="record-trace"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 4.14, duration: 0.72, ease: EASE }}
      />
    </motion.section>
  );
}