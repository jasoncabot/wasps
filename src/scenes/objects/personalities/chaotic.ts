import type { Personality } from "./Personality";
import { chaoticSuit } from "./SuitStrategy";
import { PICKUP_TURN, bestSuitForHand, finalize } from "./helpers";

/**
 * Chaotic: picks a random valid play. Useful as a baseline / sparring
 * partner and as an ingredient in mixed personalities.
 */
export const chaotic: Personality = {
  name: "chaotic",
  suitStrategy: chaoticSuit,
  chooseTurn: ({ hand, validPlays }) => {
    if (validPlays.length === 0) return PICKUP_TURN;
    const idx = Math.floor(Math.random() * validPlays.length);
    return finalize(validPlays[idx], bestSuitForHand(hand));
  },
};
