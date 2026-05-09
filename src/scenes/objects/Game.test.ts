import { describe, expect, it } from "vitest";
import { Card, CardRank, CardSuit } from "./Card";
import Game, { Randomiser } from "./Game";
import { Player } from "./Player";
import {
  GameContext,
  GameEventHandler,
  TurnCommand,
  TurnHandler,
} from "./TurnController";
import { bestSuit, calculateTurn } from "./TurnBuilder";

// ── Test fixtures ───────────────────────────────────────────────────────────

const detRandom = (seed = 1): Randomiser => {
  let s = seed;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    shuffle<T>(array: T[]): T[] {
      const a = array.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    integerInRange(min: number, max: number) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
  };
};

const noopHandler: GameEventHandler = {
  onGameStarted: () => {},
  onGameUpdated: () => {},
  onGameOver: () => {},
};

const noopController: TurnHandler = {
  onTurnStarted: async () => ({
    pickup: true,
    played: [],
    suit: CardSuit.None,
  }),
  onTurnEnded: () => {},
};

const players: Player[] = [
  { name: "P0" },
  { name: "P1" },
  { name: "P2" },
  { name: "P3" },
];

const makeGame = (seed = 1) => {
  const game = new Game(detRandom(seed), players, noopHandler, noopController);
  game.deal(players[0]);
  return game;
};

const setTopCard = (game: Game, card: Card) => {
  game.played.push({
    played: [card],
    suit: CardSuit.None,
    pickup: [],
    directionChanged: false,
  });
};

// ── Game state tests ────────────────────────────────────────────────────────

describe("Game.applyTurn — pickup", () => {
  it("draws a single card on a normal pickup turn", () => {
    const game = makeGame();
    const before = game.hands[0].length;
    const pileBefore = game.pile.length;

    game.applyTurn(0, { pickup: true, played: [], suit: CardSuit.None });

    expect(game.hands[0].length).toBe(before + 1);
    expect(game.pile.length).toBe(pileBefore - 1);
  });

  it("draws all forced cards when forcedPickupCount > 0", () => {
    const game = makeGame();
    game.forcedPickupCount = 4;
    const before = game.hands[0].length;

    game.applyTurn(0, { pickup: true, played: [], suit: CardSuit.None });

    expect(game.hands[0].length).toBe(before + 4);
    expect(game.forcedPickupCount).toBe(0);
  });

  it("preserves the chosen suit when picking up", () => {
    const game = makeGame();
    game.suitChoice = CardSuit.Hearts;
    game.applyTurn(0, { pickup: true, played: [], suit: CardSuit.None });
    expect(game.suitChoice).toBe(CardSuit.Hearts);
  });
});

describe("Game.applyTurn — forced pickup stacking", () => {
  it("stacks two 2s into a forced pickup of 4", () => {
    const game = makeGame();
    const twoH: Card = { suit: CardSuit.Hearts, rank: CardRank.Two };
    const twoD: Card = { suit: CardSuit.Diamonds, rank: CardRank.Two };
    game.hands[0] = [twoH, twoD];
    setTopCard(game, { suit: CardSuit.Hearts, rank: CardRank.Five });

    game.applyTurn(0, {
      pickup: false,
      played: [twoH, twoD],
      suit: CardSuit.None,
    });

    expect(game.forcedPickupCount).toBe(4);
  });

  it("stacks two jokers into a forced pickup of 8", () => {
    const game = makeGame();
    const joker: Card = { suit: CardSuit.Joker, rank: CardRank.Joker };
    const joker2: Card = { suit: CardSuit.Joker, rank: CardRank.Joker };
    game.hands[0] = [joker, joker2];
    setTopCard(game, { suit: CardSuit.Hearts, rank: CardRank.Five });

    game.applyTurn(0, {
      pickup: false,
      played: [joker, joker2],
      suit: CardSuit.Hearts,
    });

    expect(game.forcedPickupCount).toBe(8);
  });

  it("forces 7-card pickup for a single black jack", () => {
    const game = makeGame();
    const blackJack: Card = { suit: CardSuit.Spades, rank: CardRank.Jack };
    game.hands[0] = [blackJack];
    setTopCard(game, { suit: CardSuit.Spades, rank: CardRank.Five });

    game.applyTurn(0, {
      pickup: false,
      played: [blackJack],
      suit: CardSuit.None,
    });

    expect(game.forcedPickupCount).toBe(7);
  });

  it("red jack on a black jack cancels the pickup", () => {
    const game = makeGame();
    const blackJack: Card = { suit: CardSuit.Clubs, rank: CardRank.Jack };
    setTopCard(game, blackJack);
    game.forcedPickupCount = 7;

    const redJack: Card = { suit: CardSuit.Hearts, rank: CardRank.Jack };
    game.hands[0] = [redJack];

    game.applyTurn(0, {
      pickup: false,
      played: [redJack],
      suit: CardSuit.None,
    });

    expect(game.forcedPickupCount).toBe(0);
  });

  it("clears forced pickup when a non-special card is played", () => {
    const game = makeGame();
    setTopCard(game, { suit: CardSuit.Hearts, rank: CardRank.Two });
    game.forcedPickupCount = 2;

    const five: Card = { suit: CardSuit.Hearts, rank: CardRank.Five };
    game.hands[0] = [five];

    // This case isn't legal under validatePlay, but the engine itself
    // should still clear the forced pickup if a non-special card lands.
    game.applyTurn(0, {
      pickup: false,
      played: [five],
      suit: CardSuit.None,
    });

    expect(game.forcedPickupCount).toBe(0);
  });
});

