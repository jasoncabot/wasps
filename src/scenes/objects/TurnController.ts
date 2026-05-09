import { Card, CardRank, CardSuit } from "./Card";
import Game, { PlayDirection } from "./Game";
import {
  balanced,
  PERSONALITIES,
  type OpponentInfo,
  type Personality,
} from "./personalities";
import { Player } from "./Player";
import { defaultRandom, randomBetween } from "./Random";
import { findTopCard, findValidPlays, PlayContext } from "./TurnBuilder";

enum GameState {
  Initialising,
  Started,
  Finished,
}

export interface GameContext {
  currentPlayer: Player;
  nextPlayer: Player;
  numberToPickup: number;
  hand: Card[];
  turns: Player[];
  history: TurnEvent[];
  suit: CardSuit;
}

/**
 * Describes the play that a player makes on their turn, either a pickup or card play.
 */
export interface TurnCommand {
  /**
   * The ordered set of cards that were played on this turn, can be an empty array. Defaults to an empty array.
   */
  played: Card[];
  /**
   * The suit that this player changed to, or None if no suit chosen. Also None if the player just played a normal card. Defaults to None.
   */
  suit: CardSuit;
  /**
   * Whether or not the player decided to pickup on this turn. Defaults to false.
   */
  pickup: boolean;
}

/**
 * Describes the result of the TurnCommand
 */
export interface TurnEvent {
  /**
   * The ordered set of cards that were played on this turn, can be an empty array. Defaults to an empty array.
   */
  played: Card[];
  /**
   * The suit that this player changed to, or None if no suit chosen. Also None if the player just played a normal card. Defaults to None.
   */
  suit: CardSuit;
  /**
   * The cards that this player picked up as part of their turn. Defaults to an empty array. Cards will be Suit and Rank None for an opponent.
   */
  pickup: Card[];
  /**
   * Whether this turn resulted in the direction of play being reversed
   */
  directionChanged: boolean;
}

export interface ViewEventHandler {
  /**
   * Called when a game has finished it's initial set up
   */
  onCardsDealt(
    hand: Card[],
    handCounts: number[],
    names: string[],
    context: PlayContext,
  ): void;

  /**
   * Called before the current player has started their turn
   * @param relativePlayerIndex The index of the current player, relative to you at index 0
   * @param relativeNextPlayerIndex The index of the next player, relative to you at index 0
   */
  onTurnStarted(
    relativePlayerIndex: number,
    relativeNextPlayerIndex: number,
    aiTurn: Promise<TurnCommand>,
  ): Promise<TurnCommand>;

  /**
   * Called after the current player has taken their turn
   * @param relativePlayerIndex The index of the current player, relative to you at index 0
   * @param hand The cards in the current players hand. An array of rank/suit None for opponents
   * @param turn The description of the current players turn
   */
  onTurnEnded(relativePlayerIndex: number, hand: Card[], turn: TurnEvent): void;

  /**
   * Called after a turn has finished and the game state has been updated
   * @param context The current state of the game
   */
  onContextUpdated(context: PlayContext): void;

  onGameOver(player: Player): void;
}

export interface GameEventHandler {
  onGameStarted(hand: Card[], handCounts: number[], names: string[]): void;
  onGameUpdated(context: GameContext): void;
  onGameOver(winner: Player): void;
}

export interface TurnController {
  onTurnStarted(
    playerIndex: number,
    context: GameContext,
  ): Promise<TurnCommand>;
  onTurnEnded(
    playerIndex: number,
    context: GameContext,
    event: TurnEvent,
  ): void;
}

export interface AiOpponent {
  player: Player;
  personality: Personality;
}

export interface PlayerOptions {
  me: Player;
  /**
   * Three AI opponents in clockwise seating order. If omitted, a default
   * line-up of distinct personalities is used.
   */
  opponents?: AiOpponent[];
}

const DEFAULT_OPPONENT_NAMES = ["Riley", "Morgan", "Casey"];

const ALL_PERSONALITIES = Object.values(PERSONALITIES);

const randomPersonalities = (): Personality[] =>
  ALL_PERSONALITIES.slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

// Used as a final safety net so a missing personality never crashes a turn.
const FALLBACK_PERSONALITY: Personality = balanced;

// A Game knows all players, all hands. A TurnController knows who we are.
export class TurnController implements TurnController {
  game: Game;
  state: GameState;
  me: Player;
  players: Player[];
  /** Personality keyed by player name. `me` has no entry. */
  personalities: Map<string, Personality>;
  viewEventHandler: ViewEventHandler;

  constructor(
    playerOptions: PlayerOptions,
    viewEventHandler: ViewEventHandler,
  ) {
    this.state = GameState.Initialising;
    this.me = playerOptions.me;
    this.viewEventHandler = viewEventHandler;

    const opponents = playerOptions.opponents ?? DEFAULT_OPPONENT_NAMES.map(
      (name) => ({ player: { name }, personality: balanced }),
    );
    if (opponents.length !== 3) {
      throw new Error("TurnController expects exactly 3 AI opponents");
    }

    this.players = [
      opponents[0].player,
      playerOptions.me,
      opponents[1].player,
      opponents[2].player,
    ];

    this.personalities = new Map();
    for (const o of opponents) {
      this.personalities.set(o.player.name, o.personality);
    }

    //create a new game
    //set up the players
    this.game = new Game(defaultRandom, this.players, this, this);
  }

