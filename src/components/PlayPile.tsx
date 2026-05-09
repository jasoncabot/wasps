import React from "react";
import { Card, CardSuit } from "../scenes/objects";
import { CardView } from "./CardView";
import clubs from "../assets/suits/clubs.png";
import diamonds from "../assets/suits/diamonds.png";
import hearts from "../assets/suits/hearts.png";
import spades from "../assets/suits/spades.png";

interface Props {
  played: Card[];
  pickupCount: number;
  forcedSuit: CardSuit;
  onDrawClick: () => void;
  onDiscardClick: () => void;
}

const suitImg: Record<number, string> = {
  [CardSuit.Clubs]: clubs,
  [CardSuit.Diamonds]: diamonds,
  [CardSuit.Hearts]: hearts,
  [CardSuit.Spades]: spades,
};

export const PlayPile: React.FC<Props> = ({
  played,
  pickupCount,
  forcedSuit,
  onDrawClick,
  onDiscardClick,
}) => {
  const stackSize = Math.min(pickupCount, 6);
  const playedShown = played.length > 0 ? played : [];

  return (
    <div className="play-pile">
      {/* Draw pile */}
      <div
        className="pile pile-draw"
        onClick={onDrawClick}
        role="button"
        aria-label="Draw pile"
      >
        <CardView faceDown />
        {Array.from({ length: stackSize }, (_, i) => (
          <CardView
            key={i}
            faceDown
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: `translate(${(i - stackSize / 2) * 3}px, ${-i * 2}px) rotate(${((i * 47) % 9) - 4}deg)`,
              zIndex: 10 + i,
            }}
            className="card-stack"
          />
        ))}
        {pickupCount > 0 && <div className="pickup-badge">{pickupCount}</div>}
      </div>

      {/* Discard pile */}
      <div
        className="pile pile-discard"
        onClick={onDiscardClick}
        role="button"
        aria-label="Discard pile"
      >
        {playedShown.map((card, i) => {
          const n = playedShown.length;
          const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
          const offset = t * Math.min(n * 8, 30);
          const rot = t * 4;
          return (
            <CardView
              key={`${card.suit}-${card.rank}-${i}`}
              card={card}
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${offset}px, 0) rotate(${rot}deg)`,
                zIndex: 20 + i,
                animation:
                  i === n - 1 ? "card-pop-in 220ms ease-out" : undefined,
              }}
            />
          );
        })}
        {forcedSuit !== CardSuit.None &&
          forcedSuit !== CardSuit.Joker &&
          suitImg[forcedSuit] && (
            <img
              src={suitImg[forcedSuit]}
              alt=""
              className="forced-suit"
              draggable={false}
            />
          )}
      </div>
    </div>
  );
};
