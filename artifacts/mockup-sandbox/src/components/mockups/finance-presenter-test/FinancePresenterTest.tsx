import { useEffect, useState } from "react";

const beats = [
  {
    kicker: "ФЬЮЧЕРСЫ / 01",
    headline: "ЦЕНА СЕЙЧАС",
    caption: "Цена фиксируется сегодня, а сделка будет позже.",
  },
  {
    kicker: "ПЛЕЧО / 02",
    headline: "ЗАЛОГ → ПОЗИЦИЯ",
    caption: "Небольшой залог управляет большой позицией.",
  },
  {
    kicker: "РЕЗУЛЬТАТ / 03",
    headline: "ПРИБЫЛЬ ИЛИ УБЫТОК",
    caption: "Движение работает в обе стороны — риск тоже выше.",
  },
] as const;

function Presenter({ beat, warning }: { beat: number; warning: boolean }) {
  const shift = beat === 1 ? 52 : 0;

  return (
    <g transform={`translate(${shift} 0)`}>
    <g className={`fpt-presenter fpt-presenter-${beat}`}>
      <ellipse cx="270" cy="941" rx="151" ry="20" fill="#07131c" opacity=".62" />

      {/* Jacket silhouette and shirt */}
      <path
        d="M218 668 193 694c-24 5-42 15-51 37l-27 77c-6 17 0 32 13 37l20-5 31-66 13-4-4 190h164l-4-190 14 4 30 66 20 5c13-5 19-20 13-37l-27-77c-9-22-27-32-51-37l-25-26Z"
        fill="url(#fpt-jacket)"
        stroke="#d2c7ac"
        strokeOpacity=".52"
        strokeWidth="2"
      />
      <path d="m223 676 47 44 47-44 20 284H203Z" fill="#14232c" />
      <path d="m224 676 46 44-28 49-31-72Zm92 0-46 44 28 49 31-72Z" fill="url(#fpt-lapel)" stroke="#bda77e" strokeOpacity=".45" />
      <path d="m267 721-12 25 15 15 16-15-12-25" fill="#d8c6a4" />
      <path d="M270 761v145" stroke="#c0a679" strokeOpacity=".23" strokeWidth="2" />
      <circle cx="270" cy="792" r="3" fill="#c9ae7d" opacity=".65" />
      <circle cx="270" cy="826" r="3" fill="#c9ae7d" opacity=".65" />
      <path d="m194 731-16 72m168-72 16 72" stroke="#e1d1b3" strokeOpacity=".3" strokeWidth="2" />
      <path d="M157 793h29v37h-29z" fill="#192b35" stroke="#c7b48d" strokeOpacity=".54" />
      <path d="M354 793h29v37h-29z" fill="#192b35" stroke="#c7b48d" strokeOpacity=".54" />
      <circle cx="174" cy="811" r="3" fill="#c8b187" opacity=".66" />
      <circle cx="368" cy="811" r="3" fill="#c8b187" opacity=".66" />

      {/* Gesture arms: the same presenter, three unmistakable beats */}
      {beat === 0 && (
        <>
          <path d="M195 710c-17 8-27 22-34 43l-14 37 19 13 25-30 22-39Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M159 788c-12 5-21 0-22-10l-2-23c-1-7 3-10 8-8l2-15c1-6 7-7 10-2l3-14c2-6 8-5 10 0l3-10c2-6 8-4 9 2l1 31c9-8 17-9 20-4 3 5-4 13-13 21l-12 26Z" fill="url(#fpt-skin)" stroke="#704e40" strokeWidth="2" />
          <path d="M345 716c18 6 30 21 38 42l16 40-20 12-25-30-24-43Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M383 785c11 4 19 0 21-8" fill="none" stroke="#d4c2a1" strokeOpacity=".7" strokeWidth="2" />
        </>
      )}
      {beat === 1 && (
        <>
          <path d="M195 711c-18 7-27 20-34 40l-15 43 20 13 29-36 20-38Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M160 793c-12 5-19-1-18-12l3-23c1-7 5-9 10-5l5-14c2-6 8-6 10 0l6-12c3-5 9-3 9 3l5-9c3-5 9-2 8 4l-8 30c11-7 20-8 22-2 2 5-8 12-18 19l-17 21Z" fill="url(#fpt-skin)" stroke="#704e40" strokeWidth="2" />
          <path d="M344 709c22 4 33 17 42 37l14 28-17 17-29-22-28-31Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M378 758c13-6 27-21 38-35 6-8 13-10 17-6 4 4 0 12-5 20l13-9c6-4 11-1 9 5l-17 19c8-4 14-3 15 2s-6 10-16 16l-23 14-28-10Z" fill="url(#fpt-skin)" stroke="#704e40" strokeWidth="2" />
          <path d="M425 732c-3-10-3-20 0-29 2-7 8-7 10 0l1 22" fill="none" stroke="#704e40" strokeWidth="2" strokeLinecap="round" />
        </>
      )}
      {beat === 2 && !warning && (
        <>
          <path d="M195 710c-18 7-29 21-35 42l-15 40 20 14 29-34 21-41Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M345 710c17 7 28 21 35 42l14 39-20 14-27-34-22-41Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M352 783c-4-19-18-37-29-53-5-7-4-13 1-15 5-2 10 3 15 9l-5-20c-1-7 4-10 9-6l9 21c-1-10 3-15 8-13 5 1 7 9 7 19l10 20-4 38Z" fill="url(#fpt-skin)" stroke="#704e40" strokeWidth="2" />
        </>
      )}
      {beat === 2 && warning && (
        <>
          <path d="M195 710c-18 7-29 21-35 42l-15 40 20 14 29-34 21-41Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M345 710c17 7 28 21 35 42l14 39-20 14-27-34-22-41Z" fill="url(#fpt-jacket)" stroke="#d2c7ac" strokeOpacity=".52" strokeWidth="2" />
          <path d="M366 786c-10-14-17-32-23-49-3-8-1-13 4-14 5 0 8 5 11 12l2-21c1-7 7-8 10-2l3 23c2-10 7-13 11-10 4 4 3 11 1 21l2 22 22 16-13 27Z" fill="url(#fpt-skin)" stroke="#704e40" strokeWidth="2" />
          <path d="m365 741 3 25m13-18-2 20m12-10-4 17" stroke="#805b48" strokeWidth="1.5" opacity=".72" />
        </>
      )}

      {/* Neck and face */}
      <path d="M246 642v43c8 17 39 19 48 0v-43Z" fill="url(#fpt-skin)" />
      <path d="M210 570c3-45 25-69 63-69 40 0 64 25 61 74l-7 55c-5 35-27 57-54 57-29 0-52-24-57-58Z" fill="url(#fpt-skin)" stroke="#6d4d40" strokeWidth="2.5" />
      <path d="M211 589c-11-7-17 2-11 21 4 11 11 17 19 15Zm121 0c11-7 17 2 11 21-4 11-11 17-19 15Z" fill="url(#fpt-skin)" stroke="#6d4d40" strokeWidth="2" />
      <path d="M207 583c-2-35 5-62 25-79 16-13 34-17 54-13 23 5 38 20 45 42 5 14 5 30 1 49l-9-24-8-18c-16 4-37 4-57-2-10 10-26 15-42 15l-3 30Z" fill="url(#fpt-hair)" stroke="#101b21" strokeWidth="3" />
      <path d="M226 511c12-20 37-29 61-22m-52 7c16-16 40-18 58-9m-48-1c17-9 33-9 47-2" fill="none" stroke="#83908b" strokeOpacity=".22" strokeWidth="4" strokeLinecap="round" />
      <path d="M216 615c8 41 26 67 53 68 27 1 45-22 54-62-10 17-24 23-40 19-12-2-21-2-31 1-14 4-26-4-36-26Z" fill="url(#fpt-beard)" opacity=".96" />
      <path d="M233 581c9-7 19-7 28-2m22 0c9-6 19-6 28 1" fill="none" stroke="#302824" strokeWidth="5" strokeLinecap="round" />
      {beat !== 2 ? (
        <>
          <path d="M233 593c8-7 19-7 27-1m22 0c8-7 19-7 27 0" fill="none" stroke="#362d2a" strokeWidth="2.5" strokeLinecap="round" />
          <ellipse cx="247" cy="602" rx="8" ry="6" fill="#f5e9d1" />
          <ellipse cx="295" cy="602" rx="8" ry="6" fill="#f5e9d1" />
          <circle cx="250" cy="602" r="3.6" fill="#243a3c" />
          <circle cx="292" cy="602" r="3.6" fill="#243a3c" />
          <circle cx="251" cy="601" r="1.2" fill="#fff7e7" />
          <circle cx="293" cy="601" r="1.2" fill="#fff7e7" />
        </>
      ) : warning ? (
        <>
          <path d="M233 593c8-6 19-6 27-1m22 0c9-7 20-7 29 0" fill="none" stroke="#362d2a" strokeWidth="3" strokeLinecap="round" />
          <path d="M237 601c7-5 15-4 21 1m27-1c7-5 15-5 22 1" fill="none" stroke="#f1dfc1" strokeWidth="3" strokeLinecap="round" />
          <circle cx="249" cy="603" r="3.2" fill="#243a3c" />
          <circle cx="296" cy="603" r="3.2" fill="#243a3c" />
          <circle cx="250" cy="602" r="1.1" fill="#fff7e7" />
          <circle cx="297" cy="602" r="1.1" fill="#fff7e7" />
        </>
      ) : (
        <>
          <path d="M232 595c9-8 19-8 28-2m21 1c8-5 17-4 26 3" fill="none" stroke="#362d2a" strokeWidth="3" strokeLinecap="round" />
          <path d="M237 603c6-5 14-5 20 0m27 0c6-5 14-5 20 0" fill="none" stroke="#e7d6b7" strokeWidth="3" strokeLinecap="round" />
          <circle cx="248" cy="604" r="3.3" fill="#243a3c" />
          <circle cx="294" cy="604" r="3.3" fill="#243a3c" />
        </>
      )}
      <path d="M269 599c-2 11-6 20-8 25 4 3 9 4 14 2" fill="none" stroke="#996b50" strokeWidth="2" strokeLinecap="round" />
      {beat === 2 && !warning ? (
        <path d="M254 645c8-4 17-4 25 0" fill="none" stroke="#513830" strokeWidth="3" strokeLinecap="round" />
      ) : warning ? (
        <path d="M251 647c10-5 21-5 32 0" fill="none" stroke="#513830" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d="M250 640c12 11 28 11 41-1" fill="none" stroke="#513830" strokeWidth="4" strokeLinecap="round" />
      )}
      <path d="M228 627c5 4 10 5 15 4m55 0c5 1 10 0 15-4" fill="none" stroke="#e1a68a" strokeOpacity=".52" strokeWidth="4" strokeLinecap="round" />
      <path d="M225 687v18m90-18v18" stroke="#e7d4ae" strokeOpacity=".56" strokeWidth="2" />
    </g>
    </g>
  );
}

