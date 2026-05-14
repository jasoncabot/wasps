import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { Card } from "../scenes/objects";
import { cardImage, cardBack } from "../assets/cards";

export interface Flight {
  /** Card to show face-up. Required if either side is face-up. */
  card?: Card;
  /** Centre point where the card starts (viewport coords). */
  fromX: number;
  fromY: number;
  /** Rotation (deg) at start. */
  fromRot: number;
  /** Centre point where the card ends. */
  toX: number;
  toY: number;
  toRot: number;
  /** True if the card starts face-down. */
  startFaceDown: boolean;
  /** True if the card ends face-down. */
  endFaceDown: boolean;
  /** Travel duration in ms. */
  duration: number;
  /** Delay before the flight starts. */
  delay?: number;
  /** Scale at start (default 1). */
  startScale?: number;
  /** Scale at end (default 1). Use ~0.65 to match opponent hand cards. */
  endScale?: number;
  /**
   * z-index for the flying card wrap. Set to match the target hand slot so
   * the z-order during flight matches the static hand order on landing.
   */
  zIndex?: number;
  /**
   * If true, the flight remains rendered (at its end state) after the
   * animation finishes. The returned promise still resolves on land; call
   * clearPersisted() to remove all persisted flights.
   */
  persistAfterLand?: boolean;
}

export interface FlyingCardsHandle {
  fly(flight: Flight): Promise<void>;
  clearPersisted(): void;
}

interface FlightInternal extends Flight {
  id: number;
}

export const FlyingCardsLayer = forwardRef<FlyingCardsHandle>((_, ref) => {
  const [flights, setFlights] = useState<FlightInternal[]>([]);
  const idRef = useRef(0);
  const resolveMap = useRef(new Map<number, () => void>());
  const persistedRef = useRef(new Set<number>());

  useImperativeHandle(
    ref,
    () => ({
      fly(flight) {
        return new Promise<void>((resolve) => {
          idRef.current += 1;
          const id = idRef.current;
          resolveMap.current.set(id, resolve);
          setFlights((prev) => [...prev, { ...flight, id }]);
        });
      },
      clearPersisted() {
        const ids = persistedRef.current;
        if (ids.size === 0) return;
        setFlights((prev) => prev.filter((x) => !ids.has(x.id)));
        persistedRef.current = new Set();
      },
    }),
    [],
  );

  const onDone = (id: number, persist: boolean) => {
    const resolve = resolveMap.current.get(id);
    resolveMap.current.delete(id);
    if (persist) {
      // Keep the flight rendered at its end state; caller will clear it.
      persistedRef.current.add(id);
      resolve?.();
      return;
    }
    // Resolve first so the caller's .then() (e.g. revealing the static
    // hand slot underneath) is queued, then defer removing the flight by
    // one frame. The flying card's end state and the static slot overlap
    // exactly, so the extra frame paints them on top of each other — no
    // gap or flash when we finally unmount the flyer.
    resolve?.();
    requestAnimationFrame(() => {
      setFlights((prev) => prev.filter((x) => x.id !== id));
    });
  };

  return (
    <div className="flying-cards-layer">
      {flights.map((f) => (
        <FlyingCard
          key={f.id}
          flight={f}
          onDone={() => onDone(f.id, f.persistAfterLand ?? false)}
        />
      ))}
    </div>
  );
});

FlyingCardsLayer.displayName = "FlyingCardsLayer";

const FlyingCard: React.FC<{
  flight: FlightInternal;
  onDone: () => void;
}> = ({ flight, onDone }) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const inner = innerRef.current;
    if (!wrap || !inner) return;

    const cardW = wrap.offsetWidth;
    const cardH = wrap.offsetHeight;
    const fx = flight.fromX - cardW / 2;
    const fy = flight.fromY - cardH / 2;
    const tx = flight.toX - cardW / 2;
    const ty = flight.toY - cardH / 2;
    const mx = (fx + tx) / 2;
    const my = (fy + ty) / 2 - 28; // slight arc

    const sScale = flight.startScale ?? 1;
    const eScale = flight.endScale ?? 1;
    // A subtle "lift" so the card pops up briefly mid-flight.
    const midScale = Math.max(sScale, eScale) * 1.05;
    const moveAnim = wrap.animate(
      [
        {
          transform: `translate(${fx}px, ${fy}px) rotate(${flight.fromRot}deg) scale(${sScale * 0.95})`,
        },
        {
          transform: `translate(${mx}px, ${my}px) rotate(${
            (flight.fromRot + flight.toRot) / 2
          }deg) scale(${midScale})`,
          offset: 0.5,
        },
        {
          transform: `translate(${tx}px, ${ty}px) rotate(${flight.toRot}deg) scale(${eScale})`,
        },
      ],
      {
        duration: flight.duration,
        delay: flight.delay ?? 0,
        easing: "cubic-bezier(.22,.9,.32,1)",
        fill: "both",
      },
    );

    // Stay invisible during the start delay so a stack of staggered cards
    // doesn't pile up over the source pile and darken it.
    const fadeAnim = wrap.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      {
        duration: 90,
        delay: flight.delay ?? 0,
        easing: "linear",
        fill: "both",
      },
    );

    let flipAnim: Animation | null = null;
    if (flight.startFaceDown !== flight.endFaceDown) {
      flipAnim = inner.animate(
        [
          { transform: "rotateY(0deg)" },
          { transform: "rotateY(180deg)" },
        ],
        {
          duration: flight.duration,
          delay: flight.delay ?? 0,
          easing: "ease-in-out",
          fill: "both",
        },
      );
    }

    moveAnim.onfinish = () => onDone();
    return () => {
      moveAnim.cancel();
      flipAnim?.cancel();
      fadeAnim.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const faceImg =
    flight.card && cardImage(flight.card) ? cardImage(flight.card)! : cardBack;
  const frontSrc = flight.startFaceDown ? cardBack : faceImg;
  const backSrc = flight.endFaceDown ? cardBack : faceImg;

  // Render the first paint at the start position with opacity 0 so Safari
  // doesn't briefly show a card (with shadow) at the layer origin before
  // the Web Animations API takes over inside useEffect.
  const sScaleInit = (flight.startScale ?? 1) * 0.95;
  const initialStyle: React.CSSProperties = {
    opacity: 0,
    transform: `translate(${flight.fromX}px, ${flight.fromY}px) translate(-50%, -50%) rotate(${flight.fromRot}deg) scale(${sScaleInit})`,
    zIndex: flight.zIndex,
  };

  return (
    <div ref={wrapRef} className="flying-card-wrap" style={initialStyle}>
      <div ref={innerRef} className="flying-card-inner">
        <img
          className="flying-card-face flying-card-front"
          src={frontSrc}
          alt=""
          draggable={false}
        />
        <img
          className="flying-card-face flying-card-back"
          src={backSrc}
          alt=""
          draggable={false}
        />
      </div>
    </div>
  );
};
