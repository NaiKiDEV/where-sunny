import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { SCORE_FACTORS } from "../../core/scoring/model";
import { SCORE_PART_META } from "../panel/scoreParts";
import { useAppStore } from "../../state/store";

/** Longest lever, so every bar reads as a share of the strongest factor. */
const MAX_INFLUENCE = Math.max(
  ...SCORE_FACTORS.map((factor) => factor.influence),
);

/**
 * The "how the Sunny Score works" screen: a transparent, plain-language tour of
 * the exact formula. Everything it shows is derived from the scoring weights
 * (see core/scoring/model), so it always matches the number on every card.
 */
export function ScoreInfoSheet() {
  const isOpen = useAppStore((s) => s.scoreInfoOpen);
  const close = useAppStore((s) => s.closeScoreInfo);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close]);

  if (!isOpen) return null;

  // Portal to <body> so the modal escapes the .app stacking context (.app is
  // position:fixed, which traps its children's z-index). On mobile the results
  // panel is a vaul drawer portaled to <body> at --z-panel; only by sharing that
  // top-level context can this backdrop's --z-overlay actually paint above it.
  return createPortal(
    <div className="score-info-backdrop" onClick={close}>
      <div
        className="score-info-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="How the Sunny Score works"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="score-info-head">
          <h2 className="score-info-title">How the Sunny Score works</h2>
          <button
            type="button"
            className="score-info-close"
            aria-label="Close"
            onClick={close}
          >
            <X size={18} strokeWidth={2} aria-hidden />
          </button>
        </header>

        <p className="score-info-lede">
          Every place gets one number from 0 to 100 for each day - our honest
          guess at how bright and pleasant it will feel. It is a plain formula,
          not a black box. Here is exactly what goes into it.
        </p>

        <ol className="score-info-factors">
          {SCORE_FACTORS.map((factor) => {
            const meta = SCORE_PART_META[factor.id];
            const isBoost = factor.direction === "boost";
            const width = Math.round((factor.influence / MAX_INFLUENCE) * 100);
            return (
              <li key={factor.id} className="score-info-factor">
                <span className="score-info-factor-icon" aria-hidden>
                  <meta.Icon size={18} strokeWidth={2} />
                </span>
                <div className="score-info-factor-body">
                  <div className="score-info-factor-head">
                    <span className="score-info-factor-label">
                      {meta.label}
                    </span>
                    <span
                      className={`score-info-factor-tag${isBoost ? "" : " is-penalty"}`}
                    >
                      {isBoost ? "adds up to" : "subtracts up to"}{" "}
                      {isBoost ? "+" : "-"}
                      {factor.influence}
                    </span>
                  </div>
                  <span className="breakdown-track score-info-factor-track">
                    <span
                      className={`breakdown-bar ${meta.barClass}`}
                      style={{ width: `${width}%` }}
                    />
                  </span>
                  <p className="score-info-factor-blurb">{factor.blurb}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <section className="score-info-note">
          <p className="score-info-note-title">How it adds up</p>
          <p>
            Sunshine and warmth are the two things that lift a score; a flawless
            day of full sun and ideal temperature reaches a perfect 100. Rain,
            wind, and cloud are then subtracted from that. If the penalties ever
            outweigh the good, the score simply floors at 0 - it never goes
            negative.
          </p>
        </section>

        <section className="score-info-note">
          <p className="score-info-note-title">The dial you control</p>
          <p>
            Warmth is scored against <em>your</em> comfortable-temperature band.
            Change it under the gear menu (or switch to "Any temp" to rank on
            sun alone) and every score re-ranks instantly - no waiting on new
            forecasts.
          </p>
        </section>

        <p className="score-info-source">
          Forecasts come from Open-Meteo. When a reading is missing, that factor
          is left neutral rather than guessed at - no day is ever punished for a
          gap in the data.
        </p>
      </div>
    </div>,
    document.body,
  );
}
