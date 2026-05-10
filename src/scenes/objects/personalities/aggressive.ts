import type { Personality } from "./Personality";
import {
  aggressiveSuit,
  anyOpponentNearWinning,
  conditionalSuit,
  selfSuit,
} from "./SuitStrategy";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
  limitSpecials,
  longest,
  pickupCardCount,
} from "./helpers";

/**
 * Aggressive: maximises damage to the next player. Prefers plays containing
 * forced-pickup cards (2s, black jacks, jokers) and dumps as many cards as
 * possible.
 */
export const aggressive: Personality = {
  name: "aggressive",
  suitStrategy: conditionalSuit(anyOpponentNearWinning(4), aggressiveSuit, selfSuit),
  chooseTurn: ({ hand, validPlays }) => {
    if (validPlays.length === 0) return PICKUP_TURN;
    const limited = limitQueens(validPlays, hand.length);

    const withPickups = limited.filter((p) => pickupCardCount(p) > 0);
    const pool = withPickups.length > 0 ? withPickups : limited;
    const candidates = limitSpecials(pool, hand.length);

    // Among candidates, prefer ones that force the most pickups, then longest.
    let best = candidates[0];
    let bestPickups = pickupCardCount(best);
    for (const p of candidates) {
      const n = pickupCardCount(p);
      if (n > bestPickups || (n === bestPickups && p.length > best.length)) {
        best = p;
        bestPickups = n;
      }
    }

    return finalize(longest([best]), bestSuitForHand(hand));
  },
};