describe("Game.applyTurn — suit choice", () => {
  it("records the chosen suit when an ace is played", () => {
    const game = makeGame();
    const aceS: Card = { suit: CardSuit.Spades, rank: CardRank.Ace };
    game.hands[0] = [aceS];
    setTopCard(game, { suit: CardSuit.Hearts, rank: CardRank.Five });

    game.applyTurn(0, {
      pickup: false,
      played: [aceS],
      suit: CardSuit.Diamonds,
    });

    expect(game.suitChoice).toBe(CardSuit.Diamonds);
  });

  it("records the chosen suit when a joker is played", () => {
    const game = makeGame();
    const j: Card = { suit: CardSuit.Joker, rank: CardRank.Joker };
    game.hands[0] = [j];
    setTopCard(game, { suit: CardSuit.Hearts, rank: CardRank.Five });

    game.applyTurn(0, {
      pickup: false,
      played: [j],
      suit: CardSuit.Clubs,
    });

    expect(game.suitChoice).toBe(CardSuit.Clubs);
  });
});

describe("Game.changeTurns — direction", () => {
  it("an odd queen count reverses direction", () => {
    const game = makeGame();
    const order = game.turns.map((p) => p.name);

    game.changeTurns(true);

    const after = game.turns.map((p) => p.name);
    // First player is now what was previously the *previous* player.
    expect(after[0]).toBe(order[order.length - 1]);
  });

  it("two queens (even) cancel — turn order goes to the next player", () => {
    const game = makeGame();
    const order = game.turns.map((p) => p.name);

    game.changeTurns(false);

    const after = game.turns.map((p) => p.name);
    expect(after[0]).toBe(order[1]);
  });
});

// ── TurnBuilder tests ───────────────────────────────────────────────────────

describe("TurnBuilder.bestSuit", () => {
  it("never returns Joker even when jokers dominate the hand", () => {
    const ctx: GameContext = {
      currentPlayer: players[0],
      nextPlayer: players[1],
      numberToPickup: 0,
      hand: [
        { suit: CardSuit.Joker, rank: CardRank.Joker },
        { suit: CardSuit.Joker, rank: CardRank.Joker },
        { suit: CardSuit.Hearts, rank: CardRank.Five },
      ],
      turns: players,
      history: [],
      suit: CardSuit.None,
    };
    expect(bestSuit(ctx)).toBe(CardSuit.Hearts);
  });

  it("falls back to a real suit if hand has only jokers", () => {
    const ctx: GameContext = {
      currentPlayer: players[0],
      nextPlayer: players[1],
      numberToPickup: 0,
      hand: [{ suit: CardSuit.Joker, rank: CardRank.Joker }],
      turns: players,
      history: [],
      suit: CardSuit.None,
    };
    const suit = bestSuit(ctx);
    expect(suit).not.toBe(CardSuit.Joker);
    expect(suit).not.toBe(CardSuit.None);
  });

  it("picks the most common real suit", () => {
    const ctx: GameContext = {
      currentPlayer: players[0],
      nextPlayer: players[1],
      numberToPickup: 0,
      hand: [
        { suit: CardSuit.Hearts, rank: CardRank.Three },
        { suit: CardSuit.Hearts, rank: CardRank.Four },
        { suit: CardSuit.Hearts, rank: CardRank.Five },
        { suit: CardSuit.Spades, rank: CardRank.Three },
        { suit: CardSuit.Clubs, rank: CardRank.Three },
      ],
      turns: players,
      history: [],
      suit: CardSuit.None,
    };
    expect(bestSuit(ctx)).toBe(CardSuit.Hearts);
  });
});

