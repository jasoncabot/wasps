import { CardSuit } from "../../scenes/objects/Card";
import clubs from "./clubs.png";
import diamonds from "./diamonds.png";
import hearts from "./hearts.png";
import spades from "./spades.png";

export const suits = [
  { name: "suit_clubs", asset: clubs },
  { name: "suit_diamonds", asset: diamonds },
  { name: "suit_hearts", asset: hearts },
  { name: "suit_spades", asset: spades },
];

export const suitAsset = (suit: CardSuit) => {
  switch (suit) {
    case CardSuit.None:
      return undefined;
    case CardSuit.Clubs:
      return "suit_clubs";
    case CardSuit.Diamonds:
      return "suit_diamonds";
    case CardSuit.Hearts:
      return "suit_hearts";
    case CardSuit.Spades:
      return "suit_spades";
    case CardSuit.Joker:
      return undefined;
  }
};
