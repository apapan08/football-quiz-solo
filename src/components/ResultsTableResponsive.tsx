import React from "react";

/**
 * ResultsTableResponsive
 * - Mobile: stacked cards (no horizontal scroll)
 * - Desktop/Tablet: table inside a safe horizontal scroller
 *
 * Props:
 *  rows: array of per-question results
 *  title: heading text (e.g., "Αποτελέσματα")
 *  playerName: current player label under the title
 *  maxStreak: largest streak number to show
 *  onReset: handler for "Play again / Επαναφορά παιχνιδιού"
 *  lang: 'el' | 'en'
 */
export type ResultRow = {
  i: number;                         // 1-based question index
  category: string;                  // category label
  points: number;                    // q.points
  isFinal?: boolean;                 // last question?
  correct?: boolean | null;          // true/false; null = draw/no answer
  x2?: boolean;                      // X2 applied this question
  // Prefer showing the player's typed answer. (Kept answerSide for future 2P mode)
  answerText?: string | null;        // player's typed answer
  answerSide?: "p1" | "p2" | null;   // who got awarded (if you ever need it)
  delta: number;                     // +/- change from this question
  total: number;                     // running total after this question
  // We show streak **bonus points** (e.g., +1 from 3rd correct), not the raw count.
  streakPoints?: number;             // 1 when bonus applied, else 0/undefined
};

type Props = {
  rows: ResultRow[];
  title?: string;
  playerName?: string;
  maxStreak?: number;
  onReset?: () => void;
  lang?: "el" | "en";
};

const STR = {
  el: {
    results: "Αποτελέσματα",
    player: "Παίκτης",
    maxStreak: "Μεγαλύτερο σερί",
    category: "Κατηγορία",
    correct: "Σωστό",
    wrong: "Λάθος",
    final: "Τελικός",
    points: "Πόντοι",
    streak: "Σερί", // show bonus points
    x2: "×2",
    answerSide: "Απάντηση Παίκτη",
    delta: "+/−",
    total: "Σύνολο",
    playAgain: "Επαναφορά παιχνιδιού",
    draw: "Ισοπαλία / Καμία απάντηση",
  },
  en: {
    results: "Results",
    player: "Player",
    maxStreak: "Longest streak",
    category: "Category",
    correct: "Correct",
    wrong: "Wrong",
    final: "Final",
    points: "Points",
    streak: "Streak bonus",
    x2: "×2",
    answerSide: "Player Answer",
    delta: "+/−",
    total: "Total",
    playAgain: "Play again",
    draw: "Draw / No answer",
  },
};

