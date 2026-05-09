import type { Personality } from "./Personality";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
  longest,
} from "./helpers";

/**
 * The default play style: dump the longest valid run, but don't waste more
 * than two queens at a time and prefer suits we already hold.
 */
export const balanced: Personality = {
  name: "balanced",
  chooseTurn: ({ hand, validPlays }) => {
    if (validPlays.length === 0) return PICKUP_TURN;
    const candidates = limitQueens(validPlays, hand.length);
    return finalize(longest(candidates), bestSuitForHand(hand));
  },
};
