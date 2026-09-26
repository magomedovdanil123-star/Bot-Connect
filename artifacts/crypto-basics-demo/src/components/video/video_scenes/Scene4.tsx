import { motion } from 'framer-motion';

const EASE = [0.22, 1, 0.36, 1] as const;

export function Scene4() {
  return (
    <motion.section
      className="crypto-scene crypto-scene--access"
      initial={{ clipPath: 'circle(0% at 50% 52%)', opacity: 0.7 }}
      animate={{ clipPath: 'circle(120% at 50% 52%)', opacity: 1 }}
      exit={{ scale: 0.96, opacity: 0, clipPath: 'circle(0% at 50% 52%)' }}
      transition={{ duration: 0.54, ease: EASE }}
    >
      <div className="access-light" />
      <motion.div
        className="access-presenter"
        initial={{ opacity: 0, scale: 0.9, rotate: 2, x: 16 }}
        animate={{ opacity: 1, scale: 1, rotate: 0, x: 0 }}
        transition={{ delay: 0.26, duration: 0.62, ease: EASE }}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/crypto-presenter-cutout.png`}
          alt=""
          draggable="false"
        />
      </motion.div>
      <motion.h2
        className="access-title"
        initial={{ opacity: 0, x: -22 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.24, duration: 0.4, ease: EASE }}
      >
        КЛЮЧ
        <br />
        <span>= ДОСТУП</span>
      </motion.h2>
      <motion.div
        className="access-key"
        initial={{ scale: 0.74, rotate: -52, opacity: 0 }}
        animate={{ scale: [0.74, 1.08, 1], rotate: [-52, 5, 0], opacity: 1 }}
        transition={{ duration: 0.86, ease: EASE }}
      >
        <div className="access-key__ring">
          <div />
        </div>
        <div className="access-key__shaft" />
        <div className="access-key__tooth access-key__tooth--one" />
        <div className="access-key__tooth access-key__tooth--two" />
      </motion.div>
      <motion.p
        className="access-warning"
        initial={{ opacity: 0, y: 13 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.28, duration: 0.42, ease: EASE }}
      >
        Потеря ключа может означать
        <br />
        потерю доступа.
      </motion.p>
      <motion.div
        className="access-keyhole"
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: [0.4, 1.12, 1], opacity: [0, 0.95, 0.65] }}
        transition={{ delay: 2.3, duration: 0.8, ease: EASE }}
      />
    </motion.section>
  );
}