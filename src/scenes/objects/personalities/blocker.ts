import type { Personality } from "./Personality";
import {
  aggressiveSuit,
  anyOpponentNearWinning,
  conditionalSuit,
  selfSuit,
} from "./SuitStrategy";
import { balanced } from "./balanced";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
  limitSpecials,
  longest,
  pickupCardCount,
} from "./helpers";

const DANGER_THRESHOLD = 3;

/**
 * Blocker: watches for opponents close to winning and tries to hurt them.
 * If any opponent has ≤ 3 cards, prioritises forced-pickup plays. Falls back
 * to balanced behaviour when nobody is in danger.
 */
export const blocker: Personality = {
  name: "blocker",
  suitStrategy: conditionalSuit(anyOpponentNearWinning(DANGER_THRESHOLD), aggressiveSuit, selfSuit),
  chooseTurn: (ctx) => {
    if (ctx.validPlays.length === 0) return PICKUP_TURN;

    const danger = ctx.opponents.some((o) => o.handCount <= DANGER_THRESHOLD);
    if (!danger) return balanced.chooseTurn(ctx);

    const limited = limitQueens(ctx.validPlays, ctx.hand.length);
    const attacks = limited.filter((p) => pickupCardCount(p) > 0);
    if (attacks.length === 0) return balanced.chooseTurn(ctx);

    const candidates = limitSpecials(attacks, ctx.hand.length);

    // Pick the attack with the most forced-pickup cards, longest play to
    // burn through our hand.
    let best = candidates[0];
    let bestPickups = pickupCardCount(best);
    for (const p of candidates) {
      const n = pickupCardCount(p);
      if (n > bestPickups || (n === bestPickups && p.length > best.length)) {
        best = p;
        bestPickups = n;
      }
    }
    return finalize(longest([best]), bestSuitForHand(ctx.hand));
  },
};
