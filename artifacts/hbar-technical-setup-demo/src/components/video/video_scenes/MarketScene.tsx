import { motion } from 'framer-motion';

import { MarketChart } from '../MarketChart';
import { FOUR_HOUR_BREAKOUT, MARKET_SNAPSHOT } from '../marketData';

const BREAKOUT_LEVEL = [{ price: 0.1, label: 'ПРОБОЙ', color: '#d5ba7a' }];

export function MarketScene() {
  return (
    <motion.section
      className="scene market-scene"
      initial={{ opacity: 1, clipPath: 'inset(0 0 42% 0)' }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0% 0)' }}
      exit={{ opacity: 0, scale: 1.08, filter: 'blur(5px)' }}
      transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="scene-header">
        <div className="scene-kicker">
          <strong>{MARKET_SNAPSHOT.ticker}</strong>
          <span>ТЕХНИЧЕСКИЙ РАЗБОР</span>
        </div>
        <div className="data-pill">4H</div>
      </div>

      <div className="scene-kicker" style={{ marginTop: '4.5vmin' }}>
        <span>ТЕПЕРЬ — ГРАФИК ЭТОГО ДВИЖЕНИЯ</span>
      </div>
      <div className="market-current">$0.11838 <span>· +5,706% / 24H</span></div>

      <div className="chart-wrap">
        <MarketChart
          candles={FOUR_HOUR_BREAKOUT}
          levels={BREAKOUT_LEVEL}
          minimum={0.09}
          maximum={0.132}
          revealDelay={0.085}
        />
      </div>

      <motion.div
        className="result-row"
        style={{ marginTop: '3.5vmin', alignItems: 'flex-end' }}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55, duration: 0.4 }}
      >
        <div>
          <div className="chart-caption">ЗАКРЫТИЕ СВЕЧИ</div>
          <div className="market-current" style={{ marginTop: '0.5vmin', fontSize: '3.7vmin' }}>
            $0.11752
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="chart-caption">ОБЪЁМ К ПРЕДЫДУЩЕЙ</div>
          <div className="market-current" style={{ marginTop: '0.5vmin', color: '#d5ba7a', fontSize: '3.7vmin' }}>
            ×7,7
          </div>
        </div>
      </motion.div>

      <div className="scene-footer" style={{ marginTop: 'auto', paddingTop: '3vmin' }}>
        <span>BINANCE SPOT · HBARUSDT</span>
        <span>28.09.2026 UTC · ИСТОРИЯ</span>
      </div>
    </motion.section>
  );
}