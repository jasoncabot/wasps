import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  /** When true, gather the fanned cards under the top card so a new card
   *  can land cleanly on the stack without exposing them flickering away. */
  collapsed?: boolean;
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
  collapsed,
}) => {
  const stackSize = Math.min(pickupCount, 6);
  const playedShown = played.length > 0 ? played : [];

  const discardRef = useRef<HTMLDivElement>(null);
  const [discardRect, setDiscardRect] = useState<DOMRect | null>(null);
  const showForced =
    forcedSuit !== CardSuit.None &&
    forcedSuit !== CardSuit.Joker &&
    !!suitImg[forcedSuit];

  useEffect(() => {
    if (!showForced) return;
    const el = discardRef.current;
    if (!el) return;
    const update = () => setDiscardRect(el.getBoundingClientRect());
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [showForced]);

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
        ref={discardRef}
        className="pile pile-discard"
        onClick={onDiscardClick}
        role="button"
        aria-label="Discard pile"
      >
        {playedShown.map((card, i) => {
          const n = playedShown.length;
          const t = n > 1 ? (i - (n - 1) / 2) / ((n - 1) / 2) : 0;
          const offset = collapsed ? 0 : t * Math.min(n * 8, 30);
          const rot = collapsed ? 0 : t * 4;
          return (
            <CardView
              key={`${card.suit}-${card.rank}-${i}`}
              card={card}
              className="discard-card"
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                transform: `translate(${offset}px, 0) rotate(${rot}deg)`,
                zIndex: 20 + i,
              }}
            />
          );
        })}
      </div>
      {showForced &&
        discardRect &&
        createPortal(
          <img
            src={suitImg[forcedSuit]}
            alt=""
            className="forced-suit forced-suit-portal"
            draggable={false}
            style={{
              position: "fixed",
              left: discardRect.right - 16 - 18,
              top: discardRect.bottom - 16 - 18,
            }}
          />,
          document.body,
        )}
    </div>
  );
};
