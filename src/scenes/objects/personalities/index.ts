import { aggressive } from "./aggressive";
import { balanced } from "./balanced";
import { blocker } from "./blocker";
import { chaotic } from "./chaotic";
import { defensive } from "./defensive";
import { grudge } from "./grudge";
import { mixed } from "./mixed";
import type { Personality } from "./Personality";

export const PERSONALITIES = {
  balanced,
  aggressive,
  defensive,
  blocker,
  grudge,
  chaotic,
} satisfies Record<string, Personality>;

export type PersonalityName = keyof typeof PERSONALITIES;

export const personalityByName = (name: PersonalityName): Personality =>
  PERSONALITIES[name];

export { aggressive, balanced, blocker, chaotic, defensive, grudge, mixed };

export type { MixedPart } from "./mixed";
export type {
  OpponentInfo,
  Personality,
  PersonalityContext,
} from "./Personality";
export type { SuitContext, SuitStrategy } from "./SuitStrategy";
export {
  aggressiveSuit,
  anyOpponentNearWinning,
  chaoticSuit,
  conditionalSuit,
  selfSuit,
} from "./SuitStrategy";
