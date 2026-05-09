import {
  Card,
  CardColour,
  CardRank,
  CardSuit,
  colour,
  forcesPickup,
  isJoker,
  isSpecial,
  numberToPickup,
  pack,
} from "./Card";
import { Player } from "./Player";
import {
  GameContext,
  GameEventHandler,
  TurnCommand,
  TurnHandler,
  TurnEvent,
} from "./TurnController";

export enum PlayDirection {
  Clockwise,
  AntiClockwise,
}

export interface Randomiser {
  shuffle<T>(array: T[]): T[];
  integerInRange(min: number, max: number): number;
}

export default class Game {
  players: Player[];
  eventHandler: GameEventHandler;
  turnController: TurnHandler;

  turns!: Player[];
  hands!: Card[][];
  random: Randomiser;
  direction!: PlayDirection;
  /**
   * All cards that are not in someone's hand or about to be picked up
   */
  pile!: Card[];
  /**
   * The number of cards that will be picked up if you draw on your turn
   */
  forcedPickupCount!: number;
  /**
   * A list of hands that have been played. One element for each turn. Each hand consists of multiple cards
   * since you can play more than one card per turn
   */
  played!: TurnEvent[];
  /**
   * Set when a player explicitly changes the suit with a special suit-changing card. Defaults to None.
   */
  suitChoice!: CardSuit;

  constructor(
    randomiser: Randomiser,
    players: Player[],
    eventHandler: GameEventHandler,
    turnController: TurnHandler,
  ) {
    this.random = randomiser;
    this.players = players;
    this.eventHandler = eventHandler;
    this.turnController = turnController;
    this.reset();
  }

  reset = () => {
    this.direction = PlayDirection.Clockwise;
    this.hands = this.players.map((_) => []);
    this.pile = [];
    this.played = [];
    this.suitChoice = CardSuit.None;
    this.forcedPickupCount = 0;
    this.turns = [];
  };

  currentHand = () => {
    return this.hands;
  };

  currentPlayer = () => {
    return this.turns[0]!;
  };

  nextPlayer = () => {
    return this.turns[1]!;
  };

  deal = (me: Player) => {
    this.reset();

    //make a random player start, then follow on, in a clockwise direction
    const maxPlayerIndex = this.players.length - 1;
    const startingPlayerIndex = this.random.integerInRange(0, maxPlayerIndex);

    for (let i = 0; i < this.players.length; i++) {
      let playerIndex = i + startingPlayerIndex;
      if (playerIndex > maxPlayerIndex)
        playerIndex = playerIndex - this.players.length;
      this.turns.push(this.players[playerIndex]);
    }

    // Open a new pack of cards
    this.pile = this.random.shuffle(pack());

    // deal cards to everyone
    const numberToHold = 7;
    for (let i = 0; i < numberToHold; i++) {
      for (
        let playerIndex = 0;
        playerIndex < this.players.length;
        playerIndex++
      ) {
        const card = this.pile.shift();
        if (!card) throw new Error("Not enough cards in deck to deal");
        this.hands[playerIndex].push(card);
      }
    }

    // Turn over the top card, making sure it's not a wasp
    // if it is then keep drawing from the pile until it is
    let firstCard: Card | undefined = undefined;
    while (!firstCard || isJoker(firstCard)) {
      firstCard = this.pile.shift()!;
      this.played.push({
        played: [firstCard],
        suit: CardSuit.None,
        pickup: [],
        directionChanged: false,
        player: null,
      });
    }

    // Set the cards that will be picked up if we choose to draw
    // This is just the top card from the pile to start with
    this.forcedPickupCount = 0;

    // Notify the current player
    const meIndex = this.players.indexOf(me);

    // Create a list of how many cards each player has, starting with us at index 0
    // and going around clockwise to the last player
    const handCounts = this.hands.map((x) => x.length);
    const names = this.players.map((x) => x.name);
    for (let i = 0; i < meIndex; i++) {
      handCounts.push(handCounts.shift()!);
      names.push(names.shift()!);
    }
    this.eventHandler.onGameStarted(this.hands[meIndex], handCounts, names);
  };

