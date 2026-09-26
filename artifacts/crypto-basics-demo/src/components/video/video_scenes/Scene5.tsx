import { motion } from 'framer-motion';

import { CryptoToken } from '../CryptoToken';

const EASE = [0.22, 1, 0.36, 1] as const;

const FINAL_NODES = [
  { x: '18%', y: '40%', delay: 0 },
  { x: '82%', y: '39%', delay: 0.08 },
  { x: '20%', y: '65%', delay: 0.16 },
  { x: '80%', y: '65%', delay: 0.24 },
  { x: '50%', y: '32%', delay: 0.32 },
];

export function Scene5() {
  return (
    <motion.section
      className="crypto-scene crypto-scene--takeaway"
      initial={{ clipPath: 'inset(50% 0 50% 0)', opacity: 0.5 }}
      animate={{ clipPath: 'inset(0% 0 0% 0)', opacity: 1 }}
      exit={{ clipPath: 'inset(0 50% 0 50%)', scale: 1.06, opacity: 0 }}
      transition={{ duration: 0.54, ease: EASE }}
    >
      <motion.div
        className="takeaway-ring"
        initial={{ scale: 0.54, rotate: -24, opacity: 0.4 }}
        animate={{ scale: [0.54, 1.06, 1], rotate: [-24, 4, 0], opacity: [0.4, 0.9, 0.62] }}
        transition={{ duration: 0.88, ease: EASE }}
      />
      <motion.p
        className="takeaway-kicker"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.36, ease: EASE }}
      >
        ЦИФРОВОЙ АКТИВ
      </motion.p>
      <motion.h2
        className="takeaway-title"
        initial={{ opacity: 0, scale: 1.12, filter: 'blur(8px)' }}
        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
        transition={{ delay: 0.82, duration: 0.48, ease: EASE }}
      >
        <span>НЕ ГАРАНТИЯ</span>
        <span className="takeaway-title__accent">ДОХОДА</span>
      </motion.h2>
      <motion.p
        className="takeaway-caption"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.05, duration: 0.42, ease: EASE }}
      >
        Технология и риск — разные вещи.
      </motion.p>
      <div className="takeaway-nodes">
        {FINAL_NODES.map((node) => (
          <motion.i
            key={node.x}
            style={{ left: node.x, top: node.y }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: [0, 0.9, 0.2], scale: [0, 1, 0.55], x: ['0%', '0%', '50%'], y: ['0%', '0%', '0%'] }}
            transition={{ delay: 1.02 + node.delay, duration: 1.38, ease: EASE }}
          />
        ))}
      </div>
      <motion.div
        className="takeaway-token"
        initial={{ scale: 0.45, rotateY: -32, opacity: 0.1 }}
        animate={{ scale: [0.45, 1.04, 1], rotateY: [-32, 4, 0], opacity: [0.1, 1, 1] }}
        transition={{ delay: 2.58, duration: 0.92, ease: EASE }}
      >
        <CryptoToken />
      </motion.div>
      <motion.div
        className="takeaway-loop"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 0], opacity: [0, 0.8, 0] }}
        transition={{ delay: 5.45, duration: 1.35, ease: EASE }}
      />
    </motion.section>
  );
}