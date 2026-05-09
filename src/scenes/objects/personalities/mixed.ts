import type { Personality } from "./Personality";

export interface MixedPart {
  personality: Personality;
  /** Relative weight when picking a personality for this turn. Default 1. */
  weight?: number;
}

/**
 * Compose multiple personalities into one. Each turn, picks a personality
 * by weighted random and uses its decision. Lets you blend, e.g. 70%
 * blocker + 30% chaotic, without hardcoding a new class.
 */
export const mixed = (parts: MixedPart[], name?: string): Personality => {
  if (parts.length === 0) {
    throw new Error("mixed() requires at least one personality");
  }
  const total = parts.reduce((s, p) => s + (p.weight ?? 1), 0);
  return {
    name: name ?? `mixed(${parts.map((p) => p.personality.name).join("+")})`,
    chooseTurn: (ctx) => {
      let pick = Math.random() * total;
      for (const part of parts) {
        pick -= part.weight ?? 1;
        if (pick <= 0) return part.personality.chooseTurn(ctx);
      }
      return parts[parts.length - 1].personality.chooseTurn(ctx);
    },
  };
};
