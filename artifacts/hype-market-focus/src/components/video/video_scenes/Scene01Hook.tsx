import { motion } from 'framer-motion';

import { DataGrid, EASE, Eyebrow, Ring, SourceLine } from './scene-common';

export function Scene01Hook() {
  return (
    <motion.section
      className="film-scene scene-hook"
      initial={{ opacity: 0, clipPath: 'inset(50% 0 50% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0% 0 0% 0)' }}
      exit={{
        opacity: 0,
        clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 65%)',
        scale: 1.04,
      }}
      transition={{ duration: 0.42, ease: EASE }}
    >
      <DataGrid />
      <div className="hook-axis" aria-hidden="true" />
      <Ring className="hook-ring">
        <motion.span
          className="hook-ring__tick"
          initial={{ rotate: -58, opacity: 0.3 }}
          animate={{ rotate: [0, 28, 0, 55], opacity: [0.35, 1, 0.7, 1] }}
          transition={{ duration: 4.27, ease: 'linear' }}
        />
      </Ring>
      <div className="hook-copy">
        <Eyebrow>HYPE / 30 ДНЕЙ</Eyebrow>
        <motion.div
          className="hook-coin"
          aria-hidden="true"
          initial={{ opacity: 0, scale: 0.7, y: 28, rotateY: 72 }}
          animate={{
            opacity: 1,
            scale: [0.7, 1.06, 1],
            y: [28, -3, 0],
            rotateY: [72, 0, -8, 0],
          }}
          transition={{ duration: 1.47, ease: EASE, delay: 0.16 }}
        >
          <img
            className="hook-coin__logo"
            src={`${import.meta.env.BASE_URL}images/hype-token-logo.jpg`}
            alt="Логотип токена HYPE"
          />
        </motion.div>
        <motion.div
          className="hook-return"
          initial={{ opacity: 0, y: 20, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.56, ease: EASE, delay: 0.77 }}
        >
          <span>$100</span>
          <i aria-hidden="true">→</i>
          <strong>$111.10</strong>
        </motion.div>
        <motion.p
          className="hook-window"
          initial={{ opacity: 0, clipPath: 'inset(0 100% 0 0)' }}
          animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)' }}
          transition={{ duration: 0.59, ease: EASE, delay: 1.15 }}
        >
          +11.1% · ЗА 30 ДНЕЙ
        </motion.p>
        <SourceLine className="hook-stamp">
          CoinGecko · 27.09.2026 · 05:46 UTC
        </SourceLine>
        <motion.p
          className="hook-history"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.37, delay: 1.89 }}
        >
          ГИПОТЕТИЧЕСКИЙ РАСЧЁТ · ДО РАСХОДОВ
        </motion.p>
      </div>
      <motion.div
        className="hook-push-ring"
        initial={{ scale: 0.1, opacity: 0 }}
        animate={{ scale: [0.1, 0.1, 1.85], opacity: [0, 1, 0.95] }}
        transition={{ duration: 4.4, times: [0, 0.78, 1], ease: EASE }}
      />
    </motion.section>
  );
}