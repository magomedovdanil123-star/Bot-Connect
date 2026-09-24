import { useEffect, useState } from "react";

const chapters = [
  {
    index: "01",
    eyebrow: "КОНТРАКТ · СЕГОДНЯ",
    title: "Цена задана.",
    caption: "Фьючерс фиксирует цену сегодня — расчёт будет позже.",
    note: "ДАТА И ЦЕНА ЗАКРЕПЛЕНЫ",
    words: ["Фьючерс", "фиксирует цену", "расчёт позже"],
  },
  {
    index: "02",
    eyebrow: "ЗАЛОГ · ПОЗИЦИЯ",
    title: "Движение усилено.",
    caption: "Залог открывает позицию крупнее; движение усиливается.",
    note: "ОДИН ЗАЛОГ · БОЛЬШАЯ ПОЗИЦИЯ",
    words: ["Залог", "открывает позицию", "движение усилено"],
  },
  {
    index: "03",
    eyebrow: "СЦЕНАРИЙ · РЕЗУЛЬТАТ",
    title: "Риск симметричен.",
    caption: "Выше точки входа — прибыль. Ниже — убыток.",
    note: "ПОТЕНЦИАЛ И РИСК РАСТУТ ВМЕСТЕ",
    words: ["Выше точки входа", "это прибыль", "ниже — убыток"],
  },
] as const;

