import { motion } from 'framer-motion';

import { EASE, Eyebrow, SourceLine } from './scene-common';

export function Scene06Risk() {
  return (
    <motion.section
      className="film-scene scene-risk"
      initial={{ opacity: 0, clipPath: 'inset(50% 0 50% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
      exit={{ opacity: 0, scale: 0.94, clipPath: 'circle(0% at 50% 50%)' }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <div className="risk-paper-fold" aria-hidden="true" />
      <div className="risk-axis" aria-hidden="true" />
      <motion.div
        className="risk-content"
        initial={{ opacity: 1 }}
        animate={{ opacity: 0 }}
        transition={{ delay: 4.75, duration: 1.05, ease: 'linear' }}
      >
        <Eyebrow className="risk-eyebrow">ПРОВЕРЯЙТЕ ДАННЫЕ</Eyebrow>
        <motion.h2
          className="risk-headline"
          initial={{ opacity: 0, y: 34, clipPath: 'inset(0 0 100% 0)' }}
          animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0 0 0)' }}
          transition={{ delay: 0.2, duration: 0.48, ease: EASE }}
        >
          ОТКРЫТЫЙ
          <br />
          ИНТЕРЕС <em>≠</em>
          <br />
          СПОТОВЫЙ СПРОС
        </motion.h2>
        <motion.p
          className="risk-line risk-line--one"
          initial={{ opacity: 0, x: -22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.05, duration: 0.32 }}
        >
          ПЛЕЧО УСИЛИВАЕТ ДВЕ СТОРОНЫ
        </motion.p>
        <motion.p
          className="risk-line risk-line--two"
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 1.7, duration: 0.32 }}
        >
          +11.1% — ПРОШЛОЕ, НЕ ПРОГНОЗ
        </motion.p>
        <motion.p
          className="risk-disclaimer"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 2.3, duration: 0.28 }}
        >
          НЕ ИНВЕСТИЦИОННАЯ РЕКОМЕНДАЦИЯ
        </motion.p>
        <div className="risk-sources">
          <SourceLine>CoinGecko · срез 27.09.2026 05:46 UTC</SourceLine>
          <SourceLine>Hyperliquid Announcements · 22.09.2026</SourceLine>
          <SourceLine>ОЗВУЧЕНО ИИ</SourceLine>
        </div>
        <motion.p
          className="risk-takeaway"
          initial={{ opacity: 0, y: 18, letterSpacing: '0.22em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.08em' }}
          transition={{ delay: 3.18, duration: 0.42, ease: EASE }}
        >
          НЕТ АККАУНТА НА КРИПТОБИРЖЕ?
          <br />
          ССЫЛКА — В ШАПКЕ ПРОФИЛЯ
        </motion.p>
      </motion.div>
      <div className="risk-loop-ring" aria-hidden="true">
        <span className="risk-loop-ring__inner" />
      </div>
    </motion.section>
  );
}