describe("TurnBuilder.calculateTurn — queen hoarding", () => {
  const ctxWithHand = (hand: Card[], topCard: Card): GameContext => ({
    currentPlayer: players[0],
    nextPlayer: players[1],
    numberToPickup: 0,
    hand,
    turns: players,
    history: [
      {
        played: [topCard],
        suit: CardSuit.None,
        pickup: [],
        directionChanged: false,
      },
    ],
    suit: CardSuit.None,
  });

  it("does not play more than two queens when the move would not empty the hand", () => {
    const queens: Card[] = [
      { suit: CardSuit.Hearts, rank: CardRank.Queen },
      { suit: CardSuit.Diamonds, rank: CardRank.Queen },
      { suit: CardSuit.Clubs, rank: CardRank.Queen },
      { suit: CardSuit.Spades, rank: CardRank.Queen },
    ];
    const filler: Card[] = [
      { suit: CardSuit.Hearts, rank: CardRank.Three },
      { suit: CardSuit.Hearts, rank: CardRank.Four },
    ];
    const ctx = ctxWithHand([...queens, ...filler], {
      suit: CardSuit.Spades,
      rank: CardRank.Six,
    });

    const turn = calculateTurn(ctx);
    const queensPlayed = turn.played.filter(
      (c) => c.rank === CardRank.Queen,
    ).length;
    expect(queensPlayed).toBeLessThanOrEqual(2);
  });

  it("plays all queens when doing so empties the hand (going out)", () => {
    const queens: Card[] = [
      { suit: CardSuit.Hearts, rank: CardRank.Queen },
      { suit: CardSuit.Diamonds, rank: CardRank.Queen },
      { suit: CardSuit.Clubs, rank: CardRank.Queen },
      { suit: CardSuit.Spades, rank: CardRank.Queen },
    ];
    const ctx = ctxWithHand(queens, {
      suit: CardSuit.Spades,
      rank: CardRank.Six,
    });

    const turn = calculateTurn(ctx);
    expect(turn.played.length).toBe(4);
  });
});

describe("TurnBuilder.calculateTurn — joker always picks a real suit", () => {
  it("returns a non-Joker, non-None suit when playing a joker", () => {
    const ctx: GameContext = {
      currentPlayer: players[0],
      nextPlayer: players[1],
      numberToPickup: 0,
      hand: [
        { suit: CardSuit.Joker, rank: CardRank.Joker },
        { suit: CardSuit.Hearts, rank: CardRank.Five },
        { suit: CardSuit.Hearts, rank: CardRank.Six },
      ],
      turns: players,
      history: [
        {
          played: [{ suit: CardSuit.Spades, rank: CardRank.Two }],
          suit: CardSuit.None,
          pickup: [],
          directionChanged: false,
        },
      ],
      suit: CardSuit.None,
    };
    const turn: TurnCommand = calculateTurn(ctx);
    const top = turn.played[turn.played.length - 1];
    if (top && (top.rank === CardRank.Joker || top.rank === CardRank.Ace)) {
      expect(turn.suit).not.toBe(CardSuit.Joker);
      expect(turn.suit).not.toBe(CardSuit.None);
    }
  });
});

describe("Game.deal — initial state", () => {
  it("deals seven cards to each player", () => {
    const game = makeGame();
    expect(game.hands).toHaveLength(4);
    for (const hand of game.hands) {
      expect(hand).toHaveLength(7);
    }
  });

  it("starts with no forced pickup", () => {
    const game = makeGame();
    expect(game.forcedPickupCount).toBe(0);
  });

  it("starts with a top card that is not a wasp/joker", () => {
    const game = makeGame();
    const topPlayed = game.played[game.played.length - 1].played;
    const topCard = topPlayed[topPlayed.length - 1];
    expect(topCard.rank).not.toBe(CardRank.Joker);
  });
});

// ── End-to-end: pickup followed by re-render mirrors the GameBoard contract ──

describe("Game contract — hand reference behaviour", () => {
  // GameBoard relies on slicing the hand because Game.applyTurn
  // mutates in place on pickup. This test pins that behaviour so that if
  // Game stops mutating, the comment in GameBoard.onTurnEnded can be revisited.
  it("mutates the same hand array in place when a player picks up", () => {
    const game = makeGame();
    const handRef = game.hands[0];
    game.applyTurn(0, { pickup: true, played: [], suit: CardSuit.None });
    expect(game.hands[0]).toBe(handRef);
  });

  it("replaces the hand array reference when a player plays a card", () => {
    const game = makeGame();
    const handRef = game.hands[0];
    const card = handRef[0];
    setTopCard(game, { suit: card.suit, rank: card.rank });

    game.applyTurn(0, { pickup: false, played: [card], suit: CardSuit.None });

    expect(game.hands[0]).not.toBe(handRef);
  });
});
