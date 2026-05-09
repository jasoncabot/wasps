import React from "react";

export interface HistoryEntry {
  id: number;
  text: string;
  playerIndex: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  names: string[];
  wins: Record<string, number>;
  history: HistoryEntry[];
  playerColours: string[];
}

export const StatsPanel: React.FC<Props> = ({
  open,
  onClose,
  names,
  wins,
  history,
  playerColours,
}) => {
  return (
    <>
      <div
        className={`stats-scrim ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`stats-panel ${open ? "is-open" : ""}`}
        role="dialog"
        aria-label="Game stats and history"
        aria-hidden={!open}
      >
        <div className="stats-header">
          <h2>Stats</h2>
          <button
            className="stats-close"
            onClick={onClose}
            aria-label="Close stats panel"
          >
            ×
          </button>
        </div>

        <section className="stats-section">
          <h3>Wins</h3>
          <ul className="stats-wins">
            {names.map((name, i) => (
              <li key={name}>
                <span
                  className="stats-name"
                  style={{ color: playerColours[i] }}
                >
                  {name}
                </span>
                <span className="stats-win-count">{wins[name] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="stats-section stats-section-history">
          <h3>This game</h3>
          {history.length === 0 ? (
            <p className="stats-empty">No moves yet.</p>
          ) : (
            <ul className="stats-history">
              {history.map((e) => (
                <li
                  key={e.id}
                  style={{
                    backgroundColor: `color-mix(in srgb, ${playerColours[e.playerIndex] ?? "#fff"} 18%, transparent)`,
                  }}
                >
                  {e.text}
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </>
  );
};
