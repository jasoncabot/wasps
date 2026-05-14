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
import { PlayerHand, cardKey as cardKeyFor } from "./PlayerHand";
import { PlayPile } from "./PlayPile";
import { StatsPanel, HistoryEntry } from "./StatsPanel";
import { HowToPlay } from "./HowToPlay";
import { SuitPicker } from "./SuitPicker";
import { FlyingCardsLayer, FlyingCardsHandle } from "./FlyingCardsLayer";

const PLAY_DURATION_MS = 250;
const PICKUP_DURATION_MS = 280;
const STAGGER_MS = 80;

const OPPONENT_POSITIONS: Record<number, "left" | "top" | "right"> = {
  1: "left",
  2: "top",
  3: "right",
};

const HAND_BASE_ROTATION: Record<number, number> = {
  0: 0,
  1: 90,
  2: 180,
  3: -90,
};

const rectCenter = (r: DOMRect | undefined) =>
  r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;

const queryRect = (selector: string): DOMRect | undefined =>
  (document.querySelector(selector) as HTMLElement | null)?.getBoundingClientRect();

const opponentFanRect = (rel: number) => {
  const pos = OPPONENT_POSITIONS[rel];
  if (!pos) return undefined;
  return queryRect(`.opponent-${pos} .opponent-fan`);
};

const handRectFor = (rel: number) =>
  rel === 0 ? queryRect(".player-hand") : opponentFanRect(rel);

const randJitter = (range: number) => (Math.random() - 0.5) * 2 * range;

const WINS_KEY = "wasps-wins-v1";

