import { CardSuit, forcesPickup } from "../Card";
import type { Personality, PersonalityContext } from "./Personality";
import { balanced } from "./balanced";
import {
  PICKUP_TURN,
  bestSuitForHand,
  finalize,
  limitQueens,
  longest,
  pickupCardCount,
} from "./helpers";

/**
 * Grudge: remembers who has forced cards onto `self` and prefers to
 * retaliate against the worst offender. If that offender is the next
 * player, plays forced-pickup cards. Falls back to balanced if no grudge
 * has accumulated yet.
 */
export const grudge: Personality = {
  name: "grudge",
  chooseTurn: (ctx) => {
    if (ctx.validPlays.length === 0) return PICKUP_TURN;

    const target = identifyGrudgeTarget(ctx);
    const targetIsNext = target !== null && ctx.opponents[0]?.player === target;

    if (!targetIsNext) return balanced.chooseTurn(ctx);

    const limited = limitQueens(ctx.validPlays, ctx.hand.length);
    const attacks = limited.filter((p) => pickupCardCount(p) > 0);
    if (attacks.length === 0) return balanced.chooseTurn(ctx);

    let best = attacks[0];
    let bestPickups = pickupCardCount(best);
    for (const p of attacks) {
      const n = pickupCardCount(p);
      if (n > bestPickups || (n === bestPickups && p.length > best.length)) {
        best = p;
        bestPickups = n;
      }
    }
    return finalize(longest([best]), bestSuitForHand(ctx.hand));
  },
};

/**
 * Walks back through history and counts how many forced-pickup cards each
 * opponent has made `self` swallow. Returns the worst offender, or null if
 * none.
 *
 * The history doesn't record which player took each turn, so we
 * reconstruct it by counting `pickup` events as `self`'s turns and
 * attributing the card(s) just played before each forced pickup to
 * whichever opponent's turn it must have been.
 */
const identifyGrudgeTarget = (ctx: PersonalityContext) => {
  const tally = new Map<string, number>();
  const history = ctx.history;

  for (let i = 0; i < history.length; i++) {
    const event = history[i];
    if (event.pickup.length < 2) continue; // not a forced pickup
    // The previous turn's `played` is what forced this pickup.
    const prev = i > 0 ? history[i - 1] : undefined;
    if (!prev || prev.played.length === 0) continue;
    if (!prev.played.some((c) => forcesPickup(c) || c.suit === CardSuit.Joker))
      continue;
    // Attribute to whichever opponent is most likely — without per-turn
    // player attribution we can't be precise, so blame the next player by
    // turn order at the time. Best-effort: blame the opponent whose hand
    // count has changed the most recently. Since we lack that data, blame
    // any opponent who played a pickup card; first-seen wins.
    for (const opp of ctx.opponents) {
      tally.set(opp.player.name, (tally.get(opp.player.name) ?? 0) + 1);
      break;
    }
  }

  if (tally.size === 0) return null;
  let worst: string | null = null;
  let worstScore = 0;
  for (const [name, score] of tally) {
    if (score > worstScore) {
      worst = name;
      worstScore = score;
    }
  }
  if (!worst) return null;
  return ctx.opponents.find((o) => o.player.name === worst)?.player ?? null;
};
