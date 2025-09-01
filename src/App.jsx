import React, { useEffect, useMemo, useState } from "react";
import { questions as DATA_QUESTIONS } from "./data/questions";

/**
 * Football Quiz — SOLO MODE (single player)
 * - Intro screen listing categories & points
 * - Text answer on Question stage + "Δεν γνωρίζω"
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
  INTRO: "intro",
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

      /* HowTo-like surfaces for Intro */
      .surface-howto { background: var(--howto-bg); border:1px solid rgba(255,255,255,0.10); border-radius:1.5rem; padding:1.5rem; box-shadow: 0 10px 24px rgba(0,0,0,.35); }
      .subcard-howto { background: rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.10); border-radius:1rem; padding:1rem; }
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

  // ——— Category summary for Intro ———
  const CATEGORY_SUMMARY = useMemo(() => {
    const map = new Map();
    for (const q of QUESTIONS) {
      const key = q.category || "—";
      if (!map.has(key)) map.set(key, { category: key, points: new Set(), count: 0 });
      const e = map.get(key);
      e.points.add(q.points || 1);
      e.count += 1;
    }
    return Array.from(map.values()).map((e) => ({
      category: e.category,
      count: e.count,
      points: Array.from(e.points).sort((a, b) => a - b),
    }));
  }, [QUESTIONS]);

  // ——— Core game state ———
  const [index, setIndex] = usePersistentState(`${STORAGE_KEY}:index`, 0);
  const [stage, setStage] = usePersistentState(
    `${STORAGE_KEY}:stage`,
    STAGES.INTRO
  );

  const lastIndex = QUESTIONS.length - 1;
  const isFinalIndex = index === lastIndex;
  const q = QUESTIONS[index] ?? QUESTIONS[0];

  const finalCategoryName = useMemo(
  () => (QUESTIONS.length ? QUESTIONS[QUESTIONS.length - 1].category : null),
  [QUESTIONS]
);

// Categories to show on Intro (exclude the final question's category)
const INTRO_CATEGORIES = useMemo(() => {
  return CATEGORY_SUMMARY.filter((c) => c.category !== finalCategoryName);
}, [CATEGORY_SUMMARY, finalCategoryName]);

// Clean topic label for the final row (remove leading "Τελική ερώτηση —/–/-/: ")
const finalTopicLabel = useMemo(() => {
  const raw = finalCategoryName || "";
  return raw.replace(/^\s*Τελική\s+ερώτηση\s*[—–\-:]\s*/i, "").trim() || raw;
}, [finalCategoryName]);


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

  // Player's typed answers (committed on submit / don't know)
  const [playerAnswers, setPlayerAnswers] = usePersistentState(
    `${STORAGE_KEY}:playerAnswers`,
    {} // { [index]: string }
  );

  // How-to modal
  const [showHowTo, setShowHowTo] = useState(true);

  // ——— Results reconstruction ———
  const RESULT_ROWS = useMemo(() => {
    if (!QUESTIONS.length) return [];
    const last = QUESTIONS.length - 1;

    let running = 0;
    let streak = 0;

    const rows = QUESTIONS.map((qi, i) => {
      const outcomeKey = answered[i];
      const isFinal = i === last;
      const base = qi.points || 1;
      const x2Applied = !isFinal && x2?.p1?.armedIndex === i;
      const userAnswer = (playerAnswers && playerAnswers[i]) || "";

      let delta = 0;
      let bonus = 0;
      let outcome = "—";

      if (isFinal) {
        if (outcomeKey === "final-correct") {
          outcome = "Σωστό";
          delta = wager?.p1 || 0;
        } else if (outcomeKey === "final-wrong") {
          outcome = "Λάθος";
          delta = -(wager?.p1 || 0);
        } else {
          outcome = "—";
        }
      } else {
        if (outcomeKey === "correct") {
          outcome = "Σωστό";
          streak = streak + 1;
          bonus = streak >= 3 ? 1 : 0;
          delta = base * (x2Applied ? 2 : 1) + bonus;
        } else if (outcomeKey === "wrong") {
          outcome = "Λάθος";
          streak = 0;
          delta = 0;
        } else {
          outcome = "—";
          streak = 0;
          delta = 0;
        }
      }

      running += delta;

      return {
        idx: i + 1,
        category: qi.category || "—",
        prompt: qi.prompt,
        base,
        x2Applied,
        bonus,
        outcome,
        userAnswer,
        delta,
        running,
        isFinal,
      };
    });

    return rows;
  }, [QUESTIONS, answered, x2, wager, playerAnswers]);

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
    if (finalResolved.p1) return; // allow 0 wager to proceed
    if (outcome === "correct") {
      setP1((s) => ({ ...s, score: s.score + bet }));
    } else {
      setP1((s) => ({ ...s, score: s.score - bet }));
    }
    setFinalResolved({ p1: true });
    setAnswered((a) => ({ ...a, [index]: outcome === "correct" ? "final-correct" : "final-wrong" }));
  }

  function next() {
    if (stage === STAGES.INTRO) {
      setIndex(0);
      setStage(STAGES.CATEGORY);
    } else if (stage === STAGES.CATEGORY) setStage(STAGES.QUESTION);
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
    else if (stage === STAGES.CATEGORY) {
      if (index > 0) {
        setIndex((i) => i - 1);
        setStage(STAGES.ANSWER);
      } else {
        setStage(STAGES.INTRO); // back to Intro from first Category
      }
    }
  }

  function resetGame() {
    setIndex(0);
    setStage(STAGES.INTRO); // show Intro after reset
    setP1({ name: p1.name, score: 0, streak: 0, maxStreak: 0 });
    setWager({ p1: 0 });
    setFinalResolved({ p1: false });
    setLastCorrect(null);
    setX2({ p1: { available: true, armedIndex: null } });
    setAnswered({});
    setPlayerAnswers({});
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
    const showCounter = stage !== STAGES.INTRO && stage !== STAGES.RESULTS;
    return (
      <div className="px-4 pt-6 pb-2 font-ui">
        <div className="flex items-center justify-center gap-3">
          <img
            src="/logo.png"
            alt="Λογότυπο"
            className="h-7 w-auto"
            loading="eager"
            decoding="sync"
            fetchpriority="high"
            style={{
              filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.4))",
              transform: "translateZ(0)",
              WebkitBackfaceVisibility: "hidden",
              willChange: "transform",
            }}
          />
          {showCounter && (
            <span
              className="rounded-full px-3 py-1 text-sm font-semibold shadow"
              style={{ background: THEME.accent }}
            >
              Ερ. {index + 1} από {QUESTIONS.length}
            </span>
          )}
        </div>
        <div className="mt-2 text-center text-xs uppercase tracking-wide text-slate-300">
          {stageLabel(stage)}
        </div>
        <div className="mt-2 flex items-center justify-center gap-2">
          <button onClick={() => { setShowHowTo(true); }} className="pill bg-white text-black">
            🇬🇷 Οδηγίες
          </button>
        </div>
      </div>
    );
  }

  function StageCard({ children, variant = "default" }) {
    if (variant === "howto") {
      return (
        <div className="surface-howto text-slate-100">
          {children}
        </div>
      );
    }
    return <div className="card">{children}</div>;
  }

