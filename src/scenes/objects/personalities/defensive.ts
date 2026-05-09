import { CardRank } from "../Card";
import type { Personality } from "./Personality";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
  specialCount,
} from "./helpers";

/**
 * Defensive: hoards special cards (aces, jokers, jacks, queens, twos) for
 * when they're really needed, and tries to keep its hand size flexible by
 * playing single non-special cards. Will still cancel a forced pickup using
 * a red jack on a black jack since otherwise it must take 7+.
 */
export const defensive: Personality = {
  name: "defensive",
  chooseTurn: ({ hand, validPlays, play }) => {
    if (validPlays.length === 0) return PICKUP_TURN;

    const limited = limitQueens(validPlays, hand.length);

    // If the move would empty our hand, take it without hesitation.
    const winning = limited.filter((p) => p.length === hand.length);
    if (winning.length > 0) {
      return finalize(winning[0], bestSuitForHand(hand));
    }

    // If we're being forced to pick up, prefer plays that cancel/stack with
    // the smallest hit (red jacks, lowest stacks first).
    if (play.numberToPickup > 0) {
      const redJackPlays = limited.filter((p) =>
        p.every(
          (c) =>
            c.rank === CardRank.Jack &&
            (c.suit === 2 /*Diamonds*/ || c.suit === 3 /*Hearts*/),
        ),
      );
      if (redJackPlays.length > 0) {
        return finalize(redJackPlays[0], bestSuitForHand(hand));
      }
    }

    // Otherwise pick the play that uses the fewest special cards, breaking
    // ties by shortest length (keep options open).
    let best = limited[0];
    let bestScore = specialCount(best) * 100 + best.length;
    for (const p of limited) {
      const score = specialCount(p) * 100 + p.length;
      if (score < bestScore) {
        best = p;
        bestScore = score;
      }
    }
    return finalize(best, bestSuitForHand(hand));
  },
};
