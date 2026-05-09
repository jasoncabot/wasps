import {
  Card,
  CardRank,
  CardSuit,
  changesSuit,
  forcesPickup,
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
  const counts = new Map<CardSuit, number>();
  for (const card of hand) {
    if (card.suit === CardSuit.Joker) continue;
    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  }
  let best = CardSuit.None;
  let bestCount = 0;
  for (const [suit, count] of counts) {
    if (count > bestCount) {
      best = suit;
      bestCount = count;
    }
  }
  return best === CardSuit.None ? CardSuit.Spades : best;
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
  const minQ = Math.min(...plays.map(queenCount));
  return plays.filter((p) => queenCount(p) === minQ);
};