function ContractDiagram() {
  return (
    <g className="fpt-diagram fpt-contract">
      <ellipse cx="270" cy="361" rx="221" ry="120" fill="none" stroke="#b89d6b" strokeOpacity=".2" strokeWidth="1.2" strokeDasharray="2 11" className="fpt-orbit" />
      <path d="M95 359h56m234 0h60" fill="none" stroke="#d7bd84" strokeWidth="1.6" strokeDasharray="120" strokeDashoffset="120" className="fpt-contract-line" />
      <circle cx="83" cy="359" r="19" fill="url(#fpt-glass)" stroke="#c9aa70" strokeOpacity=".75" />
      <circle cx="83" cy="359" r="5" fill="#d6bd88" />
      <circle cx="457" cy="359" r="19" fill="url(#fpt-glass)" stroke="#c9aa70" strokeOpacity=".75" />
      <path d="M449 359h16m-8-8v16" stroke="#d6bd88" strokeWidth="1.4" />
      <text x="83" y="393" textAnchor="middle" className="fpt-token-label">ПОКУПАТЕЛЬ</text>
      <text x="457" y="393" textAnchor="middle" className="fpt-token-label">ПРОДАВЕЦ</text>
      <g className="fpt-contract-card">
        <rect x="130" y="268" width="280" height="176" rx="20" fill="url(#fpt-card)" stroke="#d4bd8d" strokeOpacity=".74" strokeWidth="1.5" />
        <rect x="136" y="274" width="268" height="164" rx="16" fill="none" stroke="#f3e4bf" strokeOpacity=".13" />
        <path d="M153 302h24v29h-24z" fill="#d6b977" fillOpacity=".14" stroke="#d2b775" strokeOpacity=".68" />
        <path d="M159 310h12m-12 6h12m-12 6h8" stroke="#e1ca94" strokeWidth="1.4" strokeLinecap="round" />
        <text x="187" y="312" className="fpt-diagram-eyebrow">УСЛОВИЯ СДЕЛКИ</text>
        <text x="153" y="363" className="fpt-contract-main">ЦЕНА ЗАФИКСИРОВАНА</text>
        <path d="M153 382h234" stroke="#d8c7a1" strokeOpacity=".23" />
        <circle cx="160" cy="410" r="3" fill="#d8bd83" />
        <text x="172" y="414" className="fpt-contract-small">СЕГОДНЯ</text>
        <path d="M238 409h35" stroke="#d8bd83" strokeOpacity=".42" />
        <circle cx="285" cy="410" r="3" fill="#d8bd83" opacity=".56" />
        <text x="297" y="414" className="fpt-contract-small fpt-muted">ПОЗЖЕ</text>
        <path d="M410 285h18" stroke="#e8d5ae" strokeWidth="1" opacity=".55" />
        <path d="M410 294h9" stroke="#e8d5ae" strokeWidth="1" opacity=".35" />
      </g>
      <circle cx="412" cy="290" r="2" fill="#fff1c9" className="fpt-flare" />
      <path d="M412 279v22m-11-11h22" stroke="#fff1c9" strokeWidth="1" opacity=".58" className="fpt-flare-cross" />
    </g>
  );
}

