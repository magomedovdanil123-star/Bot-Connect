import type { CSSProperties, PropsWithChildren } from 'react';
import { motion } from 'framer-motion';

export const EASE = [0.22, 1, 0.36, 1] as const;

export function DataGrid({ pale = false }: { pale?: boolean }) {
  return (
    <div
      className={`data-grid ${pale ? 'data-grid--pale' : ''}`}
      aria-hidden="true"
    />
  );
}

export function Ring({
  className = '',
  style,
  children,
}: PropsWithChildren<{ className?: string; style?: CSSProperties }>) {
  return (
    <motion.div className={`market-ring ${className}`} style={style}>
      <span className="market-ring__inner" />
      {children}
    </motion.div>
  );
}

export function Eyebrow({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return <p className={`film-eyebrow ${className}`}>{children}</p>;
}

export function SourceLine({
  children,
  className = '',
}: PropsWithChildren<{ className?: string }>) {
  return <p className={`film-source ${className}`}>{children}</p>;
}