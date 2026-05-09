import {
  Card,
  CardRank,
  CardSuit,
  changesSuit,
  isAscending,
  isListInOrder,
  isWithinOne,
  rankName,
  suitName,
} from "./Card";
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

const bestPlay = (playable: Card[][], game: GameContext) => {
  // TODO: implement some more rules:
  // If we might prevent the next player from winning
  //  * force them to pickup cards
  //  * change direction if they have 2 cards
  //  * change suit to something we know they don't have
  // If we can change directions to player with more cards to go after us
  // Only play one change suit card
  // Maximise the number of cards we force others to pickup

  let maxLength: Card[] = [];
  playable.forEach((cards) => {
    if (cards.length > maxLength.length) {
      maxLength = cards;
    }
  });

  // if changes suit, pick a suit to change it to
  const topCard = maxLength[maxLength.length - 1];
  let suit = CardSuit.None;
  if (changesSuit(topCard)) {
    suit = bestSuit(game);
  }

  return {
    played: maxLength,
    suit: suit,
    pickup: false,
  } as TurnCommand;
};

const bestSuit = (game: GameContext) => {
  let suit = CardSuit.None;
  let max = -1;

  const countsBySuit: Map<CardSuit, number> = new Map();
  game.hand.forEach((card) => {
    const count = countsBySuit.get(card.suit) || 0;
    if (count > max) {
      suit = card.suit;
      max = count + 1;
    }
    countsBySuit.set(card.suit, count + 1);
  });
  return suit;
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

export const calculateTurn = (game: GameContext) => {
  // Find all valid moves
  const playableDecks: Card[][] = [];

  // Store some context about the state of the current game
  const lastCard: Card = findTopCard(game.history);
  const context: PlayContext = {
    lastCard: lastCard,
    numberToPickup: game.numberToPickup,
    suit: game.suit,
  };

  const searchNodes: SearchNode[] = [];

  //create all parent nodes
  game.hand.forEach((card) => searchNodes.push({ card, parent: undefined }));

  //find all valid hands we can play
  while (searchNodes.length > 0) {
    const node: SearchNode = searchNodes.pop()!;

    const play = cardsSoFar(node);

    if (isValidPlay(play, context)) {
      playableDecks.push(play);

      //find the cards we are allowed to play
      game.hand.forEach((card) => {
        if (play.includes(card)) return;
        searchNodes.push({ card, parent: node });
      });
    }
  }

  //only search for cards if we actually have a valid move we can make
  if (playableDecks.length > 0) {
    // Pick one that gives us the best advantage
    return bestPlay(playableDecks, game);
  } else {
    // Otherwise pick up what we have to
    return {
      played: [],
      suit: CardSuit.None,
      pickup: true,
    } as TurnCommand;
  }
};