function LeverageDiagram() {
  return (
    <g className="fpt-diagram fpt-leverage">
      <rect x="88" y="274" width="364" height="196" rx="22" fill="url(#fpt-card)" stroke="#d4bd8d" strokeOpacity=".38" />
      <path d="M109 298h322" stroke="#dfcca4" strokeOpacity=".18" />
      <text x="116" y="326" className="fpt-bar-label">ЗАЛОГ</text>
      <text x="424" y="326" textAnchor="end" className="fpt-bar-value">1×</text>
      <rect x="116" y="341" width="308" height="15" rx="7.5" fill="#0b1820" stroke="#bda773" strokeOpacity=".32" />
      <rect x="118" y="343" width="31" height="11" rx="5.5" fill="url(#fpt-gold-bar)" className="fpt-collateral-fill" />
      <circle cx="149" cy="348.5" r="5" fill="#f2d69b" className="fpt-collateral-dot" />
      <text x="116" y="390" className="fpt-bar-label">ПОЗИЦИЯ</text>
      <text x="424" y="390" textAnchor="end" className="fpt-bar-value fpt-ten-label">10×</text>
      <rect x="116" y="405" width="308" height="17" rx="8.5" fill="#0b1820" stroke="#85a9a2" strokeOpacity=".28" />
      <rect x="118" y="407" width="304" height="13" rx="6.5" fill="url(#fpt-position-bar)" className="fpt-position-fill" />
      <circle cx="118" cy="413.5" r="7" fill="#f2d69b" className="fpt-marker" />
      <path d="M119 445h304" stroke="#d6c49e" strokeOpacity=".16" />
      <text x="116" y="459" className="fpt-scale-note">ОДИН ЗАЛОГ  ·  БОЛЬШИЙ ОБЪЁМ СДЕЛКИ</text>
      <path d="M421 401v-13m0-7v-6" stroke="#f0d394" strokeWidth="1.5" className="fpt-marker-streak" />
    </g>
  );
}

