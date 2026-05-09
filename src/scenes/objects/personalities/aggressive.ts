import type { Personality } from "./Personality";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
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
  chooseTurn: ({ hand, validPlays }) => {
    if (validPlays.length === 0) return PICKUP_TURN;
    const limited = limitQueens(validPlays, hand.length);

    const withPickups = limited.filter((p) => pickupCardCount(p) > 0);
    const candidates = withPickups.length > 0 ? withPickups : limited;

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
