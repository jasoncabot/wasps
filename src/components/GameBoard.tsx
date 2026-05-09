import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  cardName,
  CardRank,
  CardSuit,
  changesSuit,
  PlayContext,
  PlayDirection,
  suitName,
  TurnCommand,
  TurnController,
  ViewEventHandler,
  validatePlay,
} from "../scenes/objects";
import { OpponentHand } from "./OpponentHand";
import { PlayerHand } from "./PlayerHand";
import { PlayPile } from "./PlayPile";
import { StatsPanel, HistoryEntry } from "./StatsPanel";
import { HowToPlay } from "./HowToPlay";
import { SuitPicker } from "./SuitPicker";

const WINS_KEY = "wasps-wins-v1";

const PLAYER_COLOURS = ["#60a5fa", "#f87171", "#fbbf24", "#e879f9"];

const loadWins = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(WINS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
};

const saveWins = (wins: Record<string, number>) => {
  try {
    localStorage.setItem(WINS_KEY, JSON.stringify(wins));
  } catch {
    // ignore storage errors
  }
};

const TurnArrow: React.FC<{
  pointLeft: boolean;
  reversing: boolean;
  label: string;
}> = ({ pointLeft, reversing, label }) => (
  <svg
    className={`turn-chevron ${reversing ? "is-reversing" : ""}`}
    viewBox="0 0 8 13"
    width="9"
    height="13"
    aria-label={label}
    role="img"
  >
    <polyline
      points={pointLeft ? "7,1 1,6.5 7,12" : "1,1 7,6.5 1,12"}
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
  </svg>
);

type HandSort = "by-suit" | "by-rank";

const sortHand = (cards: Card[], by: HandSort): Card[] => {
  const out = cards.slice();
  if (by === "by-suit") {
    out.sort((a, b) => (a.suit !== b.suit ? a.suit - b.suit : a.rank - b.rank));
  } else {
    out.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.suit - b.suit));
  }
  return out;
};