function HumanPresenter({ chapterIndex }: { chapterIndex: number }) {
  return (
    <svg className={`kff-human kff-human-${chapterIndex}`} viewBox="0 0 300 360" aria-hidden="true">
      <defs>
        <linearGradient id="kff-human-skin" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#f4cba6" />
          <stop offset=".58" stopColor="#dfa77f" />
          <stop offset="1" stopColor="#b87960" />
        </linearGradient>
        <linearGradient id="kff-human-coat" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#e1ddcf" />
          <stop offset=".5" stopColor="#c5c1b5" />
          <stop offset="1" stopColor="#969b91" />
        </linearGradient>
        <linearGradient id="kff-human-hair" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#52463d" />
          <stop offset=".5" stopColor="#302d29" />
          <stop offset="1" stopColor="#1c2422" />
        </linearGradient>
        <linearGradient id="kff-human-shirt" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#34403f" />
          <stop offset="1" stopColor="#202a2a" />
        </linearGradient>
      </defs>
      <ellipse cx="150" cy="343" rx="125" ry="12" fill="#687b6a" opacity=".12" />
      <path d="M84 181c-28 7-49 20-60 44L8 300c-4 15 4 29 18 33l19 4 29-81 4 104h145l4-104 28 81 20-5c14-4 21-18 16-33l-18-75c-7-24-29-39-60-45l-35-10H119Z" fill="url(#kff-human-coat)" stroke="#858a81" strokeWidth="2" />
      <path d="m111 177 39 31 39-31 25 183H86Z" fill="url(#kff-human-shirt)" />
      <path d="m134 195 16 13 16-13 9 29-25 28-25-28Z" fill="#d8d3c3" stroke="#9d9d91" strokeWidth="1.5" />
      <path d="m134 209 16 13 16-13-6 30-10 12-10-12Z" fill="#b79565" />
      <path d="m111 177 39 31-27 22-26-39Zm78 0-39 31 27 22 26-39Z" fill="#d1cdbf" stroke="#a2a397" strokeWidth="1.5" />
      <path d="M77 251h39v25H77zm107 0h39v25h-39Z" fill="#d5d1c4" stroke="#aaa99d" strokeWidth="1.5" />
      <path d="M82 263h30m78 0h30" stroke="#aaa99d" strokeWidth="1.4" />
      <circle cx="107" cy="264" r="3" fill="#69736d" /><circle cx="193" cy="264" r="3" fill="#69736d" />
      <path d="M72 301h5m-5 15h5m151-15h5m-5 15h5" stroke="#a4a59b" strokeWidth="2" strokeLinecap="round" />
      {chapterIndex === 0 && (
        <g className="kff-hand-gesture kff-hand-explain">
          <path d="M98 190c-22 4-39 17-52 35l-25 38 24 15 43-34 30-36Z" fill="url(#kff-human-coat)" stroke="#999b91" strokeWidth="2" />
          <path d="M48 259c-11 0-18-7-21-17l-5-16c-1-6 6-8 9-3l7 10-5-23c-1-6 7-8 9-2l7 22-2-24c0-6 8-6 9 0l5 24 2-19c1-6 8-5 8 1l-1 24 11 10-18 22-15-2Z" fill="url(#kff-human-skin)" stroke="#996c55" strokeWidth="2" />
          <path d="M202 190c22 4 39 17 52 35l25 38-24 15-43-34-30-36Z" fill="url(#kff-human-coat)" stroke="#999b91" strokeWidth="2" />
          <path d="M252 259c11 0 18-7 21-17l5-16c1-6-6-8-9-3l-7 10 5-23c1-6-7-8-9-2l-7 22 2-24c0-6-8-6-9 0l-5 24-2-19c-1-6-8-5-8 1l1 24-11 10 18 22 15-2Z" fill="url(#kff-human-skin)" stroke="#996c55" strokeWidth="2" />
        </g>
      )}
      {chapterIndex === 1 && (
        <g className="kff-hand-gesture kff-hand-point">
          <path d="M98 190c-22 4-39 17-52 35l-25 38 24 15 43-34 30-36Z" fill="url(#kff-human-coat)" stroke="#999b91" strokeWidth="2" />
          <path d="M48 259c11-8 25-11 37-6l13 9-18 16-20 5-15-8Z" fill="url(#kff-human-skin)" stroke="#996c55" strokeWidth="2" />
          <path d="M202 190c22 4 39 17 52 35l23 34-24 17-43-34-30-36Z" fill="url(#kff-human-coat)" stroke="#999b91" strokeWidth="2" />
          <path d="M250 257c11-14 19-31 24-52l9-38c2-8 12-7 13 1l1 37 17-16c7-6 15 2 10 9l-20 28c-12 17-24 29-41 37l-13-6Z" fill="url(#kff-human-skin)" stroke="#996c55" strokeWidth="2" />
        </g>
      )}
      {chapterIndex === 2 && (
        <g className="kff-hand-gesture kff-hand-warning">
          <path d="M98 190c-22 4-39 17-52 35l-25 38 24 15 43-34 30-36Z" fill="url(#kff-human-coat)" stroke="#999b91" strokeWidth="2" />
          <path d="M47 261c-11 0-17-8-16-19l2-22c1-7 10-8 11-1l2 14 3-25c1-7 10-7 11 1l1 23 7-18c3-7 11-4 9 3l-3 22 9-14c4-6 12-2 9 5l-9 25-22 17Z" fill="url(#kff-human-skin)" stroke="#996c55" strokeWidth="2" />
          <path d="M202 190c22 4 39 17 52 35l25 38-24 15-43-34-30-36Z" fill="url(#kff-human-coat)" stroke="#999b91" strokeWidth="2" />
          <path d="M252 259c11-4 20-13 28-26l14-24c4-7 13-3 10 4l-9 18 19-18c6-6 13 1 8 7l-17 22 18-12c7-5 12 3 6 8l-26 24c-13 11-26 15-42 14l-18-10Z" fill="url(#kff-human-skin)" stroke="#996c55" strokeWidth="2" />
        </g>
      )}
      <g className={`kff-human-head kff-human-head-${chapterIndex}`}>
        <path d="M104 90c-10-7-15 2-12 13 2 9 8 14 15 14Zm92 0c10-7 15 2 12 13-2 9-8 14-15 14Z" fill="url(#kff-human-skin)" stroke="#a57459" strokeWidth="2" />
        <path d="M108 76c0-34 18-53 44-53 30 0 49 22 47 56l-6 40c-4 25-20 42-42 42-21 0-38-17-41-42Z" fill="url(#kff-human-skin)" stroke="#a57459" strokeWidth="2.5" />
        <path d="M98 91c-7-30 1-57 19-72 17-14 40-16 61-8 23 9 35 31 33 57-1 9-3 15-7 22-8-7-14-17-18-30-23 8-49 6-69-4-4 13-10 25-19 35Z" fill="url(#kff-human-hair)" />
        <path d="M118 33c17-17 39-21 59-12m-51 5c18-12 38-14 56-7m-44-13c16-7 31-5 44 2" fill="none" stroke="#c4a17d" strokeOpacity=".38" strokeWidth="3" strokeLinecap="round" />
        <path d={chapterIndex === 2 ? "M116 91q14-10 28-2m19 0q14-8 28 2" : "M116 86q14-9 28-3m19 0q14-6 28 3"} fill="none" stroke="#47382f" strokeWidth="4" strokeLinecap="round" />
        <g className="kff-human-blink">
          <ellipse cx="132" cy="105" rx="10" ry="8" fill="#fff7e9" />
          <ellipse cx="182" cy="105" rx="10" ry="8" fill="#fff7e9" />
          <circle cx="136" cy="105" r="5" fill="#526c59" />
          <circle cx="178" cy="105" r="5" fill="#526c59" />
          <circle cx="138" cy="102" r="1.8" fill="#fff" />
          <circle cx="180" cy="102" r="1.8" fill="#fff" />
        </g>
        <path d="M157 108c-2 10-5 16-7 22 4 4 10 4 15 2" fill="none" stroke="#a66f56" strokeWidth="2.5" strokeLinecap="round" />
        {chapterIndex === 2
          ? <path d="M139 143q18-6 36 0" fill="none" stroke="#814b42" strokeWidth="4" strokeLinecap="round" />
          : <ellipse cx="157" cy="140" rx="9" ry="6" fill="#793f38" className="kff-human-speaking" />}
      </g>
    </svg>
  );
}