function PayoffDiagram() {
  return (
    <g className="fpt-diagram fpt-payoff">
      <rect x="76" y="266" width="388" height="224" rx="22" fill="url(#fpt-card)" stroke="#d4bd8d" strokeOpacity=".38" />
      <path d="M101 303h338M101 341h338M101 379h338M101 417h338M101 455h338" stroke="#d6d4c2" strokeOpacity=".075" />
      <path d="M140 291v173m65-173v173m65-173v173m65-173v173m65-173v173" stroke="#d6d4c2" strokeOpacity=".065" />
      <path d="M112 393h326" stroke="#d9c69b" strokeOpacity=".57" strokeWidth="1.3" />
      <path d="M270 308v152" stroke="#e5d4b0" strokeOpacity=".5" strokeDasharray="3 6" />
      <text x="114" y="323" className="fpt-chart-label">ИЗМЕНЕНИЕ ЦЕНЫ</text>
      <text x="433" y="329" textAnchor="end" className="fpt-chart-profit">ПРИБЫЛЬ</text>
      <text x="433" y="450" textAnchor="end" className="fpt-chart-loss">УБЫТОК</text>
      <text x="270" y="478" textAnchor="middle" className="fpt-chart-entry">ТОЧКА ВХОДА</text>
      <path d="M270 393c25-3 38-20 58-32 29-17 53-25 102-40" fill="none" stroke="url(#fpt-profit-line)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="195" strokeDashoffset="195" className="fpt-profit-curve" />
      <path d="M270 393c25 3 39 20 61 34 27 17 52 24 99 33" fill="none" stroke="url(#fpt-loss-line)" strokeWidth="3.2" strokeLinecap="round" strokeDasharray="195" strokeDashoffset="195" className="fpt-loss-curve" />
      <path d="M270 388v10m-5-5h10" stroke="#fff1ce" strokeWidth="1.4" />
      <circle cx="270" cy="393" r="7" fill="#12212b" stroke="#f1d596" strokeWidth="2" className="fpt-entry-point" />
      <g className="fpt-price-marker">
        <circle cx="270" cy="393" r="12" fill="#f5db9f" fillOpacity=".13" />
        <circle cx="270" cy="393" r="4.5" fill="#ffedc4" />
        <path d="M270 375v-9m0 45v9" stroke="#f2d291" strokeWidth="1.4" />
      </g>
    </g>
  );
}

export function FinancePresenterTest() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => {
      setElapsed((performance.now() - startedAt) % 18000);
    }, 48);
    return () => window.clearInterval(timer);
  }, []);

  const beatIndex = Math.floor(elapsed / 6000);
  const beatTime = elapsed % 6000;
  const beat = beats[beatIndex];
  const captionWords = beat.caption.split(" ");
  const activeWord = Math.min(
    captionWords.length - 1,
    Math.floor((Math.max(0, beatTime - 300) / 5100) * captionWords.length),
  );
  const warning = beatIndex === 2 && beatTime >= 4250;

  return (
    <div className="fpt-frame" aria-label="Анимированный визуальный тест о фьючерсах">
      <style>{`
        .fpt-frame {
          --ink: #0b1720;
          --ivory: #f0e7d6;
          --muted: #a6ada9;
          --gold: #d9bd82;
          --coral: #e58a75;
          position: relative;
          isolation: isolate;
          width: min(100vw, 56.25dvh);
          height: min(100dvh, 177.778vw);
          aspect-ratio: 9 / 16;
          margin: 0 auto;
          overflow: hidden;
          container-type: inline-size;
          color: var(--ivory);
          background:
            radial-gradient(ellipse at 51% 37%, rgba(75, 107, 107, .24), transparent 38%),
            radial-gradient(ellipse at 85% 68%, rgba(104, 69, 56, .16), transparent 32%),
            linear-gradient(155deg, #142632 0%, #0b1720 41%, #101e27 76%, #09141b 100%);
          font-family: "Manrope", "Avenir Next", system-ui, sans-serif;
          font-variant-numeric: lining-nums;
          -webkit-font-smoothing: antialiased;
          text-rendering: geometricPrecision;
        }
        .fpt-frame::before, .fpt-frame::after {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
        }
        .fpt-frame::before {
          z-index: 5;
          opacity: .13;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.87' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.22'/%3E%3C/svg%3E");
          mix-blend-mode: soft-light;
        }
        .fpt-frame::after {
          z-index: 4;
          background: linear-gradient(180deg, rgba(3, 10, 14, .1), transparent 18%, transparent 71%, rgba(3, 10, 14, .48));
        }
        .fpt-background, .fpt-visuals {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          overflow: visible;
        }
        .fpt-background { z-index: 0; }
        .fpt-visuals { z-index: 1; }
        .fpt-kicker {
          position: absolute;
          z-index: 3;
          top: 7.4%;
          left: 50%;
          transform: translateX(-50%);
          color: #dfc995;
          font-size: 2.35cqw;
          font-weight: 700;
          letter-spacing: .19em;
          white-space: nowrap;
          opacity: .94;
        }
        .fpt-kicker::before, .fpt-kicker::after {
          content: "";
          display: inline-block;
          width: 3.4cqw;
          height: 1px;
          margin: 0 2.6cqw .65em;
          background: linear-gradient(90deg, transparent, #d8bd82);
          opacity: .7;
        }
        .fpt-kicker::after { transform: scaleX(-1); }
        .fpt-headline {
          position: absolute;
          z-index: 3;
          top: 11.7%;
          left: 6%;
          width: 88%;
          margin: 0;
          color: #f2eadb;
          font-size: 7.2cqw;
          font-weight: 800;
          line-height: 1.06;
          letter-spacing: -.065em;
          text-align: center;
          text-wrap: balance;
          text-shadow: 0 2px 20px rgba(223, 193, 133, .12);
          animation: fpt-title-arrive .55s cubic-bezier(.18,.72,.22,1) both;
        }
        .fpt-headline::after {
          content: "";
          display: block;
          width: 8cqw;
          height: 1px;
          margin: 2.8cqw auto 0;
          background: linear-gradient(90deg, transparent, #d2b779, transparent);
          opacity: .72;
        }
        .fpt-caption {
          position: absolute;
          z-index: 6;
          top: 81.5%;
          left: 8%;
          width: 84%;
          min-height: 9.5%;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          align-content: flex-start;
          column-gap: .25em;
          row-gap: .02em;
          padding: 3.5cqw 4cqw 3.2cqw;
          border: 1px solid rgba(225, 207, 168, .24);
          border-radius: 2.8cqw;
          background:
            linear-gradient(135deg, rgba(26, 43, 51, .84), rgba(12, 24, 31, .8)),
            rgba(12, 23, 30, .76);
          box-shadow: 0 12px 32px rgba(2, 8, 12, .23), inset 0 1px rgba(255,255,255,.05);
          backdrop-filter: blur(14px);
          font-size: 3.55cqw;
          font-weight: 600;
          line-height: 1.55;
          letter-spacing: -.022em;
          text-align: center;
        }
        .fpt-caption-word {
          display: inline-block;
          color: rgba(229, 231, 223, .58);
          transition: color .25s ease, opacity .25s ease;
          white-space: pre;
        }
        .fpt-caption-word.is-past { color: #eee8da; }
        .fpt-caption-word.is-active {
          color: #f7d894;
          text-shadow: 0 0 18px rgba(238, 198, 121, .24);
        }
        .fpt-progress {
          position: absolute;
          z-index: 6;
          left: 9%;
          right: 9%;
          bottom: 2.3%;
          height: 1px;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 5px;
          opacity: .72;
        }
        .fpt-progress-segment {
          position: relative;
          overflow: hidden;
          border-radius: 4px;
          background: rgba(229, 217, 190, .25);
        }
        .fpt-progress-fill {
          position: absolute;
          inset: 0 auto 0 0;
          background: #d7bd85;
          box-shadow: 0 0 8px rgba(215, 189, 133, .35);
          transition: width .08s linear;
        }
        .fpt-defs { position: absolute; width: 0; height: 0; }
        .fpt-stage-glow { animation: fpt-breathe 6s ease-in-out infinite; }
        .fpt-floor-grid { opacity: .23; }
        .fpt-scene-edge { fill: none; stroke: #d2ba86; stroke-opacity: .16; }
        .fpt-token-label, .fpt-diagram-eyebrow, .fpt-contract-small, .fpt-bar-label,
        .fpt-bar-value, .fpt-scale-note, .fpt-chart-label, .fpt-chart-profit,
        .fpt-chart-loss, .fpt-chart-entry {
          font-family: "Manrope", "Avenir Next", system-ui, sans-serif;
          letter-spacing: 1.2px;
        }
        .fpt-token-label { fill: #d5c7a8; font-size: 7px; letter-spacing: .9px; }
        .fpt-diagram-eyebrow { fill: #c6b78f; font-size: 8px; letter-spacing: 1.35px; }
        .fpt-contract-main { fill: #f0e8d9; font-family: "Manrope", system-ui, sans-serif; font-size: 13px; font-weight: 700; letter-spacing: .65px; }
        .fpt-contract-small { fill: #e6d5b3; font-size: 8px; letter-spacing: .7px; }
        .fpt-muted { fill: #a6aaa4; }
        .fpt-bar-label { fill: #e2d5bb; font-size: 10px; font-weight: 700; letter-spacing: 1.6px; }
        .fpt-bar-value { fill: #e9d39d; font-size: 12px; font-weight: 700; letter-spacing: .6px; }
        .fpt-scale-note { fill: #a9b2ad; font-size: 7px; letter-spacing: 1.2px; }
        .fpt-chart-label, .fpt-chart-entry { fill: #aeb6b0; font-size: 7px; letter-spacing: 1px; }
        .fpt-chart-profit { fill: #e2cc97; font-size: 8px; letter-spacing: 1.1px; }
        .fpt-chart-loss { fill: #e69b87; font-size: 8px; letter-spacing: 1.1px; }
        .fpt-diagram { animation: fpt-diagram-in .6s cubic-bezier(.2,.7,.2,1) both; }
        .fpt-contract-card { transform-origin: 270px 356px; animation: fpt-card-build .7s cubic-bezier(.18,.8,.24,1) both; }
        .fpt-contract-line { animation: fpt-line-draw .75s .45s ease-out both; }
        .fpt-orbit { transform-origin: 270px 361px; animation: fpt-orbit-turn 18s linear infinite; }
        .fpt-flare { animation: fpt-flash 3s .2s ease-in-out infinite; }
        .fpt-flare-cross { animation: fpt-flash 3s .2s ease-in-out infinite; }
        .fpt-collateral-fill { transform-box: fill-box; transform-origin: left center; animation: fpt-collateral-fill .8s .35s cubic-bezier(.2,.8,.3,1) both; }
        .fpt-collateral-dot { animation: fpt-collateral-dot .8s .35s cubic-bezier(.2,.8,.3,1) both; }
        .fpt-position-fill { transform-box: fill-box; transform-origin: left center; animation: fpt-position-fill 2.3s 1s cubic-bezier(.16,.78,.22,1) both; }
        .fpt-marker { animation: fpt-marker-travel 3.2s 1.1s cubic-bezier(.25,.75,.25,1) both; }
        .fpt-ten-label { animation: fpt-ten-pulse 2.2s 3s ease-in-out infinite; transform-origin: 424px 386px; }
        .fpt-marker-streak { animation: fpt-streak 3.2s 1.1s ease-in-out both; }
        .fpt-profit-curve { animation: fpt-chart-draw 1.5s .65s ease-out both; }
        .fpt-loss-curve { animation: fpt-chart-draw 1.5s 2.05s ease-out both; }
        .fpt-price-marker { animation: fpt-price-cross 4.2s .9s cubic-bezier(.42,0,.28,1) both; }
        .fpt-entry-point { animation: fpt-entry-pulse 1.4s .65s ease-out both; }
        .fpt-presenter { transform-box: view-box; animation: fpt-presenter-arrive .8s cubic-bezier(.18,.72,.22,1) both; }
        .fpt-presenter-1 { transform-origin: 270px 700px; }
        .fpt-presenter-2 { transform-origin: 270px 700px; }
        @keyframes fpt-title-arrive { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fpt-diagram-in { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fpt-card-build { 0% { opacity: 0; transform: translateY(-9px) scale(.94); } 48% { opacity: .45; } 100% { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes fpt-line-draw { to { stroke-dashoffset: 0; } }
        @keyframes fpt-orbit-turn { to { transform: rotate(360deg); } }
        @keyframes fpt-flash { 0%,100% { opacity: .18; transform: scale(.75); } 42% { opacity: 1; transform: scale(1.13); } 58% { opacity: .82; transform: scale(1); } }
        @keyframes fpt-breathe { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
        @keyframes fpt-collateral-fill { from { transform: scaleX(.03); } to { transform: scaleX(1); } }
        @keyframes fpt-collateral-dot { from { transform: translateX(-29px); } to { transform: translateX(0); } }
        @keyframes fpt-position-fill { from { transform: scaleX(.035); } to { transform: scaleX(1); } }
        @keyframes fpt-marker-travel { 0% { transform: translateX(0); } 72% { transform: translateX(282px); } 82% { transform: translateX(282px) scale(1.32); } 100% { transform: translateX(282px); } }
        @keyframes fpt-ten-pulse { 0%,70%,100% { opacity: 1; transform: scale(1); } 78% { opacity: .7; transform: scale(1.14); } 86% { opacity: 1; transform: scale(1); } }
        @keyframes fpt-streak { 0%,30% { opacity: 0; transform: translateX(0); } 65% { opacity: .9; } 100% { opacity: .08; transform: translateX(280px); } }
        @keyframes fpt-chart-draw { to { stroke-dashoffset: 0; } }
        @keyframes fpt-price-cross { 0% { transform: translate(0,0); opacity: 0; } 8% { opacity: 1; } 36% { transform: translate(103px,-47px); } 68% { transform: translate(151px,56px); } 100% { transform: translate(157px,51px); opacity: .92; } }
        @keyframes fpt-entry-pulse { 0% { opacity: .2; transform: scale(.7); } 42% { opacity: 1; transform: scale(1.4); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes fpt-presenter-arrive { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) {
          .fpt-frame *, .fpt-frame *::before, .fpt-frame *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <svg className="fpt-background" viewBox="0 0 540 960" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <radialGradient id="fpt-sky-glow">
            <stop offset="0" stopColor="#748980" stopOpacity=".2" />
            <stop offset="1" stopColor="#728981" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="fpt-floor" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1b3037" stopOpacity=".08" />
            <stop offset="1" stopColor="#09141b" stopOpacity=".68" />
          </linearGradient>
        </defs>
        <ellipse className="fpt-stage-glow" cx="270" cy="463" rx="285" ry="300" fill="url(#fpt-sky-glow)" />
        <path d="M0 618H540v342H0Z" fill="url(#fpt-floor)" />
        <g className="fpt-floor-grid" stroke="#b9ae91" strokeWidth="1" fill="none">
          <path d="M270 617 0 960M270 617 65 960M270 617 132 960M270 617 199 960M270 617 270 960M270 617 341 960M270 617 408 960M270 617 475 960M270 617 540 960" />
          <path d="M0 644h540M0 676h540M0 715h540M0 764h540M0 826h540M0 907h540M0 955h540" />
        </g>
        <path d="M0 618c121-21 419-21 540 0" className="fpt-scene-edge" strokeWidth="1.5" />
        <path d="M20 618c91-35 409-35 500 0" fill="none" stroke="#d6bc84" strokeOpacity=".08" />
        <circle cx="54" cy="202" r="1.4" fill="#e2d3b1" opacity=".62" />
        <circle cx="473" cy="195" r="1.1" fill="#e2d3b1" opacity=".48" />
        <circle cx="454" cy="520" r="1.2" fill="#e2d3b1" opacity=".48" />
        <circle cx="79" cy="514" r="1.2" fill="#e2d3b1" opacity=".42" />
      </svg>

      <svg className="fpt-visuals" viewBox="0 0 540 960" aria-hidden="true">
        <defs>
          <linearGradient id="fpt-card" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#28404a" stopOpacity=".94" />
            <stop offset=".52" stopColor="#182b35" stopOpacity=".88" />
            <stop offset="1" stopColor="#10212a" stopOpacity=".96" />
          </linearGradient>
          <linearGradient id="fpt-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#71837b" stopOpacity=".65" />
            <stop offset="1" stopColor="#1a2a31" stopOpacity=".9" />
          </linearGradient>
          <linearGradient id="fpt-gold-bar" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#a98d5d" />
            <stop offset="1" stopColor="#f1d797" />
          </linearGradient>
          <linearGradient id="fpt-position-bar" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#82a69e" />
            <stop offset=".62" stopColor="#d6c397" />
            <stop offset="1" stopColor="#f0d695" />
          </linearGradient>
          <linearGradient id="fpt-profit-line" x1="0" y1="1" x2="1" y2="0">
            <stop stopColor="#af9361" />
            <stop offset="1" stopColor="#f1d99e" />
          </linearGradient>
          <linearGradient id="fpt-loss-line" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#bd776b" />
            <stop offset="1" stopColor="#ef9e82" />
          </linearGradient>
          <linearGradient id="fpt-jacket" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#c6bba5" />
            <stop offset=".42" stopColor="#928f84" />
            <stop offset="1" stopColor="#596872" />
          </linearGradient>
          <linearGradient id="fpt-lapel" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#d7c9ad" />
            <stop offset="1" stopColor="#8b908a" />
          </linearGradient>
          <linearGradient id="fpt-skin" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#f0c39c" />
            <stop offset=".55" stopColor="#dca982" />
            <stop offset="1" stopColor="#b8785f" />
          </linearGradient>
          <linearGradient id="fpt-hair" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#323431" />
            <stop offset=".55" stopColor="#1b2425" />
            <stop offset="1" stopColor="#0e191e" />
          </linearGradient>
          <linearGradient id="fpt-beard" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#41403a" />
            <stop offset="1" stopColor="#20282a" />
          </linearGradient>
        </defs>
        {beatIndex === 0 ? <ContractDiagram key="contract" /> : null}
        {beatIndex === 1 ? <LeverageDiagram key="leverage" /> : null}
        {beatIndex === 2 ? <PayoffDiagram key="payoff" /> : null}
        <Presenter beat={beatIndex} warning={warning} />
      </svg>

      <div className="fpt-kicker" key={`kicker-${beatIndex}`}>{beat.kicker}</div>
      <h1 className="fpt-headline" key={`headline-${beatIndex}`}>{beat.headline}</h1>

      <div className="fpt-caption" aria-label={beat.caption} key={`caption-${beatIndex}`}>
        {captionWords.map((word, index) => (
          <span
            className={`fpt-caption-word${index < activeWord ? " is-past" : ""}${index === activeWord ? " is-active" : ""}`}
            key={`${word}-${index}`}
          >
            {word}
          </span>
        ))}
      </div>

      <div className="fpt-progress" aria-hidden="true">
        {[0, 1, 2].map((index) => {
          const width = index < beatIndex ? 100 : index > beatIndex ? 0 : (beatTime / 6000) * 100;
          return (
            <span className="fpt-progress-segment" key={index}>
              <span className="fpt-progress-fill" style={{ width: `${width}%` }} />
            </span>
          );
        })}
      </div>
    </div>
  );
}