import React from "react";
import { CardView } from "./CardView";

interface Props {
  position: "left" | "top" | "right";
  count: number;
  name: string;
  isCurrent: boolean;
  isNext: boolean;
}

const VISIBLE_MAX = 12;

export const OpponentHand: React.FC<Props> = ({
  position,
  count,
  name,
  isCurrent,
  isNext,
}) => {
  const shown = Math.min(count, VISIBLE_MAX);
  const isHorizontal = position === "top";
  const spread = isHorizontal ? 28 : 22;

  const cards = Array.from({ length: shown }, (_, i) => {
    const t = shown > 1 ? (i - (shown - 1) / 2) / ((shown - 1) / 2) : 0;
    const offset = t * spread * (shown - 1) * 0.5;
    const fanRot = t * 8;
    const containerRot =
      position === "top" ? 180 : position === "left" ? 90 : -90;
    return (
      <CardView
        key={i}
        faceDown
        style={{
          position: "absolute",
          left: isHorizontal ? `calc(50% + ${offset}px)` : "50%",
          top: isHorizontal ? "50%" : `calc(50% + ${offset}px)`,
          transform: `translate(-50%, -50%) rotate(${containerRot + fanRot}deg) scale(0.65)`,
          zIndex: i,
        }}
      />
    );
  });

  return (
    <div className={`opponent opponent-${position}`}>
      <div className="opponent-fan">{cards}</div>
      <div
        className={`opponent-name ${isCurrent ? "is-current" : ""} ${
          isNext ? "is-next" : ""
        }`}
      >
        {name}
        <span className="opponent-count">{count}</span>
      </div>
    </div>
  );
};