export default function ResultsTableResponsive({
  rows,
  title,
  playerName,
  maxStreak,
  onReset,
  lang = "el",
}: Props) {
  const t = STR[lang];

  return (
    <div className="card">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-display text-3xl font-extrabold">
          {title || t.results}
        </h2>
        {playerName && (
          <div className="mt-1 text-slate-300">
            {t.player}: <span className="font-semibold">{playerName}</span>
          </div>
        )}
        {typeof maxStreak === "number" && (
          <div className="text-slate-400 text-sm">
            {t.maxStreak}: {maxStreak}
          </div>
        )}
      </div>

      {/* Mobile stacked list */}
      <ul className="sm:hidden mt-4 grid gap-2">
        {rows.map((r) => (
          <li key={r.i} className="card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-slate-400">#{r.i}</div>
                <div className="font-semibold truncate">
                  {r.category}{" "}
                  {r.isFinal && (
                    <span className="ml-1 align-middle pill bg-white/10 text-[11px]">
                      {t.final}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold tabular-nums">{r.total}</div>
                <div className="text-xs text-slate-400 tabular-nums">
                  {r.delta >= 0 ? `+${r.delta}` : r.delta}
                </div>
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1">
              {/* Status: always show correct/wrong/draw, even for final */}
              {r.correct === true ? (
                <span className="pill bg-emerald-500 text-white">{t.correct}</span>
              ) : r.correct === false ? (
                <span className="pill bg-rose-500 text-white">{t.wrong}</span>
              ) : (
                <span className="pill bg-slate-600/70">{t.draw}</span>
              )}

              <span className="whitespace-nowrap">×{r.points}</span>
              <span className="whitespace-nowrap">
                {t.streak}: {r.streakPoints ? `+${r.streakPoints}` : "—"}
              </span>
              {r.x2 && (
                <span className="pill bg-fuchsia-500 text-white">{t.x2}</span>
              )}

              {/* Player answer (trimmed) */}
              <span className="ml-auto max-w-[45%] truncate italic text-slate-400">
                {r.answerText && r.answerText.trim().length > 0 ? r.answerText : "—"}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop / Tablet table */}
      <div className="hidden sm:block mt-4 -mx-4 sm:mx-0 pb-[env(safe-area-inset-bottom)]">
        <div className="overflow-x-auto overscroll-contain results-scroll [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[780px] w-full table-fixed text-[13px] sm:text-sm leading-tight">
            <thead>
              <tr className="[&>th]:px-2 [&>th]:py-2 sm:[&>th]:px-3 sm:[&>th]:py-3 text-left text-slate-300">
                <th className="w-8 tabular-nums">#</th>
                <th className="w-[44%]">{t.category}</th>
                <th className="w-28">{`${t.correct}/${t.wrong}`}</th>
                <th className="w-16">{t.points}</th>
                <th className="w-16">{t.streak}</th>
                <th className="w-12">{t.x2}</th>
                <th className="w-40">{t.answerSide}</th>
                <th className="w-16 tabular-nums">{t.delta}</th>
                <th className="w-16 tabular-nums">{t.total}</th>
              </tr>
            </thead>
            <tbody className="[&>tr>td]:px-2 [&>tr>td]:py-2 sm:[&>tr>td]:px-3 sm:[&>tr>td]:py-3">
              {rows.map((r) => (
                <tr key={r.i} className="border-t border-white/5">
                  <td className="tabular-nums text-right">{r.i}</td>

                  <td className="max-w-[280px] truncate" title={r.category}>
                    {r.category}
                    <span className="ml-2 align-middle pill bg-white/10 text-[11px]">
                      {r.isFinal ? t.final : `×${r.points}`}
                    </span>
                  </td>

                  {/* Status: correct / wrong / draw (show for final too) */}
                  <td className="whitespace-nowrap">
                    {r.correct === true ? (
                      <span className="pill bg-emerald-500 text-white">{t.correct}</span>
                    ) : r.correct === false ? (
                      <span className="pill bg-rose-500 text-white">{t.wrong}</span>
                    ) : (
                      <span className="pill bg-slate-600/70">{t.draw}</span>
                    )}
                  </td>

                  <td className="whitespace-nowrap">
                    {r.isFinal ? "0×–3×" : `×${r.points}`}
                  </td>

                  {/* Show streak bonus points (+1 or —), not streak count */}
                  <td className="whitespace-nowrap tabular-nums">
                    {r.isFinal ? "—" : r.streakPoints ? `+${r.streakPoints}` : "—"}
                  </td>

                  <td>{r.x2 ? "×2" : "—"}</td>

                  {/* Player's typed answer */}
                  <td className="max-w-[220px] truncate italic text-slate-300">
                    {r.answerText && r.answerText.trim().length > 0 ? r.answerText : "—"}
                  </td>

                  <td className="tabular-nums">
                    {r.delta >= 0 ? `+${r.delta}` : r.delta}
                  </td>
                  <td className="font-bold tabular-nums">{r.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer action */}
      {onReset && (
        <div className="mt-6 flex justify-center">
          <button className="btn btn-accent" onClick={onReset}>
            {t.playAgain}
          </button>
        </div>
      )}
    </div>
  );
}
