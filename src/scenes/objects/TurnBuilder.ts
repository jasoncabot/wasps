import {
  Card,
  CardRank,
  CardSuit,
  isAscending,
  isListInOrder,
  isWithinOne,
  rankName,
  suitName,
} from "./Card";
import { PlayDirection } from "./Game";
import { balanced } from "./personalities/balanced";
import { GameContext, TurnCommand, TurnEvent } from "./TurnController";

interface SearchNode {
  card: Card;
  parent: SearchNode | undefined;
}

export interface PlayContext {
  /**
   * The top card of the played pile
   */
  lastCard: Card;
  /**
   * The current number of cards that must be picked up. This is
   * 1 by default which means there hasn't been any special cards
   * played that forces a pickup
   */
  numberToPickup: number;
  /**
   * An explicit suit selection, set after playing a card that
   * allows a player to change the suit, otherwise None
   */
  suit: CardSuit;
  /**
   * Current direction of play around the table.
   */
  direction: PlayDirection;
}

const cardsSoFar = (node: SearchNode) => {
  const play: Card[] = [];
  let current: SearchNode | undefined = node;
  while (current) {
    play.unshift(current.card);
    current = current.parent;
  }
  return play;
};

export const isValidPlay = (play: Card[], context: PlayContext) => {
  return validatePlay(play, context).length === 0;
};

export const validatePlay = (play: Card[], context: PlayContext) => {
  if (play.length === 0) return ["You must play more than one card"];
  const first = validateFirstCard(play[0], context);
  const remaining = validateCardList(play);
  return first.concat(remaining);
};

const validateFirstCard = (card: Card, context: PlayContext) => {
  const lastCard = context.lastCard;

  if (context.numberToPickup > 0) {
    // card MUST cancel or stack
    // therefore we must play the same rank as the last card in the played stack
    if (card.rank === lastCard.rank) {
      return [];
    } else {
      return [
        `You are being forced to pick up cards. You must play a ${rankName(lastCard.rank)}.`,
      ];
    }
  } else if (context.suit === CardSuit.None) {
    //card must match suit OR rank
    //jokers and aces can be played on anything
    if (
      card.rank === CardRank.Joker ||
      card.rank === CardRank.Ace ||
      lastCard.suit === card.suit ||
      lastCard.rank === card.rank
    ) {
      return [];
    } else {
      return [
        `First card played must either be a ${rankName(lastCard.rank)} or ${suitName(lastCard.suit)}.`,
      ];
    }
  } else {
    //card must match suit
    //jokers and aces can be played on anything
    if (
      card.suit === context.suit ||
      card.rank === CardRank.Joker ||
      card.rank === CardRank.Ace
    ) {
      return [];
    } else {
      return [
        `You must either play a ${suitName(context.suit)} or an Ace or Wasp that can be played on anything.`,
      ];
    }
  }
};

const validateCardList = (cards: Card[]) => {
  //if we only have one card, then of course the cards are going to be in a 'valid order'
  if (cards.length === 1) return [] as string[];

  let rankDiffers = false;
  let suitDiffers = false;

  let firstCard = cards[0];
  let firstRank = firstCard.rank;
  let firstSuit = firstCard.suit;

  cards.forEach((card) => {
    if (card.rank !== firstRank) rankDiffers = true;
    if (card.suit !== firstSuit) suitDiffers = true;
  });

  //if the suit changes as well as the ranks, then this is invalid
  if (suitDiffers && rankDiffers)
    return ["Multiple cards must be of the same suit or rank."];

  //we have a set of cards all of the same rank
  if (suitDiffers && !rankDiffers) return [];

  //if the ranks change, while the suit stays the same, we must check we have a valid run
  if (rankDiffers && !suitDiffers) {
    // we are playing an ace, then trying to follow it with a two/king of the same suit
    // which is an invalid move
    if (firstCard.rank === CardRank.Ace)
      return ["Aces must be played on their own"];

    const secondCard = cards[1];

    //first and second cards are not in order - base case
    if (!isWithinOne(firstCard, secondCard)) {
      return ["A run of cards must be consecutive."];
    } else {
      if (isListInOrder(cards, isAscending(firstCard, secondCard))) {
        return [];
      } else {
        return ["Cards must be played in order."];
      }
    }
  }

  //user could have played two jokers, which both have the same suit and rank
  const allJokers =
    cards.filter((x) => x.rank === CardRank.Joker && x.suit === CardSuit.Joker)
      .length === cards.length;
  if (allJokers) {
    return [];
  } else {
    return ["You may not play another card with a Wasp"];
  }
};

export const bestSuit = (game: GameContext) => {
  // Count each real suit in hand, ignoring jokers (Joker is not a valid
  // chosen suit — picking it would hide the suit indicator from the next
  // player and break the game).
  const counts = new Map<CardSuit, number>();
  for (const card of game.hand) {
    if (card.suit === CardSuit.Joker) continue;
    counts.set(card.suit, (counts.get(card.suit) ?? 0) + 1);
  }

  let bestSuit = CardSuit.None;
  let bestCount = 0;
  for (const [suit, count] of counts) {
    if (count > bestCount) {
      bestSuit = suit;
      bestCount = count;
    }
  }

  // If the AI somehow has no non-joker cards left, fall back to a real suit
  // so the indicator always shows something the human can match against.
  if (bestSuit === CardSuit.None) return CardSuit.Spades;
  return bestSuit;
};

export const findTopCard = (history: TurnEvent[]) => {
  let lastPlay: Card[] = [];
  let idx = history.length - 1;
  while (lastPlay.length === 0) {
    lastPlay = history[idx].played;
    idx--;
  }
  return lastPlay[lastPlay.length - 1];
};

export const findValidPlays = (
  hand: Card[],
  context: PlayContext,
): Card[][] => {
  const playableDecks: Card[][] = [];
  const searchNodes: SearchNode[] = [];

  hand.forEach((card) => searchNodes.push({ card, parent: undefined }));

  while (searchNodes.length > 0) {
    const node: SearchNode = searchNodes.pop()!;
    const play = cardsSoFar(node);

    if (isValidPlay(play, context)) {
      playableDecks.push(play);
      hand.forEach((card) => {
        if (play.includes(card)) return;
        searchNodes.push({ card, parent: node });
      });
    }
  }

  return playableDecks;
};

/**
 * Convenience entry point used by tests and as a fallback when no
 * personality is wired up. Behaves like the {@link balanced} personality.
 */
export const calculateTurn = (game: GameContext): TurnCommand => {
  const lastCard: Card = findTopCard(game.history);
  const play: PlayContext = {
    lastCard,
    numberToPickup: game.numberToPickup,
    suit: game.suit,
    direction: PlayDirection.Clockwise,
  };
  const validPlays = findValidPlays(game.hand, play);
  return balanced.chooseTurn({
    self: game.currentPlayer,
    hand: game.hand,
    play,
    validPlays,
    opponents: [],
    history: game.history,
  });
};
