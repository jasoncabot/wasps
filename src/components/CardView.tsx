import React from "react";
import { Card } from "../scenes/objects";
import { cardImage, cardBack } from "../assets/cards";
import { cardName } from "../scenes/objects/Card";

interface Props {
  card?: Card;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  ariaLabel?: string;
}

export const CardView: React.FC<Props> = ({
  card,
  faceDown,
  selected,
  disabled,
  onClick,
  style,
  className,
  ariaLabel,
}) => {
  const src = faceDown || !card ? cardBack : (cardImage(card) ?? cardBack);
  const label =
    ariaLabel ?? (faceDown || !card ? "Hidden card" : cardName(card));
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      aria-label={label}
      aria-pressed={selected}
      aria-disabled={disabled}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(e) => {
        if (!onClick || disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      className={`card ${selected ? "card-selected" : ""} ${
        disabled ? "card-disabled" : ""
      } ${className ?? ""}`}
      style={style}
    >
      <img src={src} alt="" draggable={false} />
    </div>
  );
};
