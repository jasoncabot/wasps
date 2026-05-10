import type { Card } from "../Card";
import type { Player } from "../Player";
import type { PlayContext } from "../TurnBuilder";
import type { TurnCommand, TurnEvent } from "../TurnController";
import type { SuitStrategy } from "./SuitStrategy";

export interface OpponentInfo {
  player: Player;
  handCount: number;
  /** Turns from now until this opponent plays. 1 = the very next player. */
  turnsUntilPlay: number;
  /**
   * The opponent's actual hand. Populated by the AI engine so suit strategies
   * can pick the suit the opponent is shortest in.
   */
  hand?: Card[];
}

export interface PersonalityContext {
  self: Player;
  hand: Card[];
  play: PlayContext;
  /** All valid plays from this hand, pre-computed. Empty if must pick up. */
  validPlays: Card[][];
  /** Opponents in turn order; `opponents[0]` is the next player to play. */
  opponents: OpponentInfo[];
  history: TurnEvent[];
}

export interface Personality {
  readonly name: string;
  chooseTurn(ctx: PersonalityContext): TurnCommand;
  /**
   * Controls which suit is declared after playing an ace or joker.
   * When absent, falls back to the suit embedded by `finalize` (bestSuitForHand).
   */
  readonly suitStrategy?: SuitStrategy;
}
