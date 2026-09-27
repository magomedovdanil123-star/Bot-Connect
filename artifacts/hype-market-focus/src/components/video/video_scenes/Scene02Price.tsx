import { motion } from 'framer-motion';

import { DataGrid, EASE, Eyebrow, Ring, SourceLine } from './scene-common';

const samples = [
  { date: '29 АВГ', value: '$80.92', x: 270, y: 90 },
  { date: '03 СЕН', value: '$81.92', x: 330, y: 220 },
  { date: '08 СЕН', value: '$85.14', x: 525, y: 350 },
  { date: '13 СЕН', value: '$79.65', x: 205, y: 480 },
  { date: '18 СЕН', value: '$85.06', x: 520, y: 610 },
  { date: '23 СЕН', value: '$97.19', x: 890, y: 740 },
  { date: '27 СЕН', value: '~$92.94', x: 760, y: 870 },
];

const points = samples.map(({ x, y }) => `${x},${y}`).join(' ');

export function Scene02Price() {
  return (
    <motion.section
      className="film-scene scene-price"
      initial={{ opacity: 0, clipPath: 'inset(0 50% 0 50%)', scale: 1.05 }}
      animate={{ opacity: 1, clipPath: 'inset(0 0 0 0)', scale: 1 }}
      exit={{ opacity: 0, clipPath: 'inset(0 0 100% 0)', rotateX: -12 }}
      transition={{ duration: 0.52, ease: EASE }}
    >
      <DataGrid />
      <div className="price-header">
        <Eyebrow>HYPE / USD</Eyebrow>
        <h2 className="price-title">ЦЕНОВЫЕ СНИМКИ</h2>
        <p className="price-window">29 АВГ — 27 СЕН · ВЫБОРКА</p>
      </div>
      <div className="price-data-stage">
        <svg
          className="price-graph"
          viewBox="0 0 1000 1000"
          role="img"
          aria-label="Семь выборочных ценовых точек HYPE от 29 августа до 27 сентября"
        >
          <path
            d="M270 90 L330 220 L525 350 L205 480 L520 610 L890 740 L760 870"
            fill="none"
            stroke="rgba(214,255,57,.14)"
            strokeWidth="18"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <motion.polyline
            points={points}
            fill="none"
            stroke="#d6ff39"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={1}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.55, ease: 'easeInOut', delay: 0.18 }}
          />
          {samples.map((sample, index) => (
            <motion.g
              key={sample.date}
              initial={{ opacity: 0, scale: 0.3 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.34 + index * 0.29, duration: 0.25 }}
              style={{ transformOrigin: `${sample.x}px ${sample.y}px` }}
            >
              <circle
                cx={sample.x}
                cy={sample.y}
                r={index === 5 ? 19 : 13}
                fill={index === 3 ? '#ff6559' : '#d6ff39'}
              />
              <circle
                cx={sample.x}
                cy={sample.y}
                r={index === 5 ? 30 : 23}
                fill="none"
                stroke={index === 3 ? '#ff6559' : '#d6ff39'}
                strokeOpacity=".55"
                strokeWidth="2"
              />
            </motion.g>
          ))}
        </svg>
        <div className="price-sample-list">
          {samples.map((sample, index) => (
            <motion.div
              className={`price-sample-row ${index === 3 ? 'is-down' : ''} ${index === 5 ? 'is-peak' : ''}`}
              key={sample.date}
              initial={{ opacity: 0, x: 30, clipPath: 'inset(0 0 0 100%)' }}
              animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0 0 0)' }}
              transition={{ delay: 0.36 + index * 0.29, duration: 0.32, ease: EASE }}
            >
              <span>{sample.date}</span>
              <strong>{sample.value}</strong>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="price-footer">
        <SourceLine>Выборка цен, не свечи · CoinGecko</SourceLine>
        <Ring className="price-end-ring" />
      </div>
      <motion.div
        className="price-ath-tag"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 1, 1, 0], scale: [0.8, 1, 1, 0.9] }}
        transition={{ duration: 1.8, delay: 2.15, times: [0, 0.18, 0.78, 1] }}
      >
        ATH $97.96 · 23 СЕН
      </motion.div>
    </motion.section>
  );
}