  applyTurn = (playerIndex: number, turn: TurnCommand) => {
    const pickupCard = () => {
      // if the pile has run out, stuff some more cards on it!
      if (this.pile.length === 0) {
        this.played.forEach((turn, idx) => {
          // Don't add this turns cards back into the pile
          if (idx === this.played.length - 1) return;
          turn.played.forEach((card) => this.pile.push(card));
          this.pile = this.random.shuffle(this.pile);
        });
      }
      return this.pile.shift()!;
    };

    let turnEvent: TurnEvent;

    // assume that the cards are valid
    if (turn.pickup) {
      const pickedUp: Card[] = [];
      if (this.forcedPickupCount > 0) {
        // pick up all forced cards
        for (let i = 0; i < this.forcedPickupCount; i++) {
          const card = pickupCard();
          this.hands[playerIndex].push(card);
          pickedUp.push(card);
        }
      } else {
        // draw just a single card
        const card = pickupCard();
        this.hands[playerIndex].push(card);
        pickedUp.push(card);
      }

      // reset the pickup pile
      this.forcedPickupCount = 0;

      turnEvent = {
        played: [],
        suit: CardSuit.None,
        pickup: pickedUp,
        directionChanged: false,
        player: this.players[playerIndex],
      };
      this.played.push(turnEvent);

      // eslint-disable-next-line no-self-assign -- For clarity only - we don't change suit if you pickup
      this.suitChoice = this.suitChoice;
    } else {
      // Take them from the players hand
      this.hands[playerIndex] = this.hands[playerIndex].filter(
        (x) => !turn.played.includes(x),
      );

      // special case where you play a red jack and then a black jack on a black jack
      // which only leaves 7 cards to pick up - but this case is handled later, here
      // we just 'reset'
      if (this.forcedPickupCount > 0) {
        const lastPlayed = this.played[this.played.length - 1].played;
        const lastTopPlayed = lastPlayed[lastPlayed.length - 1];
        if (
          lastTopPlayed.rank === CardRank.Jack &&
          colour(lastTopPlayed.suit) === CardColour.Black
        ) {
          const firstPlayed = turn.played[0];
          if (
            firstPlayed.rank === CardRank.Jack &&
            colour(firstPlayed.suit) === CardColour.Red
          ) {
            // move our pickup pile back to our standard pile
            this.forcedPickupCount = 0;
          }
        }
      }

      //reset how many queens have been played
      let queenCount = 0;

      //find the top card played
      const topPlayed = turn.played[turn.played.length - 1];

      //we only have to determine if a card stacks, if it is special, otherwise just carry on
      if (isSpecial(topPlayed)) {
        //if the top played card is a queen, then we don't pick up any cards, regardless of what else is played
        const shouldAddToPickup = forcesPickup(topPlayed);
        if (!shouldAddToPickup) this.forcedPickupCount = 0;

        //add all the last cards that force pickups or change direction
        let prevCard: Card | undefined = undefined;
        let shouldStack: boolean;
        for (let i = 0; i < turn.played.length; i++) {
          // start at the end of cards played
          const card = turn.played[turn.played.length - (i + 1)];

          //if we are playing more than 1 card, and the previous card played doesn't stack, then stop stacking
          shouldStack =
            (!prevCard || prevCard.rank === card.rank) && isSpecial(card);

          const count = numberToPickup(card);
          if (shouldStack && count > 0 && shouldAddToPickup) {
            this.forcedPickupCount += count;
          }

          if (shouldStack && card.rank === CardRank.Queen) {
            queenCount++;
          }

          prevCard = card;
        }
      } else {
        //we can clear the pickup stack, since the top card isn't special
        this.forcedPickupCount = 0;
      }

      // played some cards
      turnEvent = {
        played: turn.played,
        suit: turn.suit,
        pickup: [],
        directionChanged: queenCount % 2 > 0,
        player: this.players[playerIndex],
      };
      this.played.push(turnEvent);

      this.suitChoice = turn.suit;
    }

    return turnEvent;
  };

  isFinished = () => {
    // the game is finished if at least 1 player has an empty hand
    return !!this.winningPlayer();
  };

  winningPlayer = () => {
    // you win if you get rid of all your cards
    const winnerIndex = this.hands.findIndex((hand) => hand.length === 0);
    if (winnerIndex >= 0) return this.players[winnerIndex];
    return null;
  };

  oppositeDirection = (direction: PlayDirection) => {
    switch (direction) {
      case PlayDirection.Clockwise:
        return PlayDirection.AntiClockwise;
      case PlayDirection.AntiClockwise:
        return PlayDirection.Clockwise;
    }
  };

  changeTurns(changeDirection: boolean) {
    // we can only change turns if we haven't finished playing
    if (!this.isFinished()) {
      const currentPlayer = this.turns.shift()!;

      // either change directions
      if (changeDirection) {
        // or change directions
        this.direction = this.oppositeDirection(this.direction);

        // Assuming we are player 2, we change the orders as follows
        // where the next player is always in position 0
        // [ 2, 3, 0, 1 ] => [ 1, 0, 3, 2 ]
        this.turns.reverse().push(currentPlayer);
      } else {
        // or make the next person go
        this.turns.push(currentPlayer);
      }
    }

    return {
      current: this.turns[0],
      next: this.turns[1],
    };
  }

  processTurn: () => Promise<TurnEvent> = async () => {
    // Start Turn
    const player = this.currentPlayer();
    const playerIndex = this.players.indexOf(player);

    // Process Turn
    const context: GameContext = {
      currentPlayer: player,
      nextPlayer: this.nextPlayer(),
      numberToPickup: this.forcedPickupCount,
      hand: this.hands[playerIndex],
      turns: this.turns,
      history: this.played,
      suit: this.suitChoice,
    };

    const turn = await this.turnController.onTurnStarted(playerIndex, context);
    const event = this.applyTurn(playerIndex, turn);
    this.turnController.onTurnEnded(playerIndex, context, event);

    // End Turn
    const { current, next } = this.changeTurns(event.directionChanged);

    const nextContext: GameContext = {
      currentPlayer: current,
      nextPlayer: next,
      numberToPickup: this.forcedPickupCount,
      hand: this.hands[this.players.indexOf(current)],
      turns: this.turns,
      history: this.played,
      suit: this.suitChoice,
    };
    this.eventHandler.onGameUpdated(nextContext);

    // check if we have a winner
    const winner = this.winningPlayer();
    if (winner) {
      this.eventHandler.onGameOver(winner);
    }

    return event;
  };
}
