import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardRank,
  CardSuit,
  changesSuit,
  PlayContext,
  PlayDirection,
  Player,
  TurnCommand,
  TurnController,
  TurnEvent,
  ViewEventHandler,
  validatePlay,
} from "../scenes/objects";
import { DirectionIndicator } from "./DirectionIndicator";
import { OpponentHand } from "./OpponentHand";
import { PlayerHand } from "./PlayerHand";
import { PlayPile } from "./PlayPile";
import { SuitPicker } from "./SuitPicker";

type HandSort = "by-suit" | "by-rank";

const sortHand = (cards: Card[], by: HandSort): Card[] => {
  const out = cards.slice();
  if (by === "by-suit") {
    out.sort((a, b) =>
      a.suit !== b.suit ? a.suit - b.suit : a.rank - b.rank,
    );
  } else {
    out.sort((a, b) =>
      a.rank !== b.rank ? a.rank - b.rank : a.suit - b.suit,
    );
  }
  return out;
};

export const GameBoard: React.FC = () => {
  const [hands, setHands] = useState<Card[][]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState(-1);
  const [nextPlayer, setNextPlayer] = useState(-1);
  const [context, setContext] = useState<PlayContext | null>(null);
  const [lastPlayed, setLastPlayed] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Card[]>([]);
  const [handSort, setHandSort] = useState<HandSort>("by-suit");
  const [suitPickerOpen, setSuitPickerOpen] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const turnResolveRef = useRef<((turn: TurnCommand) => void) | null>(null);
  const suitResolveRef = useRef<((suit: CardSuit) => void) | null>(null);
  const controllerRef = useRef<TurnController | null>(null);
  const awaitingSuitRef = useRef(false);
  const notificationTimeoutRef = useRef<number | undefined>(undefined);
  const contextRef = useRef<PlayContext | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    if (notificationTimeoutRef.current)
      window.clearTimeout(notificationTimeoutRef.current);
    notificationTimeoutRef.current = window.setTimeout(
      () => setNotification(null),
      4000,
    );
  };

  // Stable handler — created once, refs hold the latest state pointers.
  const handlerRef = useRef<ViewEventHandler | null>(null);
  if (!handlerRef.current) {
    handlerRef.current = {
      onCardsDealt: (
        hand: Card[],
        handCounts: number[],
        namesArr: string[],
        ctx: PlayContext,
      ) => {
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
        setContext(ctx);
        contextRef.current = ctx;
        setLastPlayed([ctx.lastCard]);
        setSelected([]);
        awaitingSuitRef.current = false;
      },
      onTurnStarted: (
        rel: number,
        relNext: number,
        aiTurn: Promise<TurnCommand>,
      ) => {
        setCurrentPlayer(rel);
        setNextPlayer(relNext);
        return new Promise<TurnCommand>((resolve) => {
          if (rel === 0) {
            turnResolveRef.current = resolve;
          } else {
            aiTurn.then(resolve);
          }
        });
      },
      onTurnEnded: (rel: number, hand: Card[], turn: TurnEvent) => {
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
      },
      onContextUpdated: (ctx: PlayContext) => {
        setContext(ctx);
        contextRef.current = ctx;
      },
      onGameOver: (player: Player) => {
        showNotification(
          `${player.name} wins! Starting new game in 5 seconds...`,
        );
        setTimeout(() => {
          setSelected([]);
          controllerRef.current?.startGame();
        }, 5000);
      },
    };
  }

  useEffect(() => {
    if (controllerRef.current) return;
    controllerRef.current = new TurnController(
      { me: { name: "You" } },
      handlerRef.current!,
    );
    controllerRef.current.startGame();
  }, []);

  const isMyTurn = currentPlayer === 0 && turnResolveRef.current !== null;
  const disabled = !isMyTurn || awaitingSuitRef.current || suitPickerOpen;

  const myHand = hands[0] ?? [];
  const sortedHand = useMemo(
    () => sortHand(myHand, handSort),
    [myHand, handSort],
  );

  const onSelect = (card: Card) => {
    if (disabled) return;
    setSelected((prev) =>
      prev.includes(card)
        ? prev.filter((c) => c !== card)
        : [...prev, card],
    );
  };

  const onDrawClick = () => {
    if (!isMyTurn || awaitingSuitRef.current) return;
    if (!turnResolveRef.current) return;
    turnResolveRef.current({
      pickup: true,
      played: [],
      suit: CardSuit.None,
    });
    turnResolveRef.current = null;
    setSelected([]);
  };

  const onDiscardClick = async () => {
    if (!isMyTurn || awaitingSuitRef.current) return;
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
      awaitingSuitRef.current = true;
      setSuitPickerOpen(true);
      suit = await new Promise<CardSuit>((resolve) => {
        suitResolveRef.current = resolve;
      });
      awaitingSuitRef.current = false;
      setSuitPickerOpen(false);
    }
    const resolve = turnResolveRef.current;
    if (!resolve) return;
    turnResolveRef.current = null;
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
          isNext={nextPlayer === 2}
        />
      )}
      {names[1] !== undefined && (
        <OpponentHand
          position="left"
          count={hands[1]?.length ?? 0}
          name={names[1]}
          isCurrent={currentPlayer === 1}
          isNext={nextPlayer === 1}
        />
      )}
      {names[3] !== undefined && (
        <OpponentHand
          position="right"
          count={hands[3]?.length ?? 0}
          name={names[3]}
          isCurrent={currentPlayer === 3}
          isNext={nextPlayer === 3}
        />
      )}

      <PlayPile
        played={lastPlayed}
        pickupCount={context?.numberToPickup ?? 0}
        forcedSuit={context?.suit ?? CardSuit.None}
        onDrawClick={onDrawClick}
        onDiscardClick={onDiscardClick}
      />

      <DirectionIndicator
        direction={context?.direction ?? PlayDirection.Clockwise}
      />

      {/* My player chrome */}
      <div className={`my-info ${currentPlayer === 0 ? "is-current" : ""}`}>
        <span className="my-name">{names[0]}</span>
        <span className="my-count">{myHand.length}</span>
      </div>

      <button
        className="btn-icon sort-button"
        onClick={toggleSort}
        title={handSort === "by-suit" ? "Sort by rank" : "Sort by suit"}
        aria-label={handSort === "by-suit" ? "Sort by rank" : "Sort by suit"}
      >
        {handSort === "by-suit" ? "♠♥" : "1·2"}
      </button>

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
