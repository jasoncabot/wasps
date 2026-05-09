import React, { useEffect, useRef, useState } from "react";
import { PlayDirection } from "../scenes/objects";

interface Props {
  direction: PlayDirection;
}

export const DirectionIndicator: React.FC<Props> = ({ direction }) => {
  const [reversing, setReversing] = useState(false);
  const prev = useRef(direction);

  useEffect(() => {
    if (prev.current !== direction) {
      prev.current = direction;
      setReversing(true);
      const t = window.setTimeout(() => setReversing(false), 800);
      return () => window.clearTimeout(t);
    }
  }, [direction]);

  const cw = direction === PlayDirection.Clockwise;
  const label = cw
    ? "Play direction: clockwise"
    : "Play direction: anticlockwise";

  return (
    <div
      className={`direction-indicator ${reversing ? "is-reversing" : ""}`}
      role="img"
      aria-label={label}
      title={label}
    >
      <div className={`direction-inner ${cw ? "is-cw" : "is-ccw"}`}>
        <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
          {/* 270° arc from top, sweeping clockwise to the left side */}
          <path
            d="M 24 8 A 16 16 0 1 1 8 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3.2"
            strokeLinecap="round"
          />
          {/* Arrowhead at end of arc, pointing up (direction of motion) */}
          <path
            d="M 8 16 L 14 26 L 2 26 Z"
            fill="currentColor"
          />
        </svg>
      </div>
    </div>
  );
};
