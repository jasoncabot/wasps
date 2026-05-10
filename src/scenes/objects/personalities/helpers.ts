import {
  Card,
  CardColour,
  CardRank,
  CardSuit,
  changesSuit,
  colour,
  countSuitFrequency,
  forcesPickup,
  isJoker,
} from "../Card";
import type { TurnCommand } from "../TurnController";

export const PICKUP_TURN: TurnCommand = {
  played: [],
  suit: CardSuit.None,
  pickup: true,
};

export const queenCount = (cards: Card[]) =>
  cards.reduce((n, c) => (c.rank === CardRank.Queen ? n + 1 : n), 0);

export const pickupCardCount = (cards: Card[]) =>
  cards.reduce((n, c) => (forcesPickup(c) ? n + 1 : n), 0);

export const specialCount = (cards: Card[]) =>
  cards.reduce(
    (n, c) =>
      forcesPickup(c) ||
      c.rank === CardRank.Queen ||
      c.rank === CardRank.Ace ||
      (c.rank === CardRank.Jack &&
        (c.suit === CardSuit.Hearts || c.suit === CardSuit.Diamonds))
        ? n + 1
        : n,
    0,
  );

export const bestSuitForHand = (hand: Card[]): CardSuit => {
  let best = CardSuit.Spades;
  let bestCount = -1;
  for (const [suit, count] of countSuitFrequency(hand)) {
    if (count > bestCount) { best = suit; bestCount = count; }
  }
  return best;
};

/**
 * Wrap a chosen play into a TurnCommand, picking the suit the play wants to
 * change to (only relevant when the top card is Ace or Joker).
 */
export const finalize = (played: Card[], suit: CardSuit): TurnCommand => {
  const top = played[played.length - 1];
  return {
    played,
    suit: changesSuit(top) ? suit : CardSuit.None,
    pickup: false,
  };
};

export const longest = (plays: Card[][]): Card[] => {
  let best = plays[0];
  for (const p of plays) if (p.length > best.length) best = p;
  return best;
};

export const shortest = (plays: Card[][]): Card[] => {
  let best = plays[0];
  for (const p of plays) if (p.length < best.length) best = p;
  return best;
};

const filterByMin = <T>(items: T[], score: (item: T) => number): T[] => {
  const scores = items.map(score);
  const min = Math.min(...scores);
  return items.filter((_, i) => scores[i] === min);
};

const highValueSpecialCount = (p: Card[]) =>
  p.filter(
    (c) =>
      c.rank === CardRank.Ace ||
      isJoker(c) ||
      (c.rank === CardRank.Jack && colour(c.suit) === CardColour.Red),
  ).length;

const hasMixedJacks = (p: Card[]): boolean => {
  let hasBlack = false;
  let hasRed = false;
  for (const c of p) {
    if (c.rank !== CardRank.Jack) continue;
    if (colour(c.suit) === CardColour.Black) hasBlack = true;
    else hasRed = true;
    if (hasBlack && hasRed) return true;
  }
  return false;
};

/**
 * Filter plays to conserve high-value special cards (aces, jokers, red jacks)
 * and avoid self-cancelling jack combinations. Bypassed when a play empties
 * the hand (winning move takes priority).
 */
export const limitSpecials = (plays: Card[][], handLen: number): Card[][] => {
  const winning = plays.filter((p) => p.length === handLen);
  if (winning.length > 0) return winning;

  // Avoid plays that mix red and black jacks — the red jack cancels the black
  // jack's damage, wasting both cards.
  const noMixedJacks = plays.filter((p) => !hasMixedJacks(p));
  const candidates = noMixedJacks.length > 0 ? noMixedJacks : plays;

  return filterByMin(candidates, highValueSpecialCount);
};

const MAX_QUEENS_PER_TURN = 2;

/**
 * Filter plays so we never voluntarily dump more than two queens at once
 * (hoarding direction control). If the play empties our hand, all bets are
 * off.
 */
export const limitQueens = (plays: Card[][], handLen: number): Card[][] => {
  const winning = plays.filter((p) => p.length === handLen);
  if (winning.length > 0) return winning;
  const limited = plays.filter((p) => queenCount(p) <= MAX_QUEENS_PER_TURN);
  if (limited.length > 0) return limited;
  return filterByMin(plays, queenCount);
};