export const GameBoard: React.FC = () => {
  const [hands, setHands] = useState<Card[][]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(-1);
  const [context, setContext] = useState<PlayContext | null>(null);
  const [lastPlayed, setLastPlayed] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Card[]>([]);
  const [handSort, setHandSort] = useState<HandSort>("by-suit");
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [hasTurnCallback, setHasTurnCallback] = useState(false);
  const [dirReversing, setDirReversing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [wins, setWins] = useState<Record<string, number>>(() => loadWins());
  const [statsOpen, setStatsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const historyIdRef = useRef(0);
  const prevDirectionRef = useRef<PlayDirection | null>(null);
  const namesRef = useRef<string[]>([]);

  const pushHistory = (text: string, playerIndex: number) => {
    historyIdRef.current += 1;
    const entry: HistoryEntry = { id: historyIdRef.current, text, playerIndex };
    setHistory((prev) => [entry, ...prev]);
  };

  const turnResolveRef = useRef<((turn: TurnCommand) => void) | null>(null);
  const suitResolveRef = useRef<((suit: CardSuit) => void) | null>(null);
  const controllerRef = useRef<TurnController | null>(null);
  const notificationTimeoutRef = useRef<number | undefined>(undefined);
  const contextRef = useRef<PlayContext | null>(null);

  useEffect(() => {
    if (controllerRef.current) return;

    const handler: ViewEventHandler = {
      onCardsDealt: (hand, handCounts, namesArr, ctx) => {
        const initial: Card[][] = handCounts.map((count, i) =>
          i === 0
            ? hand.slice()
            : Array.from({ length: count }, () => ({
                suit: CardSuit.None,
                rank: CardRank.None,
              })),
        );
        setHands(initial);
        setNames(namesArr);
        namesRef.current = namesArr;
        setContext(ctx);
        contextRef.current = ctx;
        setLastPlayed([ctx.lastCard]);
        setSelected([]);
        setHistory([]);
        historyIdRef.current = 0;
      },
      onTurnStarted: (rel, _relNext, aiTurn) => {
        setCurrentPlayer(rel);
        return new Promise<TurnCommand>((resolve) => {
          if (rel === 0) {
            turnResolveRef.current = resolve;
            setHasTurnCallback(true);
          } else {
            aiTurn.then(resolve);
          }
        });
      },
      onTurnEnded: (rel, hand, turn) => {
        // Game.applyTurn mutates the hand in place on pickup, so we must
        // copy here to give React a fresh reference and trigger re-render.
        setHands((prev) => {
          const next = prev.slice();
          next[rel] = hand.slice();
          return next;
        });
        if (turn.played.length > 0) {
          setLastPlayed(turn.played.slice());
        }

        const name = namesRef.current[rel] ?? "Player";
        if (turn.pickup.length > 0) {
          const n = turn.pickup.length;
          pushHistory(`${name} picked up ${n} card${n === 1 ? "" : "s"}`, rel);
        } else if (turn.played.length > 0) {
          const cards = turn.played.map((c) => cardName(c)).join(", ");
          let text = `${name} played ${cards}`;
          if (turn.suit !== CardSuit.None) {
            text += ` (chose ${suitName(turn.suit)})`;
          }
          if (turn.directionChanged) {
            text += " · direction reversed";
          }
          pushHistory(text, rel);
        }
      },
      onContextUpdated: (ctx) => {
        setContext(ctx);
        contextRef.current = ctx;
      },
      onGameOver: (player) => {
        const winnerIndex = namesRef.current.indexOf(player.name);
        pushHistory(
          `${player.name} won the game`,
          winnerIndex >= 0 ? winnerIndex : 0,
        );
        setWins((prev) => {
          const next = { ...prev, [player.name]: (prev[player.name] ?? 0) + 1 };
          saveWins(next);
          return next;
        });
        setNotification(
          `${player.name} wins! Starting new game in 5 seconds...`,
        );
        if (notificationTimeoutRef.current)
          window.clearTimeout(notificationTimeoutRef.current);
        notificationTimeoutRef.current = window.setTimeout(
          () => setNotification(null),
          4000,
        );
        setTimeout(() => {
          setSelected([]);
          controllerRef.current?.startGame();
        }, 5000);
      },
    };

    controllerRef.current = new TurnController(
      { me: { name: "You" } },
      handler,
    );
    controllerRef.current.startGame();
  }, [setHasTurnCallback]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    if (notificationTimeoutRef.current)
      window.clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = window.setTimeout(
      () => setNotification(null),
      4000,
    );
  };

  const isMyTurn = currentPlayer === 0 && hasTurnCallback;
  const disabled = !isMyTurn || suitPickerOpen;

  const myHand = useMemo(() => hands[0] ?? [], [hands]);
  const sortedHand = useMemo(
    () => sortHand(myHand, handSort),
    [myHand, handSort],
  );

  const onSelect = (card: Card) => {
    if (disabled) return;
    setSelected((prev) =>
      prev.includes(card) ? prev.filter((c) => c !== card) : [...prev, card],
    );
  };

  const onDrawClick = () => {
    if (!isMyTurn || suitPickerOpen) return;
    if (!turnResolveRef.current) return;
    turnResolveRef.current({
      pickup: true,
      played: [],
      suit: CardSuit.None,
    });
    turnResolveRef.current = null;
    setHasTurnCallback(false);
    setSelected([]);
  };

  const onDiscardClick = async () => {
    if (!isMyTurn || suitPickerOpen) return;
    if (!turnResolveRef.current) return;
    if (selected.length === 0) {
      showNotification("Select a card to play, or tap the draw pile.");
      return;
    }
    const ctx = contextRef.current;
    if (!ctx) return;
    const errors = validatePlay(selected, ctx);
    if (errors.length > 0) {
      showNotification(errors.join("\n"));
      return;
    }
    const top = selected[selected.length - 1];
    let suit = CardSuit.None;
    if (changesSuit(top)) {
      setSuitPickerOpen(true);
      suit = await new Promise<CardSuit>((resolve) => {
        suitResolveRef.current = resolve;
      });
      setSuitPickerOpen(false);
    }
    const resolve = turnResolveRef.current;
    if (!resolve) return;
    turnResolveRef.current = null;
    setHasTurnCallback(false);
    resolve({ pickup: false, played: selected, suit });
    setSelected([]);
  };

  const onChooseSuit = (suit: CardSuit) => {
    if (suitResolveRef.current) {
      const resolve = suitResolveRef.current;
      suitResolveRef.current = null;
      resolve(suit);
    }
  };

  const direction = context?.direction ?? PlayDirection.Clockwise;

  useEffect(() => {
    if (prevDirectionRef.current === null) {
      prevDirectionRef.current = direction;
      return;
    }
    if (prevDirectionRef.current !== direction) {
      prevDirectionRef.current = direction;
      setDirReversing(true);
      const t = window.setTimeout(() => setDirReversing(false), 700);
      return () => window.clearTimeout(t);
    }
  }, [direction]);

  const toggleSort = () =>
    setHandSort((s) => (s === "by-suit" ? "by-rank" : "by-suit"));

  if (names.length === 0) {
    return <div className="loading">Dealing cards…</div>;
  }

  return (
    <div className="game-board">
      {/* Opponent positions (relative): 1=left, 2=top, 3=right */}
      {names[2] !== undefined && (
        <OpponentHand
          position="top"
          count={hands[2]?.length ?? 0}
          name={names[2]}
          isCurrent={currentPlayer === 2}
          color={PLAYER_COLOURS[2]}
        />
      )}
      {names[1] !== undefined && (
        <OpponentHand
          position="left"
          count={hands[1]?.length ?? 0}
          name={names[1]}
          isCurrent={currentPlayer === 1}
          color={PLAYER_COLOURS[1]}
        />
      )}
      {names[3] !== undefined && (
        <OpponentHand
          position="right"
          count={hands[3]?.length ?? 0}
          name={names[3]}
          isCurrent={currentPlayer === 3}
          color={PLAYER_COLOURS[3]}
        />
      )}

      <PlayPile
        played={lastPlayed}
        pickupCount={context?.numberToPickup ?? 0}
        forcedSuit={context?.suit ?? CardSuit.None}
        onDrawClick={onDrawClick}
        onDiscardClick={onDiscardClick}
      />

      {/* My player chrome */}
      <div className={`my-info ${currentPlayer === 0 ? "is-current" : ""}`}>
        {direction === PlayDirection.Clockwise && (
          <TurnArrow
            pointLeft
            reversing={dirReversing}
            label="Play going left"
          />
        )}
        <span className="my-name" style={{ color: PLAYER_COLOURS[0] }}>
          {names[0]}
        </span>
        <span className="my-count" style={{ color: PLAYER_COLOURS[0] }}>
          {myHand.length}
        </span>
        {direction === PlayDirection.AntiClockwise && (
          <TurnArrow
            pointLeft={false}
            reversing={dirReversing}
            label="Play going right"
          />
        )}
      </div>

      <button
        className="btn-icon sort-button"
        onClick={toggleSort}
        title={handSort === "by-suit" ? "Sort by rank" : "Sort by suit"}
        aria-label={handSort === "by-suit" ? "Sort by rank" : "Sort by suit"}
      >
        {handSort === "by-suit" ? "♠♥" : "1·2"}
      </button>

      <button
        className="btn-icon stats-button"
        onClick={() => setStatsOpen((s) => !s)}
        title="Stats and history"
        aria-label="Stats and history"
      >
        ☰
      </button>

      <StatsPanel
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        names={names}
        wins={wins}
        history={history}
        playerColours={PLAYER_COLOURS}
      />

      <button
        className="btn-icon help-button"
        onClick={() => setHelpOpen((s) => !s)}
        title="How to play"
        aria-label="How to play"
      >
        ?
      </button>

      <HowToPlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      {selected.length > 0 && isMyTurn && (
        <div className="play-bar">
          <button className="btn-primary" onClick={onDiscardClick}>
            Play {selected.length > 1 ? `${selected.length} cards` : "card"}
          </button>
        </div>
      )}

      <PlayerHand
        cards={sortedHand}
        selected={selected}
        onSelect={onSelect}
        disabled={disabled}
      />

      <SuitPicker open={suitPickerOpen} onChoose={onChooseSuit} />

      {notification && (
        <div className="toast" role="status">
          {notification}
        </div>
      )}
    </div>
  );
};