// ——— Intro Stage (HowTo-like, text style, points shown correctly) ———
function IntroStage() {
  // helper to format the points badge per category
  const formatPoints = (ptsArr = []) => {
    const pts = [...ptsArr].sort((a, b) => a - b);
    if (pts.length <= 1) return `×${pts[0] ?? 1}`;
    if (pts.length === 2) return `×${pts[0]} / ×${pts[1]}`;
    return `×${pts[0]}–×${pts[pts.length - 1]}`;
  };

  return (
    <StageCard variant="howto">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold">
          Ποδοσφαιρικό Κουίζ — SOLO
        </h1>
        <p className="mt-2 text-slate-300 font-ui">
          Δες τις κατηγορίες και πάτα «Ας παίξουμε» για να ξεκινήσεις.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/40">
        <ul className="divide-y divide-slate-800/60">
          {INTRO_CATEGORIES.map((c) => (
            <li
              key={c.category}
              className="px-4 py-3 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-display text-base font-semibold">
                  {c.category}
                </div>
                {c.count > 1 && (
                  <div className="text-xs text-slate-400 mt-0.5">
                    x{c.count} ερωτήσεις
                  </div>
                )}
              </div>

              {/* show category points, not count */}
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset
                                bg-fuchsia-600/20 text-fuchsia-300 ring-fuchsia-500/30">
                {formatPoints(c.points)}
              </span>
            </li>
          ))}

          {/* Final row — no 'Τελικός' chip, keeps wager range */}
          {finalCategoryName && (
            <li className="px-4 py-3 flex items-center justify-between">
              <div className="min-w-0">
                <div className="font-display text-base font-semibold">
                  Τελική ερώτηση — {finalTopicLabel}
                </div>
                <div className="text-xs text-slate-400 mt-0.5">στοίχημα 0×–3×</div>
              </div>
              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset
                                bg-fuchsia-600/20 text-fuchsia-300 ring-fuchsia-500/30">
                0×–3×
              </span>
            </li>
          )}
        </ul>
      </div>

      <div className="mt-6 flex justify-center">
        <button onClick={next} className="btn btn-accent px-6 py-3 text-base">
          Ας παίξουμε
        </button>
      </div>
    </StageCard>
  );
}

  function CategoryStage() {
    return (
      <StageCard>
        <div className="flex items-center justify-between">
          <div className="text-rose-400 text-4xl">🏆</div>
          <div className="flex items-center gap-2">
            <div className="pill text-white bg-slate-700/70">
              {isFinalIndex ? "Τελικός 0×–3×" : `Κατηγορία ×${q.points || 1}`}
            </div>
          </div>
        </div>
        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-wide font-display">
          {q.category}
        </h2>
        <p className="mt-2 text-center font-ui" style={{ color: THEME.accent }}>
          {isFinalIndex ? "0×–3× Πόντοι" : `x${q.points || 1} Πόντοι`}
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
    // local-only input so typing doesn't thrash global state (prevents focus loss)
    const [inputValue, setInputValue] = useState(() => playerAnswers[index] ?? "");
    // when question index changes, hydrate from saved answer (if any)
    useEffect(() => {
      setInputValue(playerAnswers[index] ?? "");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index]);

    const submitAndReveal = (text) => {
      setPlayerAnswers((prev) => ({ ...prev, [index]: (text ?? "").trim() }));
      setStage(STAGES.ANSWER);
    };

    return (
      <StageCard>
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-slate-700/70 px-3 py-1 text-xs font-semibold">
            {isFinalIndex ? "Τελικός 0×–3×" : `Κατηγορία ×${q.points || 1}`}
          </div>
          {isX2ActiveFor("p1") && !isFinalIndex && (
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

        {/* Answer input + actions */}
        <form
          className="mt-5 flex flex-col items-stretch gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submitAndReveal(inputValue);
          }}
        >
          <input
            className="w-full rounded-xl bg-slate-900/60 px-4 py-3 text-slate-100 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-pink-400"
            placeholder="Γράψε την απάντησή σου…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            autoComplete="off"
            autoCapitalize="sentences"
            spellCheck={false}
          />

          <div className="flex flex-wrap gap-3 justify-center">
            <button type="submit" className="btn btn-accent">
              Υποβολή
            </button>
            <button
              type="button"
              className="btn btn-neutral"
              onClick={() => submitAndReveal("")}
              title="Μετάβαση στην απάντηση χωρίς να δοθεί λύση"
            >
              Δεν γνωρίζω
            </button>
          </div>
        </form>
      </StageCard>
    );
  }

  function AnswerStage() {
    const userAnswer = (playerAnswers && playerAnswers[index]) || "";
    return (
      <StageCard>
        <div className="text-center">
          <div className="font-display text-3xl font-extrabold">
            {q.answer}
          </div>

          {/* Show player's given answer (small, grey) */}
          <div className="mt-2 font-ui text-sm text-slate-400">
            Απάντηση Παίκτη:{" "}
            <span className="italic text-slate-300">
              {userAnswer ? userAnswer : "—"}
            </span>
          </div>

          {q.fact && (
            <div className="mt-2 font-ui text-sm text-slate-300">
              ℹ️ {q.fact}
            </div>
          )}
        </div>

        {/* X2 status reminder */}
        <div className="mt-3 text-center text-xs text-slate-400 font-ui">
          {isX2ActiveFor("p1") && !isFinalIndex && <span>({p1.name}: ×2 ενεργό)</span>}
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
                  disabled={finalResolved.p1}
                  onClick={() => { finalizeOutcomeP1("correct"); next(); }}
                  className="btn text-white disabled:opacity-50"
                  style={{ background: THEME.positiveGrad }}
                >
                  Σωστό +{wager.p1}
                </button>
                <button
                  disabled={finalResolved.p1}
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
          <div className="font-display text-3xl font-extrabold">Αποτελέσματα</div>
          <div className="mt-2 font-ui text-slate-300">
            {p1.name}: {p1.score}
          </div>
          <div className="mt-2 font-ui text-sm text-slate-400">
            Μεγαλύτερο σερί: {p1.maxStreak}
          </div>
        </div>

        {/* Stylish per-question breakdown */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full text-sm font-ui">
            <thead>
              <tr className="text-left text-slate-300">
                <th className="py-2 pr-3">#</th>
                <th className="py-2 pr-3">Κατηγορία</th>
                <th className="py-2 pr-3">Σωστό/Λάθος</th>
                <th className="py-2 pr-3">Πόντοι</th>
                <th className="py-2 pr-3">Σερί</th>
                <th className="py-2 pr-3">×2</th>
                <th className="py-2 pr-3">Απάντηση Παίκτη</th>
                <th className="py-2 pr-3 text-right">+/−</th>
                <th className="py-2 pl-3 text-right">Σύνολο</th>
              </tr>
            </thead>
            <tbody>
              {RESULT_ROWS.map((r) => {
                const isCorrect = r.outcome === "Σωστό";
                const isWrong = r.outcome === "Λάθος";
                return (
                  <tr key={r.idx} className="border-t border-white/10">
                    <td className="py-2 pr-3 text-slate-300">{r.idx}</td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-semibold">{r.category}</span>
                        {!r.isFinal && (
                          <span
                            className="pill text-white"
                            style={{ background: THEME.badgeGradient }}
                            title="Βασικοί πόντοι κατηγορίας"
                          >
                            ×{r.base}
                          </span>
                        )}
                        {r.isFinal && (
                          <span className="pill text-white bg-slate-700/70" title="Τελικός">
                            Τελικός
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-2 pr-3">
                      <span
                        className="pill text-white"
                        style={{
                          background: isCorrect
                            ? THEME.positiveGrad
                            : isWrong
                            ? THEME.negativeGrad
                            : "rgba(148,163,184,0.25)",
                        }}
                      >
                        {r.outcome}
                      </span>
                    </td>

                    <td className="py-2 pr-3 text-slate-300">
                      {!r.isFinal
                        ? `×${r.base}${r.x2Applied ? " → ×" + r.base * 2 : ""}`
                        : "0×–3×"}
                    </td>

                    <td className="py-2 pr-3 text-slate-300">
                      {!r.isFinal ? (r.bonus ? "+1" : "—") : "—"}
                    </td>

                    <td className="py-2 pr-3">
                      {!r.isFinal && r.x2Applied ? (
                        <span
                          className="pill text-white"
                          style={{ background: THEME.badgeGradient }}
                        >
                          ×2
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-2 pr-3">
                      <span className="text-slate-400 italic">
                        {r.userAnswer ? r.userAnswer : "—"}
                      </span>
                    </td>

                    <td className="py-2 pr-3 text-right">
                      <span
                        className={
                          r.delta > 0
                            ? "text-emerald-300 font-semibold"
                            : r.delta < 0
                            ? "text-rose-300 font-semibold"
                            : "text-slate-400"
                        }
                      >
                        {r.delta > 0 ? `+${r.delta}` : r.delta}
                      </span>
                    </td>

                    <td className="py-2 pl-3 text-right text-slate-200 font-semibold">
                      {r.running}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3 font-ui">
          <button onClick={resetGame} className="btn btn-accent">
            Επαναφορά παιχνιδιού
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
          /* no key prop to avoid remount while state changes */
          controls
          preload="metadata"
          playsInline
          className="w-full mt-2"
          src={media.src}
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
          /* no key prop to avoid remount while state changes */
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

        {stage === STAGES.INTRO && <IntroStage />}
        {stage === STAGES.CATEGORY && <CategoryStage />}
        {stage === STAGES.QUESTION && <QuestionStage />}
        {stage === STAGES.ANSWER && <AnswerStage />}

        {/* Score panel (only on gameplay: Category/Question/Answer) */}
        {stage !== STAGES.RESULTS && stage !== STAGES.INTRO && (
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
    case STAGES.INTRO:
      return "Εισαγωγή";
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
              <li><strong>Ροή:</strong> Εισαγωγή → Κατηγορία → Ερώτηση → Απάντηση.</li>
              <li><strong>Χ2:</strong> Όταν εμφανίζεται η Κατηγορία μπορείς να ενεργοποιήσεις το Χ2. Αυτο μπορεί να γίνει <strong>μία φορά</strong> ανά παιχνίδι. Διπλασιάζει μόνο τους πόντους αυτής της ερώτησης.</li>
              <li><strong>Σερί:</strong> Από την <strong>3η συνεχόμενη σωστή</strong> και μετά, παίρνεις έξτρα <strong>+1</strong> (δεν διπλασιάζεται). Το σερί ξεκινά πάλι από την αρχή όταν χαθεί μια ερώτηση.</li>
              <li><strong>Τελική ερώτηση (στοίχημα 0–3):</strong> Πριν εμφανιστεί η τελευταία ερώτηση, διάλεξε πόσους πόντους θα ρισκάρεις (0–3). Αν απαντήσεις σωστά, <strong>κερδίζεις</strong> τόσους πόντους· αν απαντήσεις λάθος ή δεν απαντήσεις, <strong>χάνεις</strong> τους ίδιους πόντους. Αν βάλεις 0, ούτε κερδίζεις ούτε χάνεις. <em>Το Χ2 δεν επιτρέπεται και δεν προστίθεται το bonus του σερί.</em> <span className="block text-slate-400 mt-1 text-[0.95em]">Παράδειγμα: σκορ 15 και στοίχημα 2 → σωστό = 17, λάθος/καμία απάντηση = 13.</span></li>
            </ul>
            <div className="howto-shadow" />
          </div>
        </div>
      </div>
    </div>
  );
}
