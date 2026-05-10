import { Card, CardSuit, countSuitFrequency } from "../Card";
import type { OpponentInfo } from "./Personality";
import type { TurnEvent } from "../TurnController";

export interface SuitContext {
  hand: Card[];
  opponents: OpponentInfo[];
  history: TurnEvent[];
}

export interface SuitStrategy {
  readonly name: string;
  chooseSuit(ctx: SuitContext): CardSuit;
}

const REAL_SUITS = [
  CardSuit.Clubs,
  CardSuit.Diamonds,
  CardSuit.Hearts,
  CardSuit.Spades,
] as const;

/** Pick the suit you hold the most cards of. */
export const selfSuit: SuitStrategy = {
  name: "selfSuit",
  chooseSuit: ({ hand }) => {
    let best = CardSuit.Spades;
    let bestCount = -1;
    for (const [suit, count] of countSuitFrequency(hand)) {
      if (count > bestCount) { best = suit; bestCount = count; }
    }
    return best;
  },
};

/**
 * Pick the suit the next opponent holds the fewest cards of, forcing them to
 * draw or play off-suit. Uses the opponent's actual hand when available.
 */
export const aggressiveSuit: SuitStrategy = {
  name: "aggressiveSuit",
  chooseSuit: ({ opponents }) => {
    const next = opponents[0];
    if (!next?.hand?.length) return CardSuit.Spades;
    let worst = CardSuit.Spades;
    let worstCount = Infinity;
    for (const [suit, count] of countSuitFrequency(next.hand)) {
      if (count < worstCount) { worst = suit; worstCount = count; }
    }
    return worst;
  },
};

/** Pick a random suit. */
export const chaoticSuit: SuitStrategy = {
  name: "chaoticSuit",
  chooseSuit: () => REAL_SUITS[Math.floor(Math.random() * REAL_SUITS.length)],
};

/**
 * Switch between two suit strategies based on game state.
 * Lets a personality escalate late-game (e.g. switch from selfSuit to
 * aggressiveSuit when an opponent is close to winning).
 */
export const conditionalSuit = (
  condition: (ctx: SuitContext) => boolean,
  ifTrue: SuitStrategy,
  ifFalse: SuitStrategy,
  name?: string,
): SuitStrategy => ({
  name: name ?? `conditional(${ifTrue.name}|${ifFalse.name})`,
  chooseSuit: (ctx) =>
    condition(ctx) ? ifTrue.chooseSuit(ctx) : ifFalse.chooseSuit(ctx),
});

/** True when any opponent is within `threshold` cards of going out. */
export const anyOpponentNearWinning =
  (threshold = 4) =>
  (ctx: SuitContext): boolean =>
    ctx.opponents.some((o) => o.handCount <= threshold);
