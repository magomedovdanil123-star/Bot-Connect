import { useState } from 'react';
import { motion } from 'framer-motion';
import { useSceneTimer } from '@/lib/video';

import { formatUsd, MARKET_SNAPSHOT, TWENTY_FOUR_HOUR_PNL } from '../marketData';

const COUNT_STEPS = Array.from({ length: 22 }, (_, index) => {
  const progress = (index + 1) / 22;
  return {
    time: 430 + index * 34,
    value: MARKET_SNAPSHOT.investmentUsd + TWENTY_FOUR_HOUR_PNL * progress,
  };
});

export function ProfitScene() {
  const [balance, setBalance] = useState(MARKET_SNAPSHOT.investmentUsd);
  const [profitVisible, setProfitVisible] = useState(false);

  useSceneTimer([
    ...COUNT_STEPS.map((step) => ({
      time: step.time,
      callback: () => setBalance(step.value),
    })),
    { time: 1200, callback: () => setProfitVisible(true) },
  ]);

  return (
    <motion.section
      className="scene profit-scene"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(6px)' }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <div className="scene-header">
          <div className="scene-kicker">
            <strong>HBAR / USDT</strong>
            <span>24 ЧАСА</span>
          </div>
          <motion.div
            className="change-pill"
            initial={{ opacity: 0, scale: 0.82 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 280, damping: 18 }}
          >
            +5,706%
          </motion.div>
        </div>

        <div className="market-data-row">
          <div className="market-data-cell">
            <span>Диапазон суток</span>
            <strong>$0.11110 — $0.13096</strong>
          </div>
          <div className="market-data-cell" style={{ textAlign: 'right' }}>
            <span>Сейчас</span>
            <strong>$0.11838</strong>
          </div>
        </div>
      </div>

      <div className="profit-hero">
        <motion.div
          className="profit-label"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          Условные $1 000
        </motion.div>
        <motion.div
          className="profit-balance"
          key={Math.round(balance * 100)}
          initial={{ y: 8, opacity: 0.84 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.12 }}
        >
          {formatUsd(balance)}
        </motion.div>
        <div className="profit-currency">USDT НА ВЫХОДЕ · ДО КОМИССИЙ</div>
        <motion.div
          className="profit-callout"
          initial={false}
          animate={{
            opacity: profitVisible ? 1 : 0,
            y: profitVisible ? 0 : 12,
            scale: profitVisible ? 1 : 0.96,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 22 }}
        >
          <div className="profit-gain">+${formatUsd(TWENTY_FOUR_HOUR_PNL)}</div>
          <div className="profit-gain-caption">Доход · 24 часа</div>
        </motion.div>
      </div>

      <div className="scene-footer">
        <span>BINANCE SPOT</span>
        <span>СНИМОК · {MARKET_SNAPSHOT.snapshotAt}</span>
      </div>
    </motion.section>
  );
}