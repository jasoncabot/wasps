export interface Card {
  suit: CardSuit;
  rank: CardRank;
}

export enum CardSuit {
  None = 0,
  Clubs = 1,
  Diamonds = 2,
  Hearts = 3,
  Spades = 4,
  Joker = 5,
}
const suitNames = ["None", "Clubs", "Diamonds", "Hearts", "Spades", "Joker"];

export enum CardRank {
  None = 0,
  Ace = 1,
  Two = 2,
  Three = 3,
  Four = 4,
  Five = 5,
  Six = 6,
  Seven = 7,
  Eight = 8,
  Nine = 9,
  Ten = 10,
  Jack = 11,
  Queen = 12,
  King = 13,
  Joker = 14,
}
const rankNames = [
  "None",
  "Ace",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Jack",
  "Queen",
  "King",
  "Joker",
];

export enum CardColour {
  Black,
  Red,
}

export const suitName = (suit: CardSuit) => {
  return suitNames[suit];
};

export const rankName = (rank: CardRank) => {
  return rankNames[rank];
};

export const cardName = (card: Card) => {
  if (card.rank === CardRank.Joker && card.suit === CardSuit.Joker)
    return "Joker";
  return `${rankName(card.rank)} of ${suitName(card.suit)}`;
};

export const cardAsset = (card: Card) => {
  if (card.suit === CardSuit.None && card.rank === CardRank.None)
    return "card_back";
  if (card.suit === CardSuit.Joker && card.rank === CardRank.Joker)
    return "card_joker";
  return `card_${(card.suit - 1) * 13 + card.rank}`;
};

export const colour = (suit: CardSuit) => {
  if (suit === CardSuit.Diamonds || suit === CardSuit.Hearts)
    return CardColour.Red;
  else return CardColour.Black;
};

export const isJoker = (card: Card) => {
  return card.rank === CardRank.Joker && card.suit === CardSuit.Joker;
};

export const isSpecial = (card: Card) => {
  return (
    card.rank === CardRank.Two ||
    card.rank === CardRank.Ace ||
    card.rank === CardRank.Queen ||
    (card.rank === CardRank.Joker && card.suit === CardSuit.Joker) ||
    (card.rank === CardRank.Jack && colour(card.suit) === CardColour.Black)
  );
};

export const forcesPickup = (card: Card) => {
  return (
    card.rank === CardRank.Two ||
    (card.rank === CardRank.Joker && card.suit === CardSuit.Joker) ||
    (card.rank === CardRank.Jack &&
      (card.suit === CardSuit.Clubs || card.suit === CardSuit.Spades))
  );
};

export const changesSuit = (card: Card) => {
  return (
    (card.rank === CardRank.Joker && card.suit === CardSuit.Joker) ||
    card.rank === CardRank.Ace
  );
};

export const isWithinOne = (card1: Card, card2: Card) => {
  const cardDiff = Math.abs(card1.rank - card2.rank);
  return cardDiff === 1 || cardDiff === 12;
};

export const isWithinOneInOrder = (
  firstCard: Card,
  secondCard: Card,
  ascending: boolean,
) => {
  const cardDiff = firstCard.rank - secondCard.rank;

  if (ascending) {
    //cards must be within 1, in ascending order
    return cardDiff === -1 || cardDiff === 12;
  } else {
    //cards must be within 1, in descending order
    return cardDiff === 1 || cardDiff === -12;
  }
};

export const isListInOrder = (cards: Card[], ascending: boolean) => {
  let inOrder = true;
  let startIndex = 0;

  while (inOrder && startIndex < cards.length - 1) {
    inOrder = isWithinOneInOrder(
      cards[startIndex],
      cards[startIndex + 1],
      ascending,
    );
    startIndex++;
  }

  return inOrder;
};

export const isAscending = (firstCard: Card, secondCard: Card) => {
  if (firstCard.rank === CardRank.Ace && secondCard.rank === CardRank.King)
    return false;
  return secondCard.rank > firstCard.rank || secondCard.rank === CardRank.Ace;
};

export const numberToPickup = (card: Card) => {
  if (!forcesPickup(card)) return 0;
  else {
    switch (card.rank) {
      case CardRank.Two:
        return 2;
      case CardRank.Joker:
        return 4;
      case CardRank.Jack:
        return 7;
      default:
        return 0;
    }
  }
};

export const countSuitFrequency = (cards: Card[]): Map<CardSuit, number> => {
  const counts = new Map<CardSuit, number>([
    [CardSuit.Clubs, 0],
    [CardSuit.Diamonds, 0],
    [CardSuit.Hearts, 0],
    [CardSuit.Spades, 0],
  ]);
  for (const card of cards) {
    if (card.suit !== CardSuit.Joker)
      counts.set(card.suit, counts.get(card.suit)! + 1);
  }
  return counts;
};

export const pack = () => {
  const cards: Card[] = [];
  // Add normal cards
  for (let suit = 1; suit < 5; suit++) {
    for (let rank = 1; rank < 14; rank++) {
      cards.push({ suit, rank });
    }
  }
  // Add two jokers
  cards.push({ suit: CardSuit.Joker, rank: CardRank.Joker });
  cards.push({ suit: CardSuit.Joker, rank: CardRank.Joker });
  return cards;
};