  onGameStarted(hand: Card[], handCounts: number[], names: string[]) {
    this.state = GameState.Started;

    const lastPlayedCards =
      this.game.played[this.game.played.length - 1].played;
    const playContext: PlayContext = {
      lastCard: lastPlayedCards[lastPlayedCards.length - 1],
      numberToPickup: this.game.forcedPickupCount,
      suit: CardSuit.None,
      direction: this.game.direction,
    };
    this.viewEventHandler.onCardsDealt(hand, handCounts, names, playContext);
  }

  onGameOver(winner: Player) {
    this.state = GameState.Finished;

    this.viewEventHandler.onGameOver(winner);
  }

  onGameUpdated(context: GameContext) {
    const lastCard = findTopCard(context.history);

    this.viewEventHandler.onContextUpdated({
      lastCard: lastCard,
      numberToPickup: context.numberToPickup,
      suit: context.suit,
      direction: this.game.direction,
    });
  }

  onTurnStarted(
    playerIndex: number,
    context: GameContext,
  ): Promise<TurnCommand> {
    let relativePlayerIndex = playerIndex - this.players.indexOf(this.me);
    if (relativePlayerIndex < 0)
      relativePlayerIndex = this.players.length + relativePlayerIndex;

    let relativeNextPlayerIndex =
      this.players.indexOf(context.nextPlayer) - this.players.indexOf(this.me);
    if (relativeNextPlayerIndex < 0)
      relativeNextPlayerIndex = this.players.length - relativeNextPlayerIndex;

    // Calculate a move for the current player, regardless of if it's a human or not
    const aiTurn = new Promise<TurnCommand>((resolve, _) => {
      const startTime = performance.now();
      const turn = this.computeAiTurn(context);
      const elapsed = performance.now() - startTime;

      // should take between 750 - 2000 to move
      const remainingThinkingTime = Math.max(
        0,
        randomBetween(750, 2000) - elapsed,
      );

      // add in some fake thinking time
      setTimeout(() => resolve(turn), remainingThinkingTime);
    });

    // Allow the player to make a move without having to send the full game context
    return this.viewEventHandler.onTurnStarted(
      relativePlayerIndex,
      relativeNextPlayerIndex,
      aiTurn,
    );
  }

  onTurnEnded(
    playerIndex: number,
    context: GameContext,
    event: TurnEvent,
  ): void {
    let relativePlayerIndex = playerIndex - this.players.indexOf(this.me);
    if (relativePlayerIndex < 0)
      relativePlayerIndex = this.players.length + relativePlayerIndex;

    const hand: Card[] =
      relativePlayerIndex === 0
        ? this.game.hands[playerIndex]
        : this.game.hands[playerIndex].map((_) => {
            return { suit: CardSuit.None, rank: CardRank.None };
          });

    this.viewEventHandler.onTurnEnded(relativePlayerIndex, hand, event);
  }

  /**
   * Build a PersonalityContext from the current GameContext and dispatch to
   * the personality registered for the current player. Falls back to the
   * balanced personality if none is registered (e.g. for `me` — the human's
   * pre-computed move is never actually used).
   */
  private computeAiTurn(context: GameContext): TurnCommand {
    const personality =
      this.personalities.get(context.currentPlayer.name) ??
      FALLBACK_PERSONALITY;

    const lastCard = findTopCard(context.history);
    const play: PlayContext = {
      lastCard,
      numberToPickup: context.numberToPickup,
      suit: context.suit,
      direction: this.game.direction ?? PlayDirection.Clockwise,
    };
    const validPlays = findValidPlays(context.hand, play);

    // Build opponent info in turn order, starting from the next player.
    const opponents: OpponentInfo[] = context.turns
      .slice(1)
      .map((player, idx) => ({
        player,
        handCount: this.game.hands[this.players.indexOf(player)].length,
        turnsUntilPlay: idx + 1,
      }));

    return personality.chooseTurn({
      self: context.currentPlayer,
      hand: context.hand,
      play,
      validPlays,
      opponents,
      history: context.history,
    });
  }

  private randomisePersonalities() {
    const picks = randomPersonalities();
    const aiPlayers = this.players.filter((p) => p !== this.me);
    for (let i = 0; i < aiPlayers.length; i++) {
      this.personalities.set(aiPlayers[i].name, picks[i]);
    }
  }

  public startGame = async () => {
    this.randomisePersonalities();
    // deal cards to every player
    this.game.deal(this.me);

    while (this.state === GameState.Started) {
      await this.game.processTurn();
    }

    console.log("Game is over :)");
  };
}