function SpeechBeat({ chapterIndex, wordIndex }: { chapterIndex: number; wordIndex: number }) {
  const chapter = chapters[chapterIndex];
  return (
    <div className={`kff-speech kff-speech-${chapterIndex}`} aria-label={`Фраза главы: ${chapter.caption}`} aria-live="polite">
      <span className="kff-speech-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          {chapterIndex === 0 ? (
            <><rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.7" /><path d="M8 3.5v4M16 3.5v4M4.5 10h15M8 14h3m-3 3h7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>
          ) : chapterIndex === 1 ? (
            <><circle cx="12" cy="12" r="8.3" stroke="currentColor" strokeWidth="1.7" /><path d="M9 15.5 15.5 9M10 9h5.5v5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><path d="M7.5 18.5 5 21" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></>
          ) : (
            <><path d="M4 19V5m0 14h16" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="m6 16 4-3 3 1 5-7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /><path d="M15 7h3v3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></>
          )}
        </svg>
      </span>
      <span className="kff-speech-divider" aria-hidden="true" />
      <span className="kff-speech-words">
        {chapter.words.map((word, index) => (
          <span
            key={`${chapterIndex}-${word}`}
            className={`kff-speech-word ${index === wordIndex ? "is-active" : ""} ${index < wordIndex ? "is-past" : ""}`}
            aria-current={index === wordIndex ? "step" : undefined}
          >
            {word}
          </span>
        ))}
      </span>
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
  const wordIndex = Math.min(2, Math.floor(chapterTime / 2000));
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
        @keyframes kff-gesture-explain { 0%,100% { transform: translateY(-18px) rotate(-1deg); } 50% { transform: translateY(-22px) rotate(1.8deg); } }
        @keyframes kff-gesture-point { 0%,100% { transform: translate(0,0) rotate(0deg); } 50% { transform: translate(2px,-2px) rotate(1.3deg); } }
        @keyframes kff-gesture-warning { 0%,100% { transform: translateY(-18px) rotate(0deg); } 50% { transform: translateY(-21px) rotate(-1.2deg); } }
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
        .kff-shell {
          --bg: #f3f0e7;
          --panel: #fffdf7;
          --panel-hi: #eeece2;
          --line: rgba(62, 79, 68, .17);
          --paper: #27332d;
          --subtle: #68766d;
          --mint: #6f8a5f;
          --amber: #b17a45;
          --red: #c86550;
          color: var(--paper);
          background:
            radial-gradient(ellipse at 51% 42%, rgba(216, 225, 203, .56), transparent 49%),
            linear-gradient(160deg, #fbfaf5 0%, #f1efe7 54%, #e9e8de 100%);
          box-shadow: 0 0 0 100vmax #e9e7df;
          font-family: "Manrope", "Avenir Next", ui-sans-serif, system-ui, sans-serif;
        }
        .kff-shell::before {
          opacity: .12;
          background-image:
            linear-gradient(rgba(112, 132, 112, .11) 1px, transparent 1px),
            linear-gradient(90deg, rgba(112, 132, 112, .11) 1px, transparent 1px);
          background-size: 5.4cqw 5.4cqw;
          mix-blend-mode: multiply;
        }
        .kff-shell::after {
          background:
            linear-gradient(180deg, rgba(255,255,255,.38), transparent 19%, transparent 81%, rgba(214,216,203,.3));
        }
        .kff-topline { color: #657268; top: 4.1%; }
        .kff-brand-mark { color: #738c63; }
        .kff-broadcast { color: #66746b; }
        .kff-broadcast i, .kff-guide-live i {
          background: #819968;
          box-shadow: 0 0 0 3px rgba(129,153,104,.12);
        }
        .kff-kicker { top: 9.5%; color: #a66f3e; }
        .kff-kicker b { color: #879087; }
        .kff-title {
          top: 12.6%;
          color: #28342e;
          font-size: 8.2cqw;
          letter-spacing: -.07em;
          line-height: 1.02;
        }
        .kff-title em { color: #70895f; }
        .kff-deck {
          top: 21.1%;
          width: 85%;
          color: #69766d;
          font-size: 2.8cqw;
          line-height: 1.4;
        }
        .kff-speech {
          position: absolute;
          z-index: 5;
          top: 25.4%;
          left: 7%;
          right: 7%;
          min-height: 7.8cqw;
          display: flex;
          align-items: center;
          gap: 1.8cqw;
          padding: 1.2cqw 2cqw;
          border: 1px solid rgba(85, 108, 85, .17);
          border-radius: 99px;
          background: rgba(255, 253, 247, .94);
          box-shadow: 0 6px 18px rgba(58, 72, 59, .08);
        }
        .kff-speech-icon {
          width: 5.2cqw;
          height: 5.2cqw;
          display: grid;
          place-items: center;
          flex: none;
          border-radius: 50%;
          color: #66805a;
          background: #edf0e5;
        }
        .kff-speech-icon svg { width: 3.5cqw; height: 3.5cqw; }
        .kff-speech-divider { width: 1px; height: 4.5cqw; flex: none; background: rgba(79, 99, 79, .19); }
        .kff-speech-words { min-width: 0; width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 1cqw; }
        .kff-speech-word {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 5.2cqw;
          padding: .6cqw 1.45cqw;
          border-radius: 99px;
          color: #778276;
          font-size: 2.45cqw;
          font-weight: 680;
          line-height: 1;
          letter-spacing: -.04em;
          white-space: nowrap;
          opacity: .56;
          transition: opacity .25s ease, transform .25s ease;
        }
        .kff-speech-word.is-past { opacity: .77; }
        .kff-speech-word.is-active {
          color: #fffdf7;
          background: #70895f;
          opacity: 1;
          animation: kff-word-in .32s cubic-bezier(.2,.75,.2,1) both;
        }
        .kff-speech-2 .kff-speech-word.is-active { background: #bd7650; }
        @keyframes kff-word-in { from { opacity: .72; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
        .kff-presenter {
          position: absolute;
          z-index: 2;
          top: 29.8%;
          left: 0;
          right: 0;
          height: 40%;
          display: flex;
          justify-content: center;
          align-items: flex-start;
          pointer-events: none;
          overflow: visible;
        }
        .kff-human {
          flex: none;
          width: 55cqw;
          height: 66cqw;
          overflow: visible;
          filter: drop-shadow(0 8px 8px rgba(62, 71, 57, .12));
          animation: kff-host-breathe 3.2s ease-in-out infinite;
        }
        .kff-human-head { transform-box: fill-box; transform-origin: 50% 78%; }
        .kff-human-head-0 { animation: kff-head-explain 3s ease-in-out infinite; }
        .kff-human-head-1 { animation: kff-head-emphasis 2.2s ease-in-out infinite; }
        .kff-human-head-2 { animation: kff-head-caution 2.8s ease-in-out infinite; }
        .kff-human-blink { transform-box: fill-box; transform-origin: center; animation: kff-human-blink 5.2s 1.1s infinite; }
        .kff-human-speaking { transform-box: fill-box; transform-origin: center; animation: kff-human-talk .62s ease-in-out infinite alternate; }
        .kff-hand-gesture { transform-box: fill-box; transform-origin: 50% 35%; }
        .kff-human-0 .kff-hand-gesture { animation: kff-gesture-explain 2s ease-in-out infinite; }
        .kff-human-1 .kff-hand-gesture { animation: kff-gesture-point 2.4s ease-in-out infinite; }
        .kff-human-2 .kff-hand-gesture { animation: kff-gesture-warning 2.2s ease-in-out infinite; }
        .kff-quote {
          top: 65%;
          left: 5.5%;
          width: 89%;
          height: 28%;
          border: 1px solid rgba(74, 94, 75, .19);
          border-radius: 3cqw;
          background: rgba(255, 254, 249, .97);
          box-shadow: 0 15px 34px rgba(57, 70, 57, .13), inset 0 1px rgba(255,255,255,.95);
        }
        .kff-quote-head { border-bottom-color: rgba(75, 92, 75, .13); }
        .kff-quote-symbol { color: #344139; }
        .kff-quote-contract { color: #818c80; }
        .kff-live-price { color: #344139; }
        .kff-live-change { color: #70895f; }
        .kff-chart-label { fill: #67786b; font: 700 13px ui-monospace, monospace; }
        .kff-axis-label { fill: #7c897e; font: 650 12px ui-monospace, monospace; }
        .kff-grid { stroke: rgba(79, 99, 79, .13); }
        .kff-grid-v { stroke: rgba(79, 99, 79, .09); }
        .kff-entry-label { fill: #a57645; font: 700 12px ui-monospace, monospace; }
        .kff-marker-readout { fill: #344139; font: 700 12px ui-monospace, monospace; }
        .kff-graph-legend { color: #718075; }
        .kff-legend-dot { background: #7f9b67; }
        .kff-legend-dot.loss { background: #c86550; }
        .kff-chart { top: 23%; left: 2.2%; width: 95.6%; height: 75%; }
        .kff-note, .kff-metric-row { display: none; }
        .kff-caption { bottom: 1.4%; }
        .kff-caption p { color: #39443d; font-size: 2.55cqw; }
        .kff-caption button {
          border-color: rgba(66, 86, 70, .2);
          color: #53684f;
          background: rgba(255, 253, 247, .93);
          box-shadow: 0 3px 12px rgba(58, 72, 59, .08);
        }
        .kff-caption button:hover { background: #edf0e5; border-color: rgba(66, 86, 70, .42); }
        .kff-progress { background: rgba(90, 108, 86, .14); }
        .kff-progress span.is-active { background: #789260; }
        @keyframes kff-cue-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 360px) {
          .kff-human { width: 55cqw; height: 66cqw; }
          .kff-speech { left: 5%; right: 5%; }
          .kff-speech-word { font-size: 2.25cqw; padding-inline: 1cqw; }
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

      <SpeechBeat chapterIndex={chapterIndex} wordIndex={wordIndex} />
      <div className="kff-presenter" aria-hidden="true">
        <HumanPresenter chapterIndex={chapterIndex} />
      </div>

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
          <path d="M48 156H454" stroke="rgba(169,133,77,.45)" strokeWidth="1.3" />
          <path d="M251 30V278" stroke="rgba(169,133,77,.42)" strokeDasharray="3 6" />
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