import React from "react";
import { CardSuit } from "../scenes/objects";
import clubs from "../assets/suits/clubs.png";
import diamonds from "../assets/suits/diamonds.png";
import hearts from "../assets/suits/hearts.png";
import spades from "../assets/suits/spades.png";

const SUITS = [
  { img: clubs, val: CardSuit.Clubs, label: "Clubs" },
  { img: diamonds, val: CardSuit.Diamonds, label: "Diamonds" },
  { img: hearts, val: CardSuit.Hearts, label: "Hearts" },
  { img: spades, val: CardSuit.Spades, label: "Spades" },
];

interface Props {
  open: boolean;
  onChoose: (suit: CardSuit) => void;
}

export const SuitPicker: React.FC<Props> = ({ open, onChoose }) => {
  if (!open) return null;
  return (
    <div className="suit-picker-backdrop">
      <div className="suit-picker">
        <p>Choose a suit</p>
        <div className="suit-picker-row">
          {SUITS.map(({ img, val, label }) => (
            <button
              key={val}
              onClick={() => onChoose(val)}
              aria-label={label}
              className="suit-button"
            >
              <img src={img} alt={label} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
