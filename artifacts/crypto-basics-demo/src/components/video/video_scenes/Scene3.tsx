import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

const NODES = [
  { cx: 64, cy: 222, r: 16, delay: 0.72 },
  { cx: 166, cy: 154, r: 11, delay: 1.0 },
  { cx: 286, cy: 216, r: 19, delay: 1.28 },
  { cx: 344, cy: 354, r: 10, delay: 1.55 },
  { cx: 242, cy: 444, r: 16, delay: 1.82 },
  { cx: 108, cy: 432, r: 10, delay: 2.1 },
  { cx: 182, cy: 318, r: 13, delay: 2.38 },
];

const EDGES = [
  'M64 222 L166 154 L286 216 L344 354',
  'M64 222 L108 432 L242 444 L344 354',
  'M166 154 L182 318 L242 444',
  'M286 216 L182 318 L108 432',
];

export function Scene3() {
  return (
    <motion.section
      className="crypto-scene crypto-scene--network"
      initial={{ clipPath: 'inset(50% 0 50% 0)', opacity: 0.4, rotateX: -8 }}
      animate={{ clipPath: 'inset(0% 0 0% 0)', opacity: 1, rotateX: 0 }}
      exit={{ clipPath: 'inset(0 50% 0 50%)', scale: 1.08, opacity: 0 }}
      transition={{ duration: 0.52, ease: EASE }}
    >
      <div className="network-orbit network-orbit--one" />
      <div className="network-orbit network-orbit--two" />
      <motion.h2
        className="network-title"
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.42, ease: EASE }}
      >
        СЕТЬ СВЕРЯЕТ
        <br />
        ДАННЫЕ
      </motion.h2>
      <motion.svg
        className="network-map"
        viewBox="0 0 420 590"
        role="img"
        aria-label="Схематичная сеть узлов и записей"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, ease: EASE }}
      >
        <defs>
          <radialGradient id="network-node">
            <stop offset="0%" stopColor="#D9F79C" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#83E2BE" stopOpacity="0.08" />
          </radialGradient>
        </defs>
        {EDGES.map((edge, index) => (
          <motion.path
            key={edge}
            d={edge}
            fill="none"
            stroke={index % 2 === 0 ? '#83E2BE' : '#D9F79C'}
            strokeWidth={index === 0 ? 2.4 : 1.4}
            strokeOpacity={index === 0 ? 0.7 : 0.28}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.52 + index * 0.16, duration: 0.64, ease: EASE }}
          />
        ))}
        {NODES.map((node, index) => (
          <g key={`${node.cx}-${node.cy}`}>
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r={node.r * 2.8}
              fill="url(#network-node)"
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0, 0.48, 0.18], scale: [0.4, 1.15, 1] }}
              transition={{ delay: node.delay, duration: 0.62, ease: EASE }}
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            />
            <motion.circle
              cx={node.cx}
              cy={node.cy}
              r={node.r}
              fill="#0B1714"
              stroke={index === 2 ? '#D9F79C' : '#83E2BE'}
              strokeWidth={index === 2 ? 3 : 2}
              initial={{ opacity: 0, scale: 0.2 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: node.delay, duration: 0.36, type: 'spring', stiffness: 290, damping: 24 }}
              style={{ transformOrigin: `${node.cx}px ${node.cy}px` }}
            />
          </g>
        ))}
        <motion.circle
          cx="64"
          cy="222"
          r="6"
          fill="#F7D19A"
          animate={{ cx: [64, 166, 286, 344, 242], cy: [222, 154, 216, 354, 444] }}
          transition={{ delay: 1.12, duration: 2.2, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.45 }}
        />
      </motion.svg>
      <motion.div
        className="network-blocks"
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.18, duration: 0.42, ease: EASE }}
      >
        <i />
        <i />
        <i />
      </motion.div>
      <motion.p
        className="network-caption"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.42, duration: 0.4, ease: EASE }}
      >
        Во многих сетях переводы
        <br />
        записываются в блокчейн.
      </motion.p>
      <motion.div
        className="network-key-line"
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 1 }}
        transition={{ delay: 4.38, duration: 0.76, ease: EASE }}
      />
    </motion.section>
  );
}