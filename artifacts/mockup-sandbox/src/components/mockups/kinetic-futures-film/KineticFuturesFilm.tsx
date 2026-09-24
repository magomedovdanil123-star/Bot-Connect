import { useEffect, useState } from "react";

const chapters = [
  {
    index: "01",
    eyebrow: "КОНТРАКТ · СЕГОДНЯ",
    title: "Цена задана.",
    caption: "Фьючерс фиксирует цену сегодня — расчёт будет позже.",
    note: "ДАТА И ЦЕНА ЗАКРЕПЛЕНЫ",
  },
  {
    index: "02",
    eyebrow: "ЗАЛОГ · ПОЗИЦИЯ",
    title: "Движение усилено.",
    caption: "Залог открывает позицию крупнее; движение усиливается.",
    note: "ОДИН ЗАЛОГ · БОЛЬШАЯ ПОЗИЦИЯ",
  },
  {
    index: "03",
    eyebrow: "СЦЕНАРИЙ · РЕЗУЛЬТАТ",
    title: "Риск симметричен.",
    caption: "Выше точки входа — прибыль. Ниже — убыток.",
    note: "ПОТЕНЦИАЛ И РИСК РАСТУТ ВМЕСТЕ",
  },
] as const;

function HumanPresenter({ chapterIndex }: { chapterIndex: number }) {
  return (
    <svg className={`kff-human kff-human-${chapterIndex}`} viewBox="0 0 150 126" aria-hidden="true">
      <defs>
        <linearGradient id="kff-human-skin" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f2c7a2" />
          <stop offset=".58" stopColor="#dca37d" />
          <stop offset="1" stopColor="#b87960" />
        </linearGradient>
        <linearGradient id="kff-human-coat" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#788b7b" />
          <stop offset=".55" stopColor="#496057" />
          <stop offset="1" stopColor="#263c37" />
        </linearGradient>
        <linearGradient id="kff-human-hair" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#5b493b" />
          <stop offset=".5" stopColor="#34332e" />
          <stop offset="1" stopColor="#1d2723" />
        </linearGradient>
        <linearGradient id="kff-human-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#f1ead9" />
          <stop offset="1" stopColor="#cfcbbb" />
        </linearGradient>
        <radialGradient id="kff-human-halo">
          <stop stopColor="#52745b" stopOpacity=".55" />
          <stop offset="1" stopColor="#17312d" stopOpacity=".08" />
        </radialGradient>
      </defs>
      <ellipse cx="75" cy="97" rx="72" ry="34" fill="url(#kff-human-halo)" />
      <path d="M43 124c4-21 15-32 31-35h18c18 4 28 15 32 35Z" fill="url(#kff-human-coat)" stroke="#b8c4ac" strokeOpacity=".32" />
      <path d="m62 91 13 11 13-11 9 33H53Z" fill="url(#kff-human-shirt)" />
      <path d="m70 101 5 4 6-4-2 8 4 10-8 8-8-8 4-10Z" fill="#bd9e68" />
      <path d="m62 91 13 11-9 8-10-15Zm26 0-13 11 9 8 10-15Z" fill="#879486" stroke="#e1cfaa" strokeOpacity=".34" />
      {chapterIndex === 0 && (
        <g className="kff-hand-gesture kff-hand-explain">
          <path d="M48 94c-8 2-13 8-19 16l-8 10 9 6 22-14 9-11Z" fill="url(#kff-human-coat)" />
          <path d="M25 117c-5 0-9-3-12-8l-4-6c-2-3 2-5 4-2l5 5-3-8c-1-3 3-4 5-1l4 8-2-7c-1-3 3-4 4-1l4 8-1-5c0-3 4-3 4 0l1 9 7 4-10 9-7-1Z" fill="url(#kff-human-skin)" stroke="#895f4b" strokeWidth="1" />
          <path d="M102 94c8 2 13 8 19 16l8 10-9 6-22-14-9-11Z" fill="url(#kff-human-coat)" />
          <path d="M125 117c5 0 9-3 12-8l4-6c2-3-2-5-4-2l-5 5 3-8c1-3-3-4-5-1l-4 8 2-7c1-3-3-4-4-1l-4 8 1-5c0-3-4-3-4 0l-1 9-7 4 10 9 7-1Z" fill="url(#kff-human-skin)" stroke="#895f4b" strokeWidth="1" />
        </g>
      )}
      {chapterIndex === 1 && (
        <g className="kff-hand-gesture kff-hand-point">
          <path d="M49 94c-8 2-14 9-19 17l-7 10 10 5 19-15 9-11Z" fill="url(#kff-human-coat)" />
          <path d="M39 115c7-5 14-7 21-5l8 5-11 9-11 4-9-3Z" fill="url(#kff-human-skin)" stroke="#895f4b" strokeWidth="1" />
          <path d="M101 94c9 1 15 6 19 14l6 7-10 7-16-13-9-9Z" fill="url(#kff-human-coat)" />
          <path d="M120 111c5-7 8-14 10-21l4-13c1-4 6-4 7 0v13l8-6c3-2 6 1 4 4l-9 13c-5 7-10 12-17 15l-9-3Z" fill="url(#kff-human-skin)" stroke="#895f4b" strokeWidth="1" />
        </g>
      )}
      {chapterIndex === 2 && (
        <g className="kff-hand-gesture kff-hand-warning">
          <path d="M49 94c-8 2-14 9-19 17l-7 10 10 5 19-15 9-11Z" fill="url(#kff-human-coat)" />
          <path d="M28 116c-5 0-8-4-8-9l1-10c0-3 4-4 5-1l1 7 1-11c0-3 4-4 5 0l1 10 3-8c1-3 4-2 4 1v10l4-6c2-3 5-1 4 2l-3 11-10 7Z" fill="url(#kff-human-skin)" stroke="#895f4b" strokeWidth="1" />
          <path d="M102 94c9 2 15 8 19 16l5 9-10 6-16-14-8-10Z" fill="url(#kff-human-coat)" />
          <path d="M117 112c5-2 9-7 12-13l5-9c2-3 6-2 5 2l-2 7 7-8c2-3 5-1 4 2l-6 11 6-5c3-2 5 1 3 4l-9 11c-5 5-10 7-16 7l-11-4Z" fill="url(#kff-human-skin)" stroke="#895f4b" strokeWidth="1" />
        </g>
      )}
      <g className={`kff-human-head kff-human-head-${chapterIndex}`}>
        <path d="M51 44c-4-3-7 1-6 6 1 5 4 8 7 8Zm48 0c4-3 7 1 6 6-1 5-4 8-7 8Z" fill="url(#kff-human-skin)" />
        <path d="M53 39c0-18 9-29 23-29 16 0 26 12 25 30l-3 21c-2 14-11 23-22 23s-20-9-22-23Z" fill="url(#kff-human-skin)" stroke="#9f6c53" strokeWidth="1.3" />
        <path d="M48 43c-3-16 1-29 10-36 8-6 18-7 28-4 12 5 18 15 18 29 0 5-1 8-3 12-4-3-7-8-9-14-12 4-25 3-36-2-2 6-4 11-8 15Z" fill="url(#kff-human-hair)" />
        <path d="M58 15c8-8 19-10 29-6m-25 1c9-6 19-6 28-2m-22-5c8-3 15-2 21 1" fill="none" stroke="#b69a75" strokeOpacity=".4" strokeWidth="1.8" strokeLinecap="round" />
        <path d={chapterIndex === 2 ? "M56 44q7-5 14-1m10 0q7-4 14 1" : "M56 41q7-5 14-2m10 0q7-3 14 2"} fill="none" stroke="#47382f" strokeWidth="2" strokeLinecap="round" />
        <g className="kff-human-blink">
          <ellipse cx="63" cy="51" rx="5.2" ry="4.3" fill="#fff6e7" />
          <ellipse cx="89" cy="51" rx="5.2" ry="4.3" fill="#fff6e7" />
          <circle cx="65" cy="51" r="2.6" fill="#4b6454" />
          <circle cx="87" cy="51" r="2.6" fill="#4b6454" />
          <circle cx="65.8" cy="50.2" r=".9" fill="#fff" />
          <circle cx="87.8" cy="50.2" r=".9" fill="#fff" />
        </g>
        <path d="M76 53c-1 5-3 8-4 11 2 2 5 2 7 1" fill="none" stroke="#a66f56" strokeWidth="1.4" strokeLinecap="round" />
        {chapterIndex === 2
          ? <path d="M67 70q9-3 18 0" fill="none" stroke="#814b42" strokeWidth="2" strokeLinecap="round" />
          : <ellipse cx="76" cy="69" rx="4.4" ry="3.2" fill="#793f38" className="kff-human-speaking" />}
      </g>
    </svg>
  );
}

