import React from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const HowToPlay: React.FC<Props> = ({ open, onClose }) => {
  return (
    <>
      <div
        className={`stats-scrim ${open ? "is-open" : ""}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside
        className={`how-to-play-panel ${open ? "is-open" : ""}`}
        role="dialog"
        aria-label="How to play"
        aria-hidden={!open}
      >
        <div className="stats-header">
          <h2>How to Play</h2>
          <button
            className="stats-close"
            onClick={onClose}
            aria-label="Close how to play"
          >
            ×
          </button>
        </div>

        <div className="how-to-play-body">
          <section className="stats-section">
            <h3>Goal</h3>
            <p className="htp-goal">Be the first to play all your cards.</p>
          </section>

          <section className="stats-section">
            <h3>Basics</h3>
            <ul className="htp-list">
              <li>
                Each player is dealt <strong>7 cards</strong>
              </li>
              <li>
                Play a card matching the <strong>suit or rank</strong> of the
                top card
              </li>
              <li>
                Can't play? <strong>Draw</strong> from the pile
              </li>
              <li>
                Play goes <strong>clockwise</strong> by default
              </li>
            </ul>
          </section>

          <section className="stats-section">
            <h3>Playing multiple cards</h3>
            <ul className="htp-list">
              <li>
                Same <strong>rank</strong> — play as many as you like
              </li>
              <li>
                Same <strong>suit in a run</strong> — e.g. 4♠ 5♠ 6♠
              </li>
            </ul>
          </section>

          <section className="stats-section">
            <h3>Special cards</h3>
            <ul className="htp-special">
              <li>
                <span className="htp-card">A</span>
                <span>Play on anything · choose next suit</span>
              </li>
              <li>
                <span className="htp-card htp-card-danger">2</span>
                <span>
                  Next player picks up <strong>2</strong> · stackable
                </span>
              </li>
              <li>
                <span className="htp-card htp-card-danger">J♣♠</span>
                <span>
                  Next player picks up <strong>7</strong> · stackable
                </span>
              </li>
              <li>
                <span className="htp-card htp-card-safe">J♥♦</span>
                <span>Cancels a Black Jack</span>
              </li>
              <li>
                <span className="htp-card htp-card-warn">Q</span>
                <span>
                  Reverses direction · odd count reverses, even cancels
                </span>
              </li>
              <li>
                <span className="htp-card htp-card-danger">🃏</span>
                <span>
                  Play on anything · next player picks up <strong>4</strong> ·
                  choose suit · stackable
                </span>
              </li>
            </ul>
          </section>

          <section className="stats-section">
            <h3>Stacking</h3>
            <ul className="htp-list">
              <li>
                Four <strong>2s</strong> → pick up 8
              </li>
              <li>
                Two <strong>Black Jacks</strong> → pick up 14
              </li>
              <li>
                Two <strong>Jokers</strong> → pick up 8
              </li>
              <li>
                Multiple <strong>Aces</strong> → one suit choice
              </li>
            </ul>
          </section>
        </div>
      </aside>
    </>
  );
};
