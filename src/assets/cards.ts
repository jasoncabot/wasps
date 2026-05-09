import { Card, CardRank, CardSuit } from "../scenes/objects/Card";

const modules = import.meta.glob("./updated-cards/*.png", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const lookup: Record<string, string> = {};
for (const [path, url] of Object.entries(modules)) {
  const name = path.split("/").pop()!.replace(".png", "");
  lookup[name] = url;
}

const suitFolder: Record<number, string> = {
  [CardSuit.Clubs]: "Clubs",
  [CardSuit.Diamonds]: "Diamonds",
  [CardSuit.Hearts]: "Hearts",
  [CardSuit.Spades]: "Spades",
};

const rankSlug = (r: CardRank): string => {
  switch (r) {
    case CardRank.Ace:
      return "A";
    case CardRank.Jack:
      return "J";
    case CardRank.Queen:
      return "Q";
    case CardRank.King:
      return "K";
    default:
      return String(r);
  }
};

export const cardImage = (card: Card): string | undefined => {
  if (card.suit === CardSuit.None && card.rank === CardRank.None) return undefined;
  if (card.suit === CardSuit.Joker || card.rank === CardRank.Joker)
    return lookup.cardJoker;
  return lookup[`card${suitFolder[card.suit]}${rankSlug(card.rank)}`];
};

export const cardBack = lookup.cardBack_blue5;
