import { Card, CardColour, CardRank, CardSuit, colour, forcesPickup, isJoker, isSpecial, numberToPickup, pack } from "./Card";
import { Player } from "./Player";
import { GameContext, GameEventHandler, TurnCommand, TurnController, TurnEvent } from "./TurnController";

enum PlayDirection {
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
    turnController: TurnController;

    turns!: Player[];
    hands!: Card[][];
    random: Randomiser;
    direction!: PlayDirection;
    /**
     * All cards that are not in someone's hand or about to be picked up
     */
    pile!: Card[];
    /**
     * The cards that will be picked up if you draw on your turn
     */
    toPickup!: Card[];
    /**
     * A list of hands that have been played. One element for each turn. Each hand consists of multiple cards
     * since you can play more than one card per turn
     */
    played!: TurnEvent[];
    /**
     * Set when a player explicitly changes the suit with a special suit-changing card. Defaults to None.
     */
    suitChoice!: CardSuit;

    constructor(randomiser: Randomiser, players: Player[], eventHandler: GameEventHandler, turnController: TurnController) {
        this.random = randomiser;
        this.players = players;
        this.eventHandler = eventHandler;
        this.turnController = turnController;
        this.reset();
    }

    reset = () => {
        this.direction = PlayDirection.Clockwise;
        this.hands = this.players.map(_ => []);
        this.pile = [];
        this.played = [];
        this.suitChoice = CardSuit.None;
        this.toPickup = []
        this.turns = []
    }

    currentHand = () => {
        return this.hands
    }

    currentPlayer = () => {
        return this.turns[0]!;
    }

    nextPlayer = () => {
        return this.turns[1]!;
    }

    deal = (me: Player) => {
        this.reset();

        //make a random player start, then follow on, in a clockwise direction
        const maxPlayerIndex = this.players.length - 1;
        const startingPlayerIndex = this.random.integerInRange(0, maxPlayerIndex);

        for (let i = 0; i < this.players.length; i++) {
            let playerIndex = i + startingPlayerIndex;
            if (playerIndex > maxPlayerIndex) playerIndex = playerIndex - this.players.length;
            this.turns.push(this.players[playerIndex]);
        }

        // Open a new pack of cards
        this.pile = this.random.shuffle(pack());

        // deal cards to everyone
        const numberToHold = 7;
        for (let i = 0; i < numberToHold; i++) {
            for (let playerIndex = 0; playerIndex < this.players.length; playerIndex++) {
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
            });
        }

        // Set the cards that will be picked up if we choose to draw
        // This is just the top card from the pile to start with
        this.toPickup.push(this.pile.shift()!);

        // Notify the current player
        const meIndex = this.players.indexOf(me);

