import React, { useEffect, useRef, useState } from "react";
import { CardView } from "./CardView";

interface Props {
  position: "left" | "top" | "right";
  count: number;
  name: string;
  isCurrent: boolean;
  color: string;
}

const VISIBLE_MAX = 12;

export const OpponentHand: React.FC<Props> = ({
  position,
  count,
  name,
  isCurrent,
  color,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [maxSpread, setMaxSpread] = useState(28);

  useEffect(() => {
    const update = () => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const cx = window.innerWidth / 2;
      if (position === "left") {
        // available = distance from the right edge of the fan container to center, minus buffer
        const available = cx - rect.right - 24;
        setMaxSpread(Math.max(8, available));
      } else if (position === "right") {
        const available = rect.left - cx - 24;
        setMaxSpread(Math.max(8, available));
      } else {
        setMaxSpread(28);
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [position]);

  const shown = Math.min(count, VISIBLE_MAX);

  // Per-card spacing: capped so left/right fans don't reach the centre pile.
  const sideSpacing = Math.min(22, maxSpread / Math.max(1, shown - 1));

  const cards = Array.from({ length: shown }, (_, i) => {
    const t = shown > 1 ? (i - (shown - 1) / 2) / ((shown - 1) / 2) : 0;

    let style: React.CSSProperties = { position: "absolute", zIndex: i };

    if (position === "top") {
      // Horizontal fan mirroring how PlayerHand works, but flipped 180°.
      const spacing = 28;
      const offsetX = t * spacing * (shown - 1) * 0.5;
      // Arc: edge cards dip slightly toward viewer (lower y = nearer top of screen).
      const arcY = -(t * t) * 10;
      const rot = 180 + t * 14;
      style = {
        ...style,
        left: `calc(50% + ${offsetX}px)`,
        top: `calc(50% + ${arcY}px)`,
        transform: `translate(-50%, -50%) rotate(${rot}deg) scale(0.65)`,
      };
    } else {
      // Vertical fan for left/right, mirrored correctly.
      const offset = t * sideSpacing * (shown - 1) * 0.5;
      // Left: 90° base + small CW tilt going downward.
      // Right: -90° base + small CW tilt going downward (negated so it mirrors left).
      const baseRot = position === "left" ? 90 : -90;
      const fanRot = position === "left" ? t * 8 : -t * 8;
      style = {
        ...style,
        left: "50%",
        top: `calc(50% + ${offset}px)`,
        transform: `translate(-50%, -50%) rotate(${baseRot + fanRot}deg) scale(0.65)`,
      };
    }

    return <CardView key={i} faceDown style={style} />;
  });

  return (
    <div ref={ref} className={`opponent opponent-${position}`}>
      <div className="opponent-fan">{cards}</div>
      <div
        className={`opponent-name ${isCurrent ? "is-current" : ""}`}
        style={{ color }}
      >
        {name}
        <span className="opponent-count">{count}</span>
      </div>
    </div>
  );
};
