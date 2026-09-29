import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

import { MarketChart } from '../MarketChart';
import { POST_ENTRY_FIFTEEN_MINUTE, SETUP, SETUP_LEVELS, SETUP_PNL, formatUsd } from '../marketData';

export function CloseScene() {
  const [resultVisible, setResultVisible] = useState(false);
  const [handoffStarted, setHandoffStarted] = useState(false);

  useSceneTimer([
    { time: 2520, callback: () => setResultVisible(true) },
    { time: 5500, callback: () => setHandoffStarted(true) },
  ]);

  return (
    <motion.section
      className="scene close-scene"
      initial={{ opacity: 0, scale: 0.94, clipPath: 'inset(0 0 0 100%)' }}
      animate={{ opacity: 1, scale: 1, clipPath: 'inset(0 0 0 0%)' }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="close-scene-content"
        initial={false}
        animate={{
          opacity: handoffStarted ? 0 : 1,
          y: handoffStarted ? -14 : 0,
          scale: handoffStarted ? 0.985 : 1,
        }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="scene-header">
          <div className="scene-kicker">
            <strong>HBAR / USDT</strong>
            <span>15M · ИСТОРИЯ</span>
          </div>
          <div className="setup-pill">ЦЕЛЬ ВЗЯТА</div>
        </div>

        <motion.div
          className="close-chart-wrap"
          animate={{
            borderColor: resultVisible ? 'rgba(213, 186, 122, 0.54)' : 'rgba(117, 232, 178, 0.2)',
          }}
          transition={{ duration: 0.3 }}
        >
          <MarketChart
            candles={POST_ENTRY_FIFTEEN_MINUTE}
            levels={SETUP_LEVELS}
            minimum={0.1145}
            maximum={0.128}
            revealDelay={0.088}
          />
        </motion.div>
      </motion.div>

      <motion.div
        className="close-result"
        initial={false}
        animate={{
          opacity: resultVisible ? (handoffStarted ? 0 : 1) : 0,
          y: resultVisible ? (handoffStarted ? '6vmin' : 0) : 24,
          scale: resultVisible ? (handoffStarted ? 0.18 : 1) : 0.96,
        }}
        transition={
          handoffStarted
            ? { duration: 0.58, ease: [0.22, 1, 0.36, 1] }
            : { type: 'spring', stiffness: 250, damping: 24 }
        }
        aria-hidden={!resultVisible || handoffStarted}
      >
        <div className="close-result-title">Отдельный учебный сетап · $1 000</div>
        <div className="close-balance">
          1 000 <span>→</span> {formatUsd(SETUP.investedUsd + SETUP_PNL)}
        </div>
        <div className="close-profit">+${formatUsd(SETUP_PNL)} · ДО КОМИССИЙ</div>
        <div className="close-disclaimer">
          Исторический учебный расчёт · не инвестиционная рекомендация · синтезированная озвучка.
        </div>
      </motion.div>

      <motion.div
        className="close-stake-token"
        initial={false}
        animate={
          handoffStarted
            ? { opacity: 1, scale: 1, y: 0 }
            : { opacity: 0, scale: 0.64, y: 18 }
        }
        transition={
          handoffStarted
            ? { delay: 0.08, duration: 1.25, ease: [0.22, 1, 0.36, 1] }
            : { duration: 0.2 }
        }
        aria-hidden={!handoffStarted}
      >
        <span className="close-stake-currency">$</span>1 000
      </motion.div>

      <motion.div
        className="scene-footer"
        animate={{
          opacity: handoffStarted ? 0 : 1,
          y: handoffStarted ? 8 : 0,
        }}
        transition={{ duration: 0.35 }}
      >
        <span>HBARUSDT · BINANCE SPOT</span>
        <span>28.09.2026 UTC · ДО КОМИССИЙ И ПРОСКАЛЬЗЫВАНИЯ</span>
      </motion.div>
    </motion.section>
  );
}