const PLAYER_COLOURS = ["#60a5fa", "#f87171", "#fbbf24", "#e879f9"];
const NAME_IDLE_COLOUR = "#9ca3af";

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
  const flyingRef = useRef<FlyingCardsHandle | null>(null);
  // Per-card source rects for the human's just-played cards, snapshotted
  // before the React state update removes them from the hand.
  const myPlayedRectsRef = useRef<DOMRect[]>([]);
  // Cards currently flying in to the human's hand — render hidden so the
  // landing flying card doesn't overlap a static visible card underneath.
  const [incomingMine, setIncomingMine] = useState<Set<Card>>(() => new Set());
  // Per-opponent count of face-down cards still in flight to that hand.
  const [incomingOpp, setIncomingOpp] = useState<number[]>([0, 0, 0, 0]);
  // While true, the discard pile collapses its fan onto the top card so the
  // incoming flying card hides the swap when the play state updates.
  const [discardCollapsed, setDiscardCollapsed] = useState(false);

  const adjustOppIncoming = (rel: number, delta: number) => {
    setIncomingOpp((prev) => {
      const next = prev.slice();
      next[rel] = Math.max(0, (next[rel] ?? 0) + delta);
      return next;
    });
  };

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
            aiTurn.then(resolve, (err) => {
              console.error("AI turn failed", err);
              showNotification(
                `AI hit an error and had to draw. (${err?.message ?? err})`,
              );
              resolve({
                pickup: true,
                played: [],
                suit: CardSuit.None,
              });
            });
          }
        });
      },
      onTurnEnded: (rel, hand, turn) => {
        const name = namesRef.current[rel] ?? "Player";

        const commitState = () => {
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
        };

        if (turn.played.length > 0) {
          const discard = rectCenter(queryRect(".pile-discard"));
          const flyer = flyingRef.current;
          const fanCenter = rectCenter(handRectFor(rel));
          const myRects = rel === 0 ? myPlayedRectsRef.current : [];
          myPlayedRectsRef.current = [];
          if (discard && flyer) {
            const fromRot = HAND_BASE_ROTATION[rel] ?? 0;
            // Drop the played cards from the hand immediately so they appear
            // to lift off; keep the discard pile showing the previous top
            // until the new card lands.
            setHands((prev) => {
              const next = prev.slice();
              next[rel] = hand.slice();
              return next;
            });
            // Collapse the existing discard fan onto the top card so the
            // about-to-land flying card hides the swap when state updates.
            setDiscardCollapsed(true);
            const collapseDelay = 140;
            // All cards fly to the discard centre and stack there; once
            // they've all landed we swap in the static fan (still collapsed)
            // and let CSS transition them out into the fan smoothly.
            const promises = turn.played.map((card, i) => {
              let fromX = fanCenter?.x ?? discard.x;
              let fromY = fanCenter?.y ?? discard.y;
              if (rel === 0 && myRects[i]) {
                const r = myRects[i];
                fromX = r.left + r.width / 2;
                fromY = r.top + r.height / 2;
              }
              return flyer.fly({
                card,
                fromX,
                fromY,
                fromRot,
                toX: discard.x,
                toY: discard.y,
                toRot: 0,
                startFaceDown: rel !== 0,
                endFaceDown: false,
                duration: PLAY_DURATION_MS,
                delay: collapseDelay + i * STAGGER_MS,
                startScale: rel === 0 ? 1 : 0.65,
                endScale: 1,
                // Keep flying cards above hand/pile during the fly; persist
                // them after land so the static fan can mount underneath
                // before they're cleared (no flicker on swap).
                zIndex: 400 + i,
                persistAfterLand: true,
              });
            });
            Promise.all(promises).then(() => {
              // Mount the new discard fan in collapsed (stacked) positions,
              // hidden behind the persisted flying cards at the same spot.
              setLastPlayed(turn.played.slice());
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  flyer.clearPersisted();
                  setDiscardCollapsed(false);
                });
              });
            });
          } else {
            commitState();
          }
        } else if (turn.pickup.length > 0) {
          const draw = rectCenter(queryRect(".pile-draw"));
          const flyer = flyingRef.current;
          if (draw && flyer) {
            // Apply state immediately so the new cards exist in the DOM and
            // we can target each card's actual final slot. Mark them as
            // incoming so they render hidden until their flight lands.
            if (rel === 0) {
              setIncomingMine((prev) => {
                const next = new Set(prev);
                turn.pickup.forEach((c) => next.add(c));
                return next;
              });
              setHands((prev) => {
                const next = prev.slice();
                next[rel] = hand.slice();
                return next;
              });
              // Wait for layout, then read each card's RESTING position from
              // the slot's inline styles. We can't use getBoundingClientRect
              // here: .player-hand-slot has a 240ms transition on left/bottom
              // (existing slots shift to make room), so the measured rect is
              // mid-transition. Inline styles are the React-committed final
              // values, immune to the running animation.
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const baseRot = HAND_BASE_ROTATION[rel] ?? 0;
                  const handEl = document.querySelector<HTMLElement>(
                    ".player-hand",
                  );
                  const handRect = handEl?.getBoundingClientRect();
                  turn.pickup.forEach((card, i) => {
                    const slot = document.querySelector<HTMLElement>(
                      `.player-hand .player-hand-slot[data-card-key="${cardKeyFor(card)}"]`,
                    );
                    let toX = draw.x;
                    let toY = draw.y;
                    let slotRot = 0;
                    if (slot && handRect) {
                      const slotLeft = parseFloat(slot.style.left) || 0;
                      const slotBottom = parseFloat(slot.style.bottom) || 0;
                      const w = slot.offsetWidth;
                      const h = slot.offsetHeight;
                      toX = handRect.left + slotLeft + w / 2;
                      toY = handRect.bottom - slotBottom - h / 2;
                      const m = /rotate\(([-\d.]+)deg\)/.exec(
                        slot.style.transform,
                      );
                      if (m) slotRot = parseFloat(m[1]);
                    }
                    flyer
                      .fly({
                        card,
                        fromX: draw.x,
                        fromY: draw.y,
                        fromRot: 0,
                        toX,
                        toY,
                        toRot: baseRot + slotRot,
                        startFaceDown: true,
                        endFaceDown: false,
                        duration: PICKUP_DURATION_MS,
                        delay: i * STAGGER_MS,
                        zIndex: parseInt(slot?.style.zIndex ?? "0") || undefined,
                      })
                      .then(() => {
                        setIncomingMine((prev) => {
                          if (!prev.has(card)) return prev;
                          const next = new Set(prev);
                          next.delete(card);
                          return next;
                        });
                      });
                  });
                });
              });
            } else {
              // Opponents: render with N fewer face-down cards in the fan
              // while the flights are in progress, then reveal one per land.
              const baseRot = HAND_BASE_ROTATION[rel] ?? 0;
              const n = turn.pickup.length;
              adjustOppIncoming(rel, n);
              setHands((prev) => {
                const next = prev.slice();
                next[rel] = hand.slice();
                return next;
              });
              const dest = rectCenter(handRectFor(rel)) ?? draw;
              for (let i = 0; i < n; i++) {
                flyer
                  .fly({
                    fromX: draw.x,
                    fromY: draw.y,
                    fromRot: 0,
                    toX: dest.x + randJitter(8),
                    toY: dest.y + randJitter(6),
                    toRot: baseRot + randJitter(4),
                    startFaceDown: true,
                    endFaceDown: true,
                    duration: PICKUP_DURATION_MS,
                    delay: i * STAGGER_MS,
                    // Match the smaller, scaled fan cards on landing so
                    // the flying card doesn't dwarf the actual hand.
                    startScale: 1,
                    endScale: 0.65,
                    zIndex: 400 + i,
                  })
                  .then(() => adjustOppIncoming(rel, -1));
              }
            }
          } else {
            commitState();
          }
        } else {
          commitState();
        }

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
          `${player.name} ${player.name === "You" ? "win" : "wins"}! Starting new game in 5 seconds...`,
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
    // Snapshot the on-screen position of each played card before React
    // re-renders the hand without them, so the flying-cards layer can
    // animate from the right slot.
    const cardEls = document.querySelectorAll<HTMLElement>(
      ".player-hand .card",
    );
    myPlayedRectsRef.current = selected.map((card) => {
      const idx = sortedHand.indexOf(card);
      const el = idx >= 0 ? cardEls[idx] : null;
      return el ? el.getBoundingClientRect() : (undefined as unknown as DOMRect);
    });
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
          idleColor={NAME_IDLE_COLOUR}
          incomingCount={incomingOpp[2] ?? 0}
        />
      )}
      {names[1] !== undefined && (
        <OpponentHand
          position="left"
          count={hands[1]?.length ?? 0}
          name={names[1]}
          isCurrent={currentPlayer === 1}
          color={PLAYER_COLOURS[1]}
          idleColor={NAME_IDLE_COLOUR}
          incomingCount={incomingOpp[1] ?? 0}
        />
      )}
      {names[3] !== undefined && (
        <OpponentHand
          position="right"
          count={hands[3]?.length ?? 0}
          name={names[3]}
          isCurrent={currentPlayer === 3}
          color={PLAYER_COLOURS[3]}
          idleColor={NAME_IDLE_COLOUR}
          incomingCount={incomingOpp[3] ?? 0}
        />
      )}

      <PlayPile
        played={lastPlayed}
        pickupCount={context?.numberToPickup ?? 0}
        forcedSuit={context?.suit ?? CardSuit.None}
        onDrawClick={onDrawClick}
        onDiscardClick={onDiscardClick}
        collapsed={discardCollapsed}
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
        <span
          className="my-name"
          style={{
            color:
              currentPlayer === 0 ? PLAYER_COLOURS[0] : NAME_IDLE_COLOUR,
          }}
        >
          {names[0]}
        </span>
        <span
          className="my-count"
          style={{
            color:
              currentPlayer === 0 ? PLAYER_COLOURS[0] : NAME_IDLE_COLOUR,
          }}
        >
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
        incoming={incomingMine}
      />

      <SuitPicker open={suitPickerOpen} onChoose={onChooseSuit} />

      <FlyingCardsLayer ref={flyingRef} />

      {notification && (
        <div className="toast" role="status">
          {notification}
        </div>
      )}
    </div>
  );
};