function Guide({ chapterIndex }: { chapterIndex: number }) {
  return (
    <div className="kff-guide">
      <svg className="kff-portrait" viewBox="0 0 88 88" aria-hidden="true">
        <defs>
          <linearGradient id="kff-face" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#e7b891" />
            <stop offset="1" stopColor="#aa7058" />
          </linearGradient>
          <linearGradient id="kff-coat" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#6a7f72" />
            <stop offset="1" stopColor="#263e3b" />
          </linearGradient>
        </defs>
        <circle cx="44" cy="44" r="43" fill="#162b2a" />
        <path d="M14 87c2-17 12-25 30-25s28 8 30 25" fill="url(#kff-coat)" />
        <path d="M35 54v11l9 8 9-8V53" fill="url(#kff-face)" />
        <path d="M27 34c1-14 8-22 18-22 13 0 20 9 18 24l-2 14c-2 11-8 17-17 17s-15-7-17-17Z" fill="url(#kff-face)" />
        <path d="M26 37c-2-15 1-25 10-30 9-5 22-3 28 6 4 6 4 15 2 23l-5-11c-9 3-17 1-24-3-2 7-6 12-11 15Z" fill="#202b28" />
        <path d="M35 42c3-2 6-2 9 0m5 0c3-2 6-2 9 0" fill="none" stroke="#533c34" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M39 54c4 2 8 2 12 0" fill="none" stroke="#714c40" strokeWidth="1.8" strokeLinecap="round" />
        <path d="m36 63 8 8 8-8" fill="none" stroke="#d3bb8e" strokeWidth="1.5" />
      </svg>
      <HumanPresenter chapterIndex={chapterIndex} />
      <div className="kff-guide-copy">
        <span className="kff-guide-label">ВАШ ГИД</span>
        <strong>Фьючерсный рынок</strong>
        <span className="kff-guide-role">ведущий объясняет на графике</span>
      </div>
      <span className="kff-guide-live"><i /> В ЭФИРЕ</span>
    </div>
  );
}