        // Create a list of how many cards each player has, starting with us at index 0
        // and going around clockwise to the last player
        const handCounts = this.hands.map(x => x.length);
        const names = this.players.map(x => x.name);
        for (let i = 0; i < meIndex; i++) {
            handCounts.push(handCounts.shift()!);
            names.push(names.shift()!)
        }
        this.eventHandler.onGameStarted(this.hands[meIndex], handCounts, names);
    }

    applyTurn = (playerIndex: number, turn: TurnCommand) => {
        const setPickupStack = (target: number) => {
            while (this.toPickup.length > target) {
                this.pile.push(this.toPickup.shift()!);
            }
            while (this.toPickup.length < target) {
                // if the pile has run out, stuff some more cards on it!
                if (this.pile.length === 0) {
                    this.played.forEach((turn, idx) => {
                        // Don't add this turns cards back into the pile
                        if (idx === this.played.length - 1) return;
                        turn.played.forEach(card => this.pile.push(card));
                        this.pile = this.random.shuffle(this.pile);
                    });
                }

                this.toPickup.push(this.pile.shift()!)
            }
        }

        let turnEvent: TurnEvent;

        // assume that the cards are valid
        if (turn.pickup) {
            // pickup all cards
            const pickedUp: Card[] = [];
            var pickup: Card | undefined = this.toPickup.shift();
            while (pickup) {
                this.hands[playerIndex].push(pickup);
                pickedUp.push(pickup);
                pickup = this.toPickup.shift();
            }

            // reset the pickup pile
            setPickupStack(1);

            turnEvent = {
                played: [],
                suit: CardSuit.None,
                pickup: pickedUp,
                directionChanged: false,
            };
            this.played.push(turnEvent);

            // eslint-disable-next-line no-self-assign -- For clarity only - we don't change suit if you pickup
            this.suitChoice = this.suitChoice;
        } else {

            // Take them frmo the players hand
            this.hands[playerIndex] = this.hands[playerIndex].filter(x => !turn.played.includes(x));

            // special case where you play a red jack and then a black jack on a black jack
            // which only leaves 7 cards to pick up - but this case is handled later, here
            // we just 'reset'
            if (this.toPickup.length > 1) {
                const topPickup = this.toPickup[this.toPickup.length - 1];
                if ((topPickup.rank === CardRank.Jack) && (colour(topPickup.suit) === CardColour.Black)) {
                    const firstCard = turn.played[0];
                    if ((firstCard.rank === CardRank.Jack) && (colour(firstCard.suit) === CardColour.Red)) {
                        // move our pickup pile back to our standard pile
                        setPickupStack(1);
                    }
                }
            }

            //reset how many queens have been played
            let queenCount = 0;

            // How many cards are being force to pick up? If toPickup is just the one
            // default card we have at every turn, then 0 are forced, otherwise stack the amounts
            let pickupCount = this.toPickup.length === 1 ? 0 : this.toPickup.length;

            //find the top card played
            const topPlayed = turn.played[turn.played.length - 1];

            //we only have to determine if a card stacks, if it is special, otherwise just carry on
            if (isSpecial(topPlayed)) {
                //if the top played card is a queen, then we don't pick up any cards, regardless of what else is played
                const shouldAddToPickup = forcesPickup(topPlayed);
                if (!shouldAddToPickup) setPickupStack(1);

                //add all the last cards that force pickups or change direction
                let prevCard: Card | undefined = undefined;
                let shouldStack = true;
                for (let i = 0; i < turn.played.length; i++) {
                    const card = turn.played[turn.played.length - (i + 1)];

                    //if we are playing more than 1 card, and the previous card played doesn't stack, then stop stacking
                    shouldStack = ((!prevCard || (prevCard.rank === card.rank)) && isSpecial(card));

                    const count = numberToPickup(card);
                    if (shouldStack && (count > 0) && shouldAddToPickup) {
                        pickupCount += count;
                    }

                    if (shouldStack && (card.rank === CardRank.Queen)) {
                        queenCount++;
                    }

                    prevCard = card;
                }
                setPickupStack(pickupCount);
            } else {
                //we can clear the pickup stack, since the top card isn't special
                setPickupStack(1);
            }

            // played some cards
            turnEvent = {
                played: turn.played,
                suit: turn.suit,
                pickup: [],
                directionChanged: (queenCount % 2) > 0

            };
            this.played.push(turnEvent);

            this.suitChoice = turn.suit;
        }

        return turnEvent;
    }

    isFinished = () => {
        // the game is finished if at least 1 player has an empty hand
        return !!this.winningPlayer();
    }

    winningPlayer = () => {
        // you win if you get rid of all your cards
        const winnerIndex = this.hands.findIndex(hand => hand.length === 0);
        if (winnerIndex >= 0) return this.players[winnerIndex];
        return null;
    }

    oppositeDirection = (direction: PlayDirection) => {
        switch (direction) {
            case PlayDirection.Clockwise: return PlayDirection.AntiClockwise;
            case PlayDirection.AntiClockwise: return PlayDirection.Clockwise;
        }
    }

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
            next: this.turns[1]
        }
    }

    processTurn: () => Promise<TurnEvent> = async () => {

        // Start Turn
        const player = this.currentPlayer();
        const playerIndex = this.players.indexOf(player);

        // Process Turn
        const context: GameContext = {
            currentPlayer: player,
            nextPlayer: this.nextPlayer(),
            numberToPickup: this.toPickup.length,
            hand: this.hands[playerIndex],
            turns: this.turns,
            history: this.played,
            suit: this.suitChoice
        };

        const turn = await this.turnController.onTurnStarted(playerIndex, context);
        const event = this.applyTurn(playerIndex, turn);
        this.turnController.onTurnEnded(playerIndex, context, event);

        // End Turn
        const { current, next } = this.changeTurns(event.directionChanged);

        const nextContext: GameContext = {
            currentPlayer: current,
            nextPlayer: next,
            numberToPickup: this.toPickup.length,
            hand: this.hands[this.players.indexOf(current)],
            turns: this.turns,
            history: this.played,
            suit: this.suitChoice
        };
        this.eventHandler.onGameUpdated(nextContext);

        // check if we have a winner
        const winner = this.winningPlayer();
        if (winner) {
            this.eventHandler.onGameOver(winner);
        }

        return event;
    }
}
