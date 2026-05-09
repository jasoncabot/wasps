import React, { useEffect, useRef, useState } from "react";
import { Card } from "../scenes/objects";
import { CardView } from "./CardView";

interface Props {
  cards: Card[];
  selected: Card[];
  onSelect: (card: Card) => void;
  disabled: boolean;
}

export const PlayerHand: React.FC<Props> = ({
  cards,
  selected,
  onSelect,
  disabled,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [cardW, setCardW] = useState(96);

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      setWidth(ref.current.clientWidth);
      const cs = getComputedStyle(document.documentElement);
      const cw = parseFloat(cs.getPropertyValue("--card-w")) || 96;
      setCardW(cw);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const count = cards.length;
  const padding = 12;
  const usable = Math.max(0, width - padding * 2);

  const ideal = cardW * 0.42;
  const max = count > 1 ? (usable - cardW) / (count - 1) : 0;
  const spacing = count > 1 ? Math.max(8, Math.min(ideal, max)) : 0;
  const fanWidth = count > 0 ? spacing * (count - 1) + cardW : 0;
  const startX = (width - fanWidth) / 2;

  return (
    <div ref={ref} className="player-hand">
      {cards.map((card, i) => {
        const cardKey = `${card.suit}-${card.rank}-${i}`;
        const t = count > 1 ? (i - (count - 1) / 2) / ((count - 1) / 2) : 0;
        const rot = t * 7; // degrees
        const dipY = t * t * 14; // px arc dip
        const isSel = selected.includes(card);
        return (
          <CardView
            key={cardKey}
            card={card}
            selected={isSel}
            disabled={disabled}
            onClick={() => onSelect(card)}
            style={{
              position: "absolute",
              left: `${startX + i * spacing}px`,
              bottom: `${-dipY}px`,
              transform: `rotate(${rot}deg)`,
              zIndex: i + 1,
              ["--lift" as string]: isSel ? "32px" : "0px",
            }}
          />
        );
      })}
    </div>
  );
};