export function KineticFuturesFilm() {
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing) return;
    const startedAt = performance.now() - elapsed;
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - startedAt) % 18000);
    }, 32);
    return () => window.clearInterval(timer);
  }, [playing]);

  const chapterIndex = Math.floor(elapsed / 6000);
  const chapterTime = elapsed % 6000;
  const progress = elapsed / 18000;
  const chapter = chapters[chapterIndex];
  const markerX = 61 + progress * 384;
  const markerY =
    progress < 0.5
      ? 258 - (progress / 0.5) * 102
      : 156 - ((progress - 0.5) / 0.5) * 110;
  const price = (4218.4 + (progress - 0.5) * 132).toFixed(1);
  const change = ((progress - 0.5) * 4.26).toFixed(2);
  const positive = progress >= 0.5;

  return (
    <main className="kff-shell" aria-label="Кинетический ролик: как работают фьючерсы">
      <style>{`
        .kff-shell {
          --bg: #0a1515;
          --panel: #101e1d;
          --panel-hi: #172725;
          --line: rgba(194, 207, 184, .15);
          --paper: #e8e8d8;
          --subtle: #92a19a;
          --mint: #b7d79b;
          --amber: #dfbd79;
          --red: #dc9279;
          position: fixed;
          isolation: isolate;
          overflow: hidden;
          container-type: inline-size;
          width: min(100vw, 56.25dvh);
          height: min(100dvh, 177.778vw);
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          box-shadow: 0 0 0 100vmax #0a1515;
          aspect-ratio: 9 / 16;
          color: var(--paper);
          background:
            radial-gradient(ellipse at 52% 38%, rgba(91, 127, 99, .17), transparent 48%),
            linear-gradient(158deg, #142221 0%, var(--bg) 47%, #0d1919 100%);
          font-family: "Manrope", "Avenir Next", ui-sans-serif, system-ui, sans-serif;
          font-variant-numeric: tabular-nums lining-nums;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .kff-shell *, .kff-shell *::before, .kff-shell *::after { box-sizing: border-box; }
        .kff-shell::before {
          content: "";
          position: absolute;
          z-index: 8;
          inset: 0;
          pointer-events: none;
          opacity: .11;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.3'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }
        .kff-shell::after {
          content: "";
          position: absolute;
          z-index: 7;
          inset: 0;
          pointer-events: none;
          background: linear-gradient(180deg, rgba(4, 10, 10, .27), transparent 19%, transparent 77%, rgba(4, 10, 10, .48));
        }
        .kff-topline {
          position: absolute;
          z-index: 3;
          inset: 5.2% 7% auto;
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #c2cabb;
          font: 700 2.1cqw/1 ui-monospace, "SFMono-Regular", Consolas, monospace;
          letter-spacing: .16em;
        }
        .kff-brand { display: flex; align-items: center; gap: 2.1cqw; }
        .kff-brand-mark { color: var(--mint); font-size: 3.1cqw; letter-spacing: -.1em; }
        .kff-broadcast { display: flex; align-items: center; gap: 1.4cqw; color: #d9d6c5; }
        .kff-broadcast i, .kff-guide-live i {
          display: block; width: 1.35cqw; height: 1.35cqw; border-radius: 50%;
          background: var(--mint); box-shadow: 0 0 10px rgba(183,215,155,.48);
        }
        .kff-kicker {
          position: absolute;
          z-index: 3;
          top: 10.2%;
          left: 7%;
          display: flex;
          align-items: center;
          gap: 2.3cqw;
          color: var(--amber);
          font: 700 2.15cqw/1.3 ui-monospace, "SFMono-Regular", Consolas, monospace;
          letter-spacing: .1em;
          animation: kff-in .5s both;
        }
        .kff-kicker b { color: #84958b; font-weight: 500; }
        .kff-title {
          position: absolute;
          z-index: 3;
          top: 13.3%;
          left: 6.6%;
          width: 86.8%;
          margin: 0;
          color: #efefe2;
          font-size: 8.8cqw;
          font-weight: 760;
          letter-spacing: -.075em;
          line-height: .99;
          text-wrap: balance;
          animation: kff-in .55s cubic-bezier(.2,.75,.2,1) both;
        }
        .kff-title em { color: var(--mint); font-style: normal; }
        .kff-deck {
          position: absolute;
          z-index: 3;
          top: 23.6%;
          left: 7%;
          width: 74%;
          color: #aeb9ae;
          font-size: 2.75cqw;
          line-height: 1.55;
          letter-spacing: -.015em;
        }
        .kff-quote {
          position: absolute;
          z-index: 4;
          top: 29%;
          left: 6%;
          width: 88%;
          height: 39%;
          border: 1px solid rgba(200, 208, 184, .19);
          border-radius: 3.2cqw;
          background: linear-gradient(145deg, rgba(24, 42, 38, .88), rgba(12, 25, 24, .91));
          box-shadow: 0 24px 58px rgba(0,0,0,.23), inset 0 1px rgba(255,255,255,.035);
          overflow: hidden;
        }
        .kff-quote-head {
          position: absolute;
          top: 5.8%; left: 5.5%; right: 5.5%;
          display: flex; justify-content: space-between; align-items: start;
          padding-bottom: 4.5%;
          border-bottom: 1px solid rgba(206, 211, 191, .11);
        }
        .kff-quote-symbol { color: #f0eddd; font-size: 3.15cqw; font-weight: 730; letter-spacing: -.05em; }
        .kff-quote-contract { display: block; margin-top: .9cqw; color: #82938a; font: 600 1.7cqw/1 ui-monospace, monospace; letter-spacing: .13em; }
        .kff-live-price { text-align: right; color: #edeada; font: 600 3.1cqw/1 ui-monospace, monospace; letter-spacing: -.045em; }
        .kff-live-change { display: block; margin-top: 1.2cqw; color: var(--mint); font-size: 1.8cqw; letter-spacing: .025em; }
        .kff-chart {
          position: absolute;
          top: 20%; left: 3.7%;
          width: 92.6%; height: 70%;
          overflow: visible;
        }
        .kff-chart-label {
          fill: #87978d; font: 600 13px ui-monospace, monospace;
          letter-spacing: 1.25px;
        }
        .kff-axis-label { fill: #71847b; font: 600 12px ui-monospace, monospace; letter-spacing: .8px; }
        .kff-grid { stroke: rgba(205,216,195,.09); stroke-width: 1; }
        .kff-grid-v { stroke: rgba(205,216,195,.065); stroke-width: 1; }
        .kff-entry-label { fill: #d9c48f; font: 700 12px ui-monospace, monospace; letter-spacing: 1px; }
        .kff-path { stroke-dasharray: 640; stroke-dashoffset: 0; }
        .kff-marker-halo { animation: kff-halo 2.6s ease-in-out infinite; transform-origin: center; }
        .kff-cursor { stroke-dasharray: 3 6; }
        .kff-marker-readout {
          fill: #dfe6ce; font: 700 12px ui-monospace, monospace;
          letter-spacing: .7px;
        }
        .kff-graph-legend {
          position: absolute;
          z-index: 2;
          left: 6%; right: 6%; bottom: 4.2%;
          display: flex; justify-content: space-between;
          color: #94a39a; font: 600 1.7cqw/1 ui-monospace, monospace;
          letter-spacing: .08em;
        }
        .kff-graph-legend span { display: flex; align-items: center; gap: 1.5cqw; }
        .kff-legend-dot { width: 1.3cqw; height: 1.3cqw; border-radius: 50%; background: var(--mint); }
        .kff-legend-dot.loss { background: var(--red); }
        .kff-note {
          position: absolute;
          z-index: 3;
          top: 70.8%;
          left: 7%;
          display: flex;
          align-items: center;
          gap: 2.2cqw;
          color: #bdc8b7;
          font: 600 1.9cqw/1.2 ui-monospace, monospace;
          letter-spacing: .08em;
        }
        .kff-note i { width: 4.5cqw; height: 1px; background: var(--amber); }
        .kff-metric-row {
          position: absolute;
          z-index: 3;
          top: 74.8%;
          left: 7%; right: 7%;
          display: grid;
          grid-template-columns: 1fr 1fr 1.2fr;
          border-top: 1px solid var(--line);
          border-bottom: 1px solid var(--line);
          padding: 2.5cqw 0;
        }
        .kff-metric { padding-left: 3.1cqw; border-left: 1px solid var(--line); }
        .kff-metric:first-child { border-left: 0; padding-left: 0; }
        .kff-metric-label { display: block; color: #819188; font: 600 1.55cqw/1.2 ui-monospace, monospace; letter-spacing: .1em; }
        .kff-metric-value { display: block; margin-top: 1.2cqw; color: #e5e5d4; font: 650 3.2cqw/1 ui-monospace, monospace; letter-spacing: -.045em; }
        .kff-metric-value.accent { color: var(--mint); }
        .kff-guide {
          position: absolute;
          z-index: 3;
          left: 7%; right: 7%; bottom: 9.8%;
          display: flex; align-items: center; gap: 2.8cqw;
        }
        .kff-portrait {
          display: none;
        }
        .kff-human {
          flex: none;
          width: 25cqw;
          height: 22cqw;
          overflow: visible;
          filter: drop-shadow(0 4px 10px rgba(3, 12, 10, .44));
          animation: kff-host-breathe 3.2s ease-in-out infinite;
        }
        .kff-human-head {
          transform-box: fill-box;
          transform-origin: 50% 78%;
        }
        .kff-human-head-0 { animation: kff-head-explain 3s ease-in-out infinite; }
        .kff-human-head-1 { animation: kff-head-emphasis 2.2s ease-in-out infinite; }
        .kff-human-head-2 { animation: kff-head-caution 2.8s ease-in-out infinite; }
        .kff-human-blink {
          transform-box: fill-box;
          transform-origin: center;
          animation: kff-human-blink 5.2s 1.1s infinite;
        }
        .kff-human-speaking {
          transform-box: fill-box;
          transform-origin: center;
          animation: kff-human-talk .62s ease-in-out infinite alternate;
        }
        .kff-hand-gesture {
          transform-box: fill-box;
          transform-origin: 50% 35%;
        }
        .kff-human-0 .kff-hand-gesture { animation: kff-gesture-explain 2s ease-in-out infinite; }
        .kff-human-1 .kff-hand-gesture { animation: kff-gesture-point 2.4s ease-in-out infinite; }
        .kff-human-2 .kff-hand-gesture { animation: kff-gesture-warning 2.2s ease-in-out infinite; }
        @keyframes kff-host-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
        @keyframes kff-head-explain { 0%,100% { transform: rotate(0deg); } 48% { transform: rotate(-1.7deg); } 68% { transform: rotate(.6deg); } }
        @keyframes kff-head-emphasis { 0%,100% { transform: rotate(0deg); } 42% { transform: rotate(2.1deg); } 62% { transform: rotate(-.6deg); } }
        @keyframes kff-head-caution { 0%,100% { transform: rotate(0deg); } 35% { transform: rotate(-1.3deg); } 58% { transform: rotate(1deg); } }
        @keyframes kff-human-blink { 0%,46%,49%,100% { transform: scaleY(1); } 47.5% { transform: scaleY(.08); } }
        @keyframes kff-human-talk { from { transform: scaleY(.62); } to { transform: scaleY(1.12); } }
        @keyframes kff-gesture-explain { 0%,100% { transform: translateY(1px) rotate(-1deg); } 50% { transform: translateY(-3px) rotate(1.8deg); } }
        @keyframes kff-gesture-point { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(2px,-2px) rotate(1.3deg); } }
        @keyframes kff-gesture-warning { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-2px) rotate(-1.2deg); } }
        .kff-guide-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: .8cqw; }
        .kff-guide-label { color: var(--amber); font: 700 1.65cqw/1 ui-monospace, monospace; letter-spacing: .13em; }
        .kff-guide-copy strong { color: #e8e8d8; font-size: 2.65cqw; font-weight: 650; letter-spacing: -.03em; }
        .kff-guide-role { color: #8f9f95; font-size: 1.9cqw; }
        .kff-guide-live {
          flex: none; margin-left: auto; display: flex; align-items: center; gap: 1.2cqw; white-space: nowrap;
          color: #a9b6a9; font: 600 1.55cqw/1 ui-monospace, monospace; letter-spacing: .1em;
        }
        .kff-guide-live i { width: 1.05cqw; height: 1.05cqw; }
        .kff-caption {
          position: absolute;
          z-index: 9;
          left: 6%; right: 6%; bottom: 3.4%;
          display: flex; align-items: center; justify-content: space-between;
          gap: 3cqw;
        }
        .kff-caption p {
          max-width: 76%; margin: 0;
          color: #e8e9dc; font-size: 2.7cqw; line-height: 1.38; font-weight: 560;
          letter-spacing: -.02em;
          text-wrap: pretty;
          animation: kff-caption-in .45s both;
        }
        .kff-caption button {
          display: grid; place-items: center; flex: none;
          width: 8.8cqw; height: 8.8cqw;
          border: 1px solid rgba(208,216,196,.22); border-radius: 50%;
          color: #d7dfd0; background: rgba(24,42,38,.75);
          cursor: pointer; transition: background .2s ease, border-color .2s ease;
        }
        .kff-caption button:hover { background: #263b34; border-color: rgba(208,216,196,.5); }
        .kff-caption button svg { width: 2.4cqw; height: 2.4cqw; }
        .kff-progress {
          position: absolute; z-index: 9; bottom: 0; left: 0; right: 0;
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px;
          height: 2px; background: rgba(236,235,214,.12);
        }
        .kff-progress span { background: transparent; }
        .kff-progress span.is-active {
          background: var(--mint);
          transform-origin: left;
          transition: transform .045s linear;
        }
        @keyframes kff-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kff-caption-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes kff-halo { 0%,100% { opacity: .2; transform: scale(.8); } 50% { opacity: .75; transform: scale(1.35); } }
        @media (prefers-reduced-motion: reduce) {
          .kff-shell *, .kff-shell *::before, .kff-shell *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
        }
      `}</style>

      <header className="kff-topline">
        <div className="kff-brand"><span className="kff-brand-mark">▰</span><span>MARKET / FILM</span></div>
        <div className="kff-broadcast"><i /> FUTURES · 18 SEC</div>
      </header>

      <div className="kff-kicker" key={`kicker-${chapterIndex}`}>
        <span>{chapter.eyebrow}</span><b>{chapter.index} / 03</b>
      </div>
      <h1 className="kff-title" key={`title-${chapterIndex}`}>
        {chapterIndex === 0 ? <>Цена <em>задана.</em></> : chapterIndex === 1 ? <>Движение <em>усилено.</em></> : <>Риск <em>симметричен.</em></>}
      </h1>
      <div className="kff-deck">Как одна сделка связывает сегодняшний рынок с будущей ценой.</div>

      <section className="kff-quote" aria-label="Анимированная схема прибыли и убытка">
        <div className="kff-quote-head">
          <div>
            <div className="kff-quote-symbol">Фьючерс · индекс</div>
            <span className="kff-quote-contract">ИСПОЛНЕНИЕ · ПОЗЖЕ</span>
          </div>
          <div className="kff-live-price">
            {price}
            <span className="kff-live-change">{positive ? "+" : ""}{change}% / учебный сценарий</span>
          </div>
        </div>
        <svg className="kff-chart" viewBox="0 0 500 330" role="img" aria-label="Линия результата пересекает точку входа: убыток ниже, прибыль выше">
          <defs>
            <linearGradient id="kff-payoff" x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" stopColor="#d98d76" />
              <stop offset=".48" stopColor="#d7be83" />
              <stop offset="1" stopColor="#b8d89a" />
            </linearGradient>
            <linearGradient id="kff-area" x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="#b7d79b" stopOpacity=".14" />
              <stop offset="1" stopColor="#b7d79b" stopOpacity="0" />
            </linearGradient>
            <filter id="kff-glow"><feGaussianBlur stdDeviation="5" /></filter>
          </defs>
          {[42, 99, 156, 213, 270].map((y) => <path className="kff-grid" d={`M48 ${y}H454`} key={`h${y}`} />)}
          {[48, 129, 210, 291, 372, 454].map((x) => <path className="kff-grid-v" d={`M${x} 26V282`} key={`v${x}`} />)}
          <path d="M48 156H454" stroke="rgba(219,198,143,.47)" strokeWidth="1.3" />
          <path d="M251 30V278" stroke="rgba(221,203,159,.42)" strokeDasharray="3 6" />
          <text x="52" y="22" className="kff-chart-label">РЕЗУЛЬТАТ ПОЗИЦИИ</text>
          <text x="452" y="48" textAnchor="end" className="kff-axis-label">ПРИБЫЛЬ</text>
          <text x="452" y="267" textAnchor="end" className="kff-axis-label">УБЫТОК</text>
          <text x="251" y="302" textAnchor="middle" className="kff-entry-label">ТОЧКА ВХОДА</text>
          <path d="M61 258 C137 235 183 192 251 156 C321 119 368 80 445 46 L445 156H251C183 192 137 235 61 258Z" fill="url(#kff-area)" opacity=".6" />
          <path d="M61 258 C137 235 183 192 251 156 C321 119 368 80 445 46" fill="none" stroke="url(#kff-payoff)" strokeWidth="3.4" strokeLinecap="round" className="kff-path" />
          <path d="M61 258 C137 235 183 192 251 156 C321 119 368 80 445 46" fill="none" stroke="#c7e6a4" strokeWidth="9" strokeLinecap="round" opacity=".13" filter="url(#kff-glow)" />
          <circle cx="251" cy="156" r="5" fill="#10201d" stroke="#e8d49f" strokeWidth="1.5" />
          <g transform={`translate(${markerX} ${markerY})`}>
            <path className="kff-cursor" d="M0-130V130" stroke="#d4d3b5" strokeOpacity=".49" />
            <circle className="kff-marker-halo" r="17" fill="#c7e8a8" opacity=".24" />
            <circle r="6.2" fill="#d4eca9" stroke="#0d1c19" strokeWidth="2" />
            <path d="M-5-16h10" stroke="#eff6d9" strokeWidth="1.5" />
            <rect x="-27" y="-39" width="54" height="18" rx="4" fill="#d1e9a8" />
            <text x="0" y="-27" textAnchor="middle" className="kff-marker-readout">{price}</text>
          </g>
          <text x="50" y="290" className="kff-axis-label">НИЖЕ ЦЕНЫ</text>
          <text x="452" y="290" textAnchor="end" className="kff-axis-label">ВЫШЕ ЦЕНЫ</text>
        </svg>
        <div className="kff-graph-legend">
          <span><i className="kff-legend-dot loss" /> УБЫТОК</span>
          <span><i className="kff-legend-dot" /> ПРИБЫЛЬ</span>
        </div>
      </section>

      <div className="kff-note"><i />{chapter.note}</div>
      <div className="kff-metric-row" aria-label="Ключевые параметры">
        <div className="kff-metric"><span className="kff-metric-label">ЦЕНА СЕЙЧАС</span><strong className="kff-metric-value">{price}</strong></div>
        <div className="kff-metric"><span className="kff-metric-label">ИЗМЕНЕНИЕ</span><strong className={`kff-metric-value ${positive ? "accent" : ""}`}>{positive ? "+" : ""}{change}%</strong></div>
        <div className="kff-metric"><span className="kff-metric-label">СЦЕНАРИЙ</span><strong className="kff-metric-value">{positive ? "ВЫШЕ" : "НИЖЕ"} ВХОДА</strong></div>
      </div>

      <Guide chapterIndex={chapterIndex} />

      <div className="kff-caption">
        <p key={`caption-${chapterIndex}`}>{chapter.caption}</p>
        <button type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Поставить ролик на паузу" : "Продолжить ролик"}>
          {playing ? (
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 2h2v8H3zm4 0h2v8H7z" fill="currentColor" /></svg>
          ) : (
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.8 10 6l-7 4.2z" fill="currentColor" /></svg>
          )}
        </button>
      </div>
      <div className="kff-progress" aria-hidden="true">
        {chapters.map((item, index) => {
          const width = index < chapterIndex ? 1 : index > chapterIndex ? 0 : chapterTime / 6000;
          return <span key={item.index} className={index === chapterIndex ? "is-active" : ""} style={index === chapterIndex ? { transform: `scaleX(${width})` } : index < chapterIndex ? { transform: "scaleX(1)", background: "var(--mint)" } : undefined} />;
        })}
      </div>
    </main>
  );
}