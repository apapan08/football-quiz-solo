import React, { useEffect, useMemo, useState } from "react";
import { questions as DATA_QUESTIONS } from "./data/questions";

/**
 * Football Quiz — SOLO MODE (single player)
 * - One-button X2 flow
 * - Classic Previous/Next buttons; Next disabled on Answer until marked
 * - Correct=green gradient, Wrong=red gradient
 * - Centered wager UI on final
 * - Scoring box bigger, no manual +/- adjusters
 * - Hide X2 box on Final question
 */

const SOLO = true;

// ——— Brand font wiring ———
const FONT_LINK_HREF =
  "https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&family=Noto+Sans:wght@400;700&display=swap&subset=greek";

const FONT_FAMILIES = {
  display:
    '"Noto Sans", Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  ui: '"Noto Sans",Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

// ——— Theme ———
const THEME = {
  gradientFrom: "#223B57",
  gradientTo: "#2F4E73",
  accent: "#F11467",
  card: "rgba(17, 24, 39, 0.55)",
  border: "rgba(255,255,255,0.08)",
  badgeGradient: "linear-gradient(90deg,#BA1ED3,#F11467)", // pink/purple pill
  positiveGrad: "linear-gradient(90deg,#22C55E,#10B981)", // green
  negativeGrad: "linear-gradient(90deg,#F43F5E,#EF4444)", // red
};

// ——— Game constants ———
const STORAGE_KEY = "quiz_prototype_state_v2_solo";
const STAGES = {
  CATEGORY: "category",
  QUESTION: "question",
  ANSWER: "answer",
  FINALE: "finale",
  RESULTS: "results",
};

function clamp(n, a, b) {
  return Math.min(b, Math.max(a, n));
}
function usePersistentState(key, initialValue) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {}
  }, [key, state]);
  return [state, setState];
}

export default function QuizPrototype() {
  // ——— Inject brand fonts + base CSS once ———
  useEffect(() => {
    let linkEl;
    let styleEl;
    if (FONT_LINK_HREF) {
      linkEl = document.createElement("link");
      linkEl.rel = "stylesheet";
      linkEl.href = FONT_LINK_HREF;
      document.head.appendChild(linkEl);
    }
    styleEl = document.createElement("style");
    styleEl.innerHTML = `
      :root { 
        --brand-grad-from: ${THEME.gradientFrom}; 
        --brand-grad-to: ${THEME.gradientTo}; 
        --brand-accent: ${THEME.accent}; 
        --brand-card: ${THEME.card}; 
        --brand-border: ${THEME.border};
        --howto-bg: rgba(15,23,42,0.95);
      }
      .font-display { font-family: ${FONT_FAMILIES.display}; }
      .font-ui { font-family: ${FONT_FAMILIES.ui}; }
      .font-mono { font-family: ${FONT_FAMILIES.mono}; }
      .btn { @apply rounded-2xl px-5 py-2 font-semibold shadow; }
      .btn-accent { background: var(--brand-accent); color: white; }
      .btn-accent:hover { filter: brightness(1.06); }
      .btn-neutral { background: rgba(148,163,184,0.15); color: white; }
      .btn-neutral:hover { background: rgba(148,163,184,0.25); }
      .card { background: var(--brand-card); border:1px solid var(--brand-border); border-radius: 1.5rem; padding:1.5rem; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
      .pill { border-radius: 999px; padding: .25rem .6rem; font-weight: 700; }

      /* HowTo modal helpers */
      .scroll-area { overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
      .scroll-area::-webkit-scrollbar { width:10px; }
      .scroll-area::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.18); border-radius:999px; }
      .howto-shadow { position: sticky; bottom: 0; height: 24px; background: linear-gradient(to top, var(--howto-bg), transparent); pointer-events: none; }
    `;
    document.head.appendChild(styleEl);
    return () => {
      if (linkEl) document.head.removeChild(linkEl);
      if (styleEl) document.head.removeChild(styleEl);
    };
  }, []);

  // ——— Load & order questions ———
  const QUESTIONS = useMemo(
    () => [...DATA_QUESTIONS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    []
  );

  // ——— Core game state ———
  const [index, setIndex] = usePersistentState(`${STORAGE_KEY}:index`, 0);
  const [stage, setStage] = usePersistentState(
    `${STORAGE_KEY}:stage`,
    STAGES.CATEGORY
  );

  const lastIndex = QUESTIONS.length - 1;
  const isFinalIndex = index === lastIndex;
  const q = QUESTIONS[index] ?? QUESTIONS[0];

  // Safety: if persisted index is out-of-range
  useEffect(() => {
    if (index > lastIndex) setIndex(lastIndex < 0 ? 0 : lastIndex);
  }, [index, lastIndex, setIndex]);

  // ——— X2 help (single player) ———
  const [x2, setX2] = usePersistentState(`${STORAGE_KEY}:x2`, {
    p1: { available: true, armedIndex: null },
  });

  // Player
  const [p1, setP1] = usePersistentState(`${STORAGE_KEY}:p1`, {
    name: "Όνομα Παίκτη",
    score: 0,
    streak: 0,
    maxStreak: 0,
  });

  const [lastCorrect, setLastCorrect] = usePersistentState(
    `${STORAGE_KEY}:lastCorrect`,
    null
  );

  // Track if this question has been marked on the Answer stage
  const [answered, setAnswered] = usePersistentState(
    `${STORAGE_KEY}:answered`,
    {} // { [index]: 'correct' | 'wrong' | 'final-correct' | 'final-wrong' }
  );

  // Finale wager (only Player)
  const [wager, setWager] = usePersistentState(`${STORAGE_KEY}:wager`, { p1: 0 });
  const [finalResolved, setFinalResolved] = usePersistentState(
    `${STORAGE_KEY}:finalResolved`,
    { p1: false }
  );

  // How-to modal
  const [showHowTo, setShowHowTo] = useState(true);

  // On entering Category: reset finale flags
  useEffect(() => {
    if (stage !== STAGES.CATEGORY) return;
    setFinalResolved({ p1: false });
    setWager({ p1: 0 });
  }, [stage, index]);

  // X2 helpers
  function canArmX2(side) {
    const player = x2[side];
    return player?.available && !isFinalIndex && stage === STAGES.CATEGORY;
  }
  function armX2(side) {
    if (!canArmX2(side)) return;
    setX2((s) => ({
      ...s,
      [side]: { available: false, armedIndex: index },
    }));
  }
  function isX2ActiveFor(side) {
    const player = x2[side];
    return player?.armedIndex === index;
  }

  // Award base uses category points × (X2 if active), plus streak logic
  function awardToP1(base = 1, { useMultiplier = true } = {}) {
    const baseMult =
      (q.points || 1) * (useMultiplier ? (isX2ActiveFor("p1") ? 2 : 1) : 1);
    const baseDelta = base * baseMult;

    setP1((s) => {
      const newStreak = lastCorrect === "p1" ? s.streak + 1 : 1;
      const streakBonus = newStreak >= 3 ? 1 : 0; // not multiplied
      return {
        ...s,
        score: s.score + baseDelta + streakBonus,
        streak: newStreak,
        maxStreak: Math.max(s.maxStreak, newStreak),
      };
    });
    setLastCorrect("p1");
  }

  function noAnswer() {
    setLastCorrect(null);
    setP1((s) => ({ ...s, streak: 0 }));
  }

  function finalizeOutcomeP1(outcome) {
    const bet = wager.p1;
    if (finalResolved.p1 /* || bet <= 0 */) return; // allow 0 wager to proceed
    if (outcome === "correct") {
      setP1((s) => ({ ...s, score: s.score + bet }));
    } else {
      setP1((s) => ({ ...s, score: s.score - bet }));
    }
    setFinalResolved({ p1: true });
    setAnswered((a) => ({ ...a, [index]: outcome === "correct" ? "final-correct" : "final-wrong" }));
  }

  function next() {
    if (stage === STAGES.CATEGORY) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.QUESTION);
    else if (stage === STAGES.QUESTION) setStage(STAGES.ANSWER);
    else if (stage === STAGES.ANSWER) {
      if (index < lastIndex) {
        setIndex((i) => i + 1);
        setStage(STAGES.CATEGORY);
      } else setStage(STAGES.RESULTS);
    }
  }
  function previous() {
    if (stage === STAGES.QUESTION) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.ANSWER) setStage(STAGES.QUESTION);
    else if (stage === STAGES.FINALE) setStage(STAGES.CATEGORY);
    else if (stage === STAGES.RESULTS) setStage(STAGES.ANSWER);
    else if (stage === STAGES.CATEGORY && index > 0) {
      setIndex((i) => i - 1);
      setStage(STAGES.ANSWER);
    }
  }

  function resetGame() {
    setIndex(0);
    setStage(STAGES.CATEGORY);
    setP1({ name: p1.name, score: 0, streak: 0, maxStreak: 0 });
    setWager({ p1: 0 });
    setFinalResolved({ p1: false });
    setLastCorrect(null);
    setX2({ p1: { available: true, armedIndex: null } });
    setAnswered({});
  }

  async function exportShareCard() {
    const w = 1080, h = 1350;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    if (document.fonts && document.fonts.ready) {
      try { await document.fonts.ready; } catch {}
    }
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, THEME.gradientFrom);
    g.addColorStop(1, THEME.gradientTo);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `800 64px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText("Ποδοσφαιρικό Κουίζ — Αποτελέσματα Σόλο", w / 2, 140);
    ctx.font = `700 52px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`${p1.name}: ${p1.score}`, w / 2, 300);
    ctx.font = `800 76px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`Τελικό σκορ: ${p1.score}`, w / 2, 520);
    ctx.font = `600 42px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillText(`Μεγαλύτερο σερί — ${p1.maxStreak}`, w / 2, 680);
    ctx.font = `500 30px Inter, Noto Sans, system-ui, sans-serif`;
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillText("onlyfootballfans • σόλο παιχνίδι", w / 2, h - 80);
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = "quiz-results.png";
    a.click();
  }

  // ——— UI subcomponents ———
  function Header() {
    return (
      <div className="px-4 pt-6 pb-2 font-ui">
        <div className="flex items-center justify-center gap-3">
          <img src="/logo.png" alt="Λογότυπο" className="h-7 w-auto drop-shadow" />
          <span
            className="rounded-full px-3 py-1 text-sm font-semibold shadow"
            style={{ background: THEME.accent }}
          >
            Ερ. {index + 1} από {QUESTIONS.length}
          </span>
        </div>
        <div className="mt-2 text-center text-xs uppercase tracking-wide text-slate-300">
          {stageLabel(stage)}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <button onClick={() => { setShowHowTo(true); }} className="pill bg-white text-black">🇬🇷 Οδηγίες</button>
        </div>
      </div>
    );
  }

  function StageCard({ children }) {
    return <div className="card">{children}</div>;
  }

  function CategoryStage() {
    return (
      <StageCard>
        <div className="flex items-center justify-between">
          <div className="text-rose-400 text-4xl">🏆</div>
          <div className="flex items-center gap-2">
            <div className="pill text-white bg-slate-700/70">
              Κατηγορία ×{q.points || 1}
            </div>
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-wide font-display">
          {q.category}
        </h2>
        <p className="mt-2 text-center font-ui" style={{ color: THEME.accent }}>
          x{q.points || 1} Πόντοι
        </p>

        {/* X2 (single button) — HIDDEN on Final */}
        {!isFinalIndex && (
          <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
            <div className="mb-2 text-center text-sm text-slate-300 font-ui">
              Βοήθεια Χ2
            </div>
            <div className="max-w-2xl mx-auto flex justify-center">
              <X2Control
                label={p1.name}
                side="p1"
                armed={isX2ActiveFor("p1")}
                available={x2.p1.available}
                onArm={() => armX2("p1")}
                isFinal={isFinalIndex}
              />
            </div>
          </div>
        )}

        {/* Final betting UI on last question */}
        {isFinalIndex && (
          <div className="mt-5 rounded-2xl bg-slate-900/50 p-4">
            <div className="mb-2 text-center text-sm text-slate-300 font-ui">
              Τελικός — Τοποθέτησε το ποντάρισμά σου (0–3) και πάτησε Επόμενο.
            </div>
            <div className="max-w-2xl mx-auto flex justify-center">
              <WagerControl
                label={p1.name}
                value={wager.p1}
                onChange={(n) => setWager({ p1: clamp(n, 0, 3) })}
              />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center gap-3">
          <NavButtons />
        </div>
      </StageCard>
    );
  }

  function QuestionStage() {
    return (
      <StageCard>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-semibold">
            Κατηγορία ×{q.points || 1}
          </div>
          {isX2ActiveFor("p1") && (
            <div
              className="rounded-full px-3 py-1 text-xs font-semibold text-white"
              style={{ background: THEME.badgeGradient }}
            >
              {p1.name}: ×2
            </div>
          )}
        </div>

        <h3 className="mt-4 font-display text-2xl font-bold leading-snug">
          {q.prompt}
        </h3>

        {/* Media */}
        <div className="mt-4">
          <Media media={q.media} />
        </div>

        <div className="mt-6 flex justify-center">
          <button
            onClick={() => setStage(STAGES.ANSWER)}
            className="btn btn-accent"
          >
            Εμφάνιση απάντησης
          </button>
        </div>
      </StageCard>
    );
  }

  function AnswerStage() {
    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">
            {q.answer}
          </div>
          {q.fact && (
            <div className="mt-2 font-ui text-sm text-slate-300">
              ℹ️ {q.fact}
            </div>
          )}
        </div>

        {/* X2 status reminder */}
        <div className="mt-3 text-center text-xs text-slate-400 font-ui">
          {isX2ActiveFor("p1") && <span>({p1.name}: ×2 ενεργό)</span>}
        </div>

        {/* Awarding controls (hide on Final) */}
        {!isFinalIndex && (
          <div className="mt-6 flex flex-col items-center gap-3 font-ui">
            <div className="flex flex-wrap justify-center gap-2">
              <button
                className="btn text-white"
                style={{ background: THEME.positiveGrad }}
                onClick={() => { awardToP1(1); setAnswered((a) => ({ ...a, [index]: "correct" })); next(); }}
                title="Σωστό"
              >
                Σωστό
              </button>
              <button
                className="btn text-white"
                style={{ background: THEME.negativeGrad }}
                onClick={() => { noAnswer(); setAnswered((a) => ({ ...a, [index]: "wrong" })); next(); }}
                title="Λάθος / Καμία απάντηση — μηδενίζει το σερί"
              >
                Λάθος / Καμία απάντηση
              </button>
            </div>
          </div>
        )}

        {/* Final scoring controls on last question */}
        {isFinalIndex && (
          <div className="card font-ui mt-6 text-center">
            <div className="mb-2 text-sm text-slate-300">
              Τελικός — Απονέμονται πόντοι βάσει πονταρίσματος
            </div>
            <div className="text-xs text-slate-400 mb-3">
              Το Χ2 δεν ισχύει στον Τελικό.
            </div>
            <div className="space-y-2">
              <div className="text-sm text-slate-300">{p1.name}</div>
              <div className="flex flex-wrap justify-center gap-2">
                <button
                  disabled={finalResolved.p1 /* || wager.p1 === 0 */}
                  onClick={() => { finalizeOutcomeP1("correct"); next(); }}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: THEME.positiveGrad }}
                >
                  Σωστό +{wager.p1}
                </button>
                <button
                  disabled={finalResolved.p1 /* || wager.p1 === 0 */}
                  onClick={() => { finalizeOutcomeP1("wrong"); next(); }}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: THEME.negativeGrad }}
                >
                  Λάθος −{wager.p1}
                </button>
                {finalResolved.p1 && (
                  <span className="text-xs text-emerald-300">Ολοκληρώθηκε ✔</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-center">
          <NavButtons />
        </div>
      </StageCard>
    );
  }

  function ResultsStage() {
    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">Τελικό σκορ</div>
          <div className="mt-2 font-ui text-slate-300">
            {p1.name}: {p1.score}
          </div>
          <div className="mt-2 font-ui text-sm text-slate-400">
            Μεγαλύτερο σερί: {p1.maxStreak}
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3 font-ui">
          <button onClick={resetGame} className="btn btn-accent">
            Παίξε ξανά
          </button>
        </div>
      </StageCard>
    );
  }

  // ——— Single-button X2 control ———
  function X2Control({ label, side, available, armed, onArm, isFinal }) {
    const status = available
      ? "Χ2 διαθέσιμο"
      : armed
      ? "Χ2 ενεργό"
      : "Χ2 χρησιμοποιήθηκε";

    const clickable = available && !isFinal && canArmX2(side);

    return (
      <div className="card font-ui mx-auto text-center">
        <div className="mb-3 text-sm text-slate-300">{label}</div>
        <button
          className="rounded-full px-4 py-2 text-white font-extrabold shadow"
          style={{ background: THEME.badgeGradient }}
          onClick={() => clickable && onArm()}
          disabled={!clickable}
          title={
            isFinal
              ? "Δεν επιτρέπεται στον Τελικό"
              : available
              ? "Ενεργοποίηση Χ2 για αυτόν τον γύρο"
              : "Δεν απομένει Χ2"
          }
        >
          {status}
        </button>
        <div className="mt-2 text-xs text-slate-400">
          Μπορεί να χρησιμοποιηθεί μόνο μία φορά.
        </div>
      </div>
    );
  }

  function WagerControl({ label, value, onChange }) {
    return (
      <div className="card font-ui text-center flex flex-col items-center">
        <div className="mb-3 text-sm text-slate-300">{label}</div>
        <div className="flex items-center gap-2 justify-center">
          <button className="btn btn-neutral" onClick={() => onChange(value - 1)}>
            −
          </button>
          <div
            className="pill text-white text-xl px-5 py-2"
            style={{ background: THEME.badgeGradient }}
          >
            {value}
          </div>
          <button className="btn btn-neutral" onClick={() => onChange(value + 1)}>
            +
          </button>
        </div>
        <div className="mt-2 text-xs text-slate-400">Ποντάρισμα 0–3 πόντοι</div>
      </div>
    );
  }

  // ——— Classic nav with Next disabled on Answer until marked ———
  function NavButtons() {
    const nextDisabled =
      stage === STAGES.ANSWER
        ? (!isFinalIndex ? !answered[index] : !finalResolved.p1)
        : false;

    return (
      <div className="flex items-center justify-center gap-3">
        <button onClick={previous} className="btn btn-neutral">
          ← Προηγούμενο
        </button>
        <button
          onClick={next}
          className="btn btn-accent disabled:opacity-50"
          disabled={nextDisabled}
          title={nextDisabled ? "Καταχώρισε πρώτα την απάντηση" : "Επόμενο"}
        >
          Επόμενο →
        </button>
      </div>
    );
  }

  function Media({ media }) {
    if (!media || !media.kind) return null;

    if (media.kind === "image") {
      return (
        <img
          src={media.src}
          alt={media.alt || ""}
          loading="lazy"
          className="max-h-96 w-auto mx-auto rounded-xl"
        />
      );
    }

    if (media.kind === "audio") {
      return (
        <audio
          key={media.src}
          controls
          preload="metadata"
          playsInline
          className="w-full mt-2"
          src={media.src}                 // <- important for Mi Browser
          style={{ minHeight: 44 }}
        >
          <source src={media.src} type="audio/mpeg" />
          Το πρόγραμμα περιήγησής σου δεν μπορεί να αναπαράγει αυτό το ηχητικό.
        </audio>
      );
    }


    if (media.kind === "video") {
      return (
        <video
          key={media.src}
          controls
          preload="metadata"
          playsInline
          poster={media.poster}
          className="w-full max-h-[70vh] rounded-xl"
        >
          <source src={media.src} type={media.type || "video/mp4"} />
          Το πρόγραμμα περιήγησής σου δεν μπορεί να αναπαράγει αυτό το βίντεο.
        </video>
      );
    }

    return null;
  }

  // ——— Lightweight self-tests ———
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== "#selftest") return;
    try {
      const applyFinal = (score, bet, outcome) =>
        outcome === "correct" ? score + bet : score - bet;
      console.assert(
        applyFinal(10, 3, "correct") === 13,
        "Final: +bet on correct"
      );
      console.assert(applyFinal(10, 2, "wrong") === 8, "Final: -bet on wrong");
      const streakBonus = (prev, same) =>
        (same ? prev + 1 : 1) >= 3 ? 1 : 0;
      console.assert(
        streakBonus(2, true) === 1 && streakBonus(1, true) === 0,
        "Streak bonus from 3rd correct"
      );
      console.log("%cSelf-tests passed (solo)", "color: #10b981");
    } catch (e) {
      console.warn("Self-tests failed", e);
    }
  }, []);

  return (
    <div
      className="min-h-screen w-full flex justify-center items-start p-4"
      style={{
        background: `linear-gradient(180deg, ${THEME.gradientFrom}, ${THEME.gradientTo})`,
      }}
    >
      <div className="w-full max-w-4xl space-y-4 text-slate-100">
        <Header />
        {showHowTo && (
          <HowToModal
            onClose={() => setShowHowTo(false)}
          />
        )}

        {stage === STAGES.CATEGORY && <CategoryStage />}
        {stage === STAGES.QUESTION && <QuestionStage />}
        {stage === STAGES.ANSWER && <AnswerStage />}

        {/* Score panel (shows on all non-results stages) */}
        {stage !== STAGES.RESULTS && (
          <>
            <div className="mt-2 text-center text-lg font-semibold font-ui">
              Σκορ
            </div>
            <div className="grid grid-cols-1 gap-4 max-w-3xl mx-auto">
              <PlayerPanel side="p1" player={p1} setPlayer={setP1} />
            </div>
          </>
        )}

        {stage === STAGES.RESULTS && <ResultsStage />}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs text-slate-300 font-ui">
          <div>Στάδιο: {stageLabel(stage)}</div>
          <div className="flex items-center gap-3">
            <button className="btn btn-neutral" onClick={resetGame}>
              Επαναφορά παιχνιδιού
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function stageLabel(stage) {
  switch (stage) {
    case STAGES.CATEGORY:
      return "Στάδιο Κατηγορίας";
    case STAGES.QUESTION:
      return "Στάδιο Ερώτησης";
    case STAGES.ANSWER:
      return "Στάδιο Απάντησης";
    case STAGES.FINALE:
      return "Τελικός (Στοίχημα)";
    case STAGES.RESULTS:
      return "Αποτελέσματα";
    default:
      return "";
  }
}

// Hoisted to avoid remounting and input focus loss on each keystroke
function PlayerPanel({ side, player, setPlayer }) {
  return (
    <div className="card font-ui">
      <div className="mb-4 flex items-center justify-between">
        <input
          className="w-48 rounded-lg bg-slate-900/60 px-3 py-2 text-slate-100 outline-none"
          value={player.name}
          onChange={(e) => setPlayer((s) => ({ ...s, name: e.target.value }))}
          aria-label="όνομα παίκτη"
          placeholder="Όνομα Παίκτη"
        />
        <div
          className="text-white font-extrabold rounded-full text-2xl md:text-4xl px-6 py-3"
          style={{ background: THEME.badgeGradient }}
          aria-label="Σκορ"
        >
          {player.score}
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Σερί:</span>
          <span
            className="pill text-amber-200"
            style={{ background: "rgba(245, 158, 11, 0.25)" }}
          >
            {player.streak > 0 ? `🔥 +${player.streak}` : "—"}
          </span>
          <span className="text-slate-500 text-xs">(μέγ. {player.maxStreak})</span>
        </div>
      </div>
    </div>
  );
}

function HowToModal({ onClose, totalQuestions = 9 }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />
      <div className="min-h-full flex items-start sm:items-center justify-center p-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="relative w-full max-w-[680px] font-ui rounded-2xl shadow-xl ring-1 ring-white/10 bg-[var(--howto-bg)] text-slate-100 flex flex-col overflow-hidden max-h-[clamp(420px,85dvh,760px)]">
          <div className="sticky top-0 z-10 px-6 py-4 bg-[var(--howto-bg)] backdrop-blur-sm rounded-t-2xl flex items-center justify-between border-b border-white/10">
            <h2 className="font-display text-2xl font-extrabold">
              Πώς παίζεται
            </h2>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="btn btn-neutral">Κλείσιμο ✕</button>
            </div>
          </div>

          <div className="scroll-area px-6 pb-6 pt-2 flex-1 min-h-0 text-slate-100 text-sm md:text-base leading-relaxed">
            <ul className="mt-2 list-disc pl-5 space-y-2">
              <li><strong>{totalQuestions} ερωτήσεις.</strong> Κάθε μία έχει συγκεκριμένους πόντους (ανάλογα με τη δυσκολία).</li>
              <li><strong>Στόχος:</strong> μάζεψε όσο περισσότερους πόντους μπορείς.</li>
              <li><strong>Ροή:</strong> Κατηγορία → Ερώτηση → Απάντηση.</li>
              <li><strong>Χ2:</strong> Όταν εμφανίζεται η Κατηγορία μπορείς να ενεργοποιήσεις <strong>μία φορά</strong> ανά παιχνίδι. Διπλασιάζει μόνο τους πόντους αυτής της ερώτησης.</li>
              <li><strong>Σερί:</strong> Από την <strong>3η συνεχόμενη σωστή</strong> και μετά, παίρνεις έξτρα <strong>+1</strong> (δεν διπλασιάζεται). Ξεκινά πάλι από την αρχή όταν χαθεί μια ερώτηση.</li>
              <li><strong>Τελική ερώτηση (στοίχημα 0–3):</strong> Πριν εμφανιστεί η τελευταία ερώτηση, διάλεξε πόσους πόντους θα ρισκάρεις (0–3). Αν απαντήσεις σωστά, <strong>κερδίζεις</strong> τόσους πόντους· αν απαντήσεις λάθος ή δεν απαντήσεις, <strong>χάνεις</strong> τους ίδιους πόντους. Αν βάλεις 0, ούτε κερδίζεις ούτε χάνεις. <em>Το Χ2 δεν επιτρέπεται και δεν προστίθεται το bonus του σερί.</em> <span className="block text-slate-400 mt-1 text-[0.95em]">Παράδειγμα: σκορ 15 και στοίχημα 2 → σωστό = 17, λάθος/καμία απάντηση = 13.</span></li>
            </ul>
            <div className="howto-shadow" />
          </div>
        </div>
      </div>
    </div>
  );
}
