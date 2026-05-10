import type { Personality } from "./Personality";
import { selfSuit } from "./SuitStrategy";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
  limitSpecials,
  longest,
} from "./helpers";

/**
 * The default play style: dump the longest valid run, but don't waste more
 * than two queens at a time, conserve aces/jokers/red jacks, and prefer suits
 * we already hold.
 */
export const balanced: Personality = {
  name: "balanced",
  suitStrategy: selfSuit,
  chooseTurn: ({ hand, validPlays }) => {
    if (validPlays.length === 0) return PICKUP_TURN;
    const afterQueens = limitQueens(validPlays, hand.length);
    const candidates = limitSpecials(afterQueens, hand.length);
    return finalize(longest(candidates), bestSuitForHand(hand));
  },
};
