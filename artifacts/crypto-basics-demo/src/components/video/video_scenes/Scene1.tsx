import { motion } from 'framer-motion';

import { CryptoToken } from '../CryptoToken';

const EASE = [0.22, 1, 0.36, 1] as const;

const PARTICLES = [
  { left: '18%', top: '38%', x: -25, y: -22 },
  { left: '76%', top: '35%', x: 27, y: -17 },
  { left: '81%', top: '62%', x: 23, y: 17 },
  { left: '22%', top: '67%', x: -22, y: 21 },
  { left: '50%', top: '27%', x: 0, y: -27 },
  { left: '47%', top: '72%', x: 4, y: 24 },
];

export function Scene1() {
  return (
    <motion.section
      className="crypto-scene crypto-scene--hook"
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 0.6 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      exit={{ scale: 1.18, rotate: -1.5, opacity: 0, filter: 'blur(4px)' }}
      transition={{ duration: 0.52, ease: EASE }}
    >
      <div className="hook-glow" />
      <motion.div
        className="hook-ring"
        initial={{ scale: 0.74, rotate: -14, opacity: 0.25 }}
        animate={{ scale: [0.74, 1.05, 1], rotate: [-14, 3, 0], opacity: [0.25, 0.9, 0.7] }}
        transition={{ duration: 1.15, ease: EASE }}
      />
      <div className="hook-copy">
        <motion.p
          className="crypto-kicker"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18, duration: 0.34, ease: EASE }}
        >
          ЧТО ТАКОЕ
        </motion.p>
        <motion.h1
          className="hook-title"
          initial={{ opacity: 0, scale: 1.16, filter: 'blur(8px)' }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
          transition={{ delay: 0.52, duration: 0.42, ease: EASE }}
        >
          КРИПТО?
        </motion.h1>
      </div>
      <motion.div
        className="hook-token"
        initial={{ scale: 0.72, rotateY: 28, rotateZ: -7 }}
        animate={{ scale: [0.72, 1.07, 1], rotateY: [28, -6, 0], rotateZ: [-7, 2, 0] }}
        transition={{ duration: 1.18, delay: 0.2, ease: EASE }}
      >
        <CryptoToken />
      </motion.div>
      <div className="hook-particles">
        {PARTICLES.map((particle, index) => (
          <motion.i
            key={particle.left}
            style={{ left: particle.left, top: particle.top }}
            initial={{ opacity: 0, scale: 0.2 }}
            animate={{
              opacity: [0, 0.9, 0.5],
              scale: [0.2, 1, 0.72],
              x: [0, particle.x, 0],
              y: [0, particle.y, 0],
            }}
            transition={{ delay: 1.1 + index * 0.08, duration: 1.25, ease: EASE }}
          />
        ))}
      </div>
      <motion.div
        className="hook-answer"
        initial={{ opacity: 0, y: 18, clipPath: 'inset(0 50% 0 50%)' }}
        animate={{ opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0%)' }}
        transition={{ delay: 1.35, duration: 0.48, ease: EASE }}
      >
        ЦИФРОВОЙ АКТИВ
      </motion.div>
      <motion.div
        className="hook-sweep"
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: [0, 1, 0], opacity: [0, 0.78, 0] }}
        transition={{ delay: 3.72, duration: 1.05, ease: EASE }}
      />
    </motion.section>
  );
}