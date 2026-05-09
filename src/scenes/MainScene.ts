import Phaser from "phaser";
import { suitAsset } from "../assets/suits";
import {
  TurnController,
  TurnCommand,
  TurnEvent,
  ViewEventHandler,
  Player,
  Card,
  PlayContext,
  CardSuit,
  changesSuit,
  validatePlay,
  cardAsset,
  CardRank,
} from "./objects";

const NAME_FONT = {
  color: "#ffffff",
  fontSize: "14px",
  fontFamily: "'Roboto'",
};
const PLAYER_POSITIONS = [
  { x: 22, y: 522 - 4, hx: 22, hy: 522, dx: 22, dy: 0 },
  { x: 22, y: 162 - 4, hx: 22, hy: 162, dx: 0, dy: 11 },
  { x: 22, y: 18, hx: 22, hy: 22, dx: 22, dy: 0 },
  { x: 380, y: 162 - 4, hx: 380, hy: 162, dx: 0, dy: 11 },
];

type HandSort = "by-suit" | "by-rank";
export default class MainScene
  extends Phaser.Scene
  implements ViewEventHandler
{
  controller: TurnController;

  selectedCards: Card[];
  handCardImages: Phaser.GameObjects.Image[][];
  nameLabels: Phaser.GameObjects.Text[];
  handSort: HandSort;

  pileImages: Phaser.GameObjects.Image[];

  storedTurnCallback: ((turn: TurnCommand) => void) | undefined;
  playContext?: PlayContext;
  playedImages: Phaser.GameObjects.Image[];
  forcedSuitImage: Phaser.GameObjects.Image | undefined;
  awaitingSuitChange: boolean;

  constructor() {
    super({ key: "MainScene" });

    this.controller = new TurnController({ me: { name: "Jason" } }, this);
    this.selectedCards = [];
    this.handCardImages = [];
    this.nameLabels = [];
    this.pileImages = [];
    this.playedImages = [];
    this.handSort = "by-suit";
    this.awaitingSuitChange = false;
  }

  create() {
    this.controller.startGame();
  }

  promptForSuitChange() {
    // slide in the suits and allow the user to select one
    return new Promise<CardSuit>((resolve, _) => {
      const suits = [
        this.add
          .image(
            this.cameras.main.centerX - 50,
            this.cameras.main.centerY + 148,
            "suit_clubs",
          )
          .setZ(2)
          .setInteractive()
          .on("pointerup", () => choose(CardSuit.Clubs)),
        this.add
          .image(
            this.cameras.main.centerX - 150,
            this.cameras.main.centerY + 148,
            "suit_diamonds",
          )
          .setZ(2)
          .setInteractive()
          .on("pointerup", () => choose(CardSuit.Diamonds)),
        this.add
          .image(
            this.cameras.main.centerX + 50,
            this.cameras.main.centerY + 148,
            "suit_hearts",
          )
          .setZ(2)
          .setInteractive()
          .on("pointerup", () => choose(CardSuit.Hearts)),
        this.add
          .image(
            this.cameras.main.centerX + 150,
            this.cameras.main.centerY + 148,
            "suit_spades",
          )
          .setZ(2)
          .setInteractive()
          .on("pointerup", () => choose(CardSuit.Spades)),
      ];

      const choose = (chosen: CardSuit) => {
        suits.forEach((img) => img.destroy());
        resolve(chosen);
      };
    });
  }

  drawPileImages(count: number) {
    const images = [];
    for (let i = 0; i < count; i++) {
      images.push(
        this.add
          .image(
            this.cameras.main.centerX + 4 * i,
            this.cameras.main.centerY - 4,
            "card_back",
          )
          .setOrigin(0.5, 1)
          .setInteractive()
          .on("pointerup", this.onPickupCards.bind(this)),
      );
    }
    return images;
  }

  /// ViewEventHandler

  onCardsDealt(
    hand: Card[],
    handCounts: number[],
    names: string[],
    context: PlayContext,
  ): void {
    this.handCardImages = new Array(handCounts.length)
      .fill(undefined)
      .map((_) => []);
    this.nameLabels = new Array(handCounts.length).fill(undefined);
    this.playContext = context;
    this.awaitingSuitChange = false;

    // Draw players cards
    // handCounts starts with us at index 0 and goes around clockwise all players, same as names
    names.forEach((name, i) => {
      const cards =
        i === 0
          ? hand
          : new Array(handCounts[i]).fill({
              suit: CardSuit.None,
              rank: CardRank.None,
            } as Card);
      this.drawName(i, name);
      this.drawCards(i, cards);
    });

    // Draw the last played cards
    this.playedImages = [
      this.add
        .image(
          this.cameras.main.centerX,
          this.cameras.main.centerY + 4,
          cardAsset(context.lastCard),
        )
        .setOrigin(0.5, 0)
        .setInteractive()
        .on("pointerup", this.onPlaySelectedCards.bind(this)),
    ];

    // Draw the main pile of cards
    this.add
      .image(
        this.cameras.main.centerX,
        this.cameras.main.centerY - 4,
        "card_back",
      )
      .setOrigin(0.5, 1)
      .setInteractive()
      .on("pointerup", this.onPickupCards.bind(this));

    if (!this.forcedSuitImage) {
      this.forcedSuitImage = this.add.image(
        this.cameras.main.centerX - 90,
        this.cameras.main.centerY,
        "suit_spades",
      );
    }
    this.forcedSuitImage.setVisible(false);

    // Draw the pickup pile on top of this
    this.pileImages = this.drawPileImages(context.numberToPickup);

    this.add
      .circle(460, 600, 20, 0xffffff)
      .setInteractive()
      .on("pointerup", this.onCardSortChanged.bind(this));
  }

  onCardSortChanged() {
    const cards = this.handCardImages[0].map((img) => img.getData("card"));

    if (this.handSort === "by-suit") {
      this.handSort = "by-rank";
    } else {
      this.handSort = "by-suit";
    }

    this.drawCards(0, cards);
  }

  onTurnStarted(
    relativePlayerIndex: number,
    relativeNextPlayerIndex: number,
    aiTurn: Promise<TurnCommand>,
  ) {
    this.nameLabels.forEach((text, i) => {
      if (i === relativePlayerIndex) {
        text.setTint(0x10fb12);
      } else if (i === relativeNextPlayerIndex) {
        text.setTint(0x54fbcc);
      } else {
        text.clearTint();
      }
    });

    return new Promise<TurnCommand>((resolve, _) => {
      if (relativePlayerIndex === 0) {
        // It's my turn!
        this.storedTurnCallback = resolve;
      } else {
        resolve(aiTurn);
      }
    });
  }

  onTurnEnded(
    relativePlayerIndex: number,
    hand: Card[],
    turn: TurnEvent,
  ): void {
    // TODO: we could do some nice animations here, we have all the references to GameObjects
    this.drawCards(relativePlayerIndex, hand);

    if (turn.played.length > 0) {
      this.playedImages.forEach((x) => x.destroy());
      this.playedImages = turn.played.map((card, i) => {
        return this.add
          .image(
            this.cameras.main.centerX + i * 16,
            this.cameras.main.centerY + 4,
            cardAsset(card),
          )
          .setOrigin(0.5, 0)
          .setInteractive()
          .on("pointerup", this.onPlaySelectedCards.bind(this));
      });
    }
  }

  onContextUpdated(context: PlayContext) {
    this.playContext = context;

    // Update the forced suit image
    const forcedSuitTexture = suitAsset(context.suit);
    if (forcedSuitTexture) {
      this.forcedSuitImage?.setTexture(forcedSuitTexture).setVisible(true);
    } else {
      this.forcedSuitImage?.setVisible(false);
    }

    // Update the forced pickup pile count
    if (context.numberToPickup !== this.pileImages.length) {
      this.pileImages.forEach((img) => img.destroy());
      this.pileImages = this.drawPileImages(context.numberToPickup);
    }
  }

  onGameOver(player: Player) {
    this.showErrorNotification(
      `${player.name} wins! Starting new game in 5 seconds...`,
    );

    setTimeout(() => {
      this.selectedCards = [];
      this.handCardImages.forEach((array) =>
        array.forEach((image) => image.destroy()),
      );
      this.nameLabels.forEach((image) => image.destroy());
      this.pileImages.forEach((image) => image.destroy());
      this.playedImages.forEach((image) => image.destroy());

      this.controller.startGame();
    }, 5000);
  }

  onCardSelected(card: Card, image: Phaser.GameObjects.Image): void {
    if (!this.storedTurnCallback) return;
    // Not allowed to change cards whilst choosing suit
    if (this.awaitingSuitChange) return;

    const index = this.selectedCards.indexOf(card);
    if (index >= 0) {
      // already selected, so remove everything past this point
      this.handCardImages[0].forEach((img) =>
        this.setCardImageSelected(img, false),
      );
      this.selectedCards = [];
    } else {
      this.setCardImageSelected(image, true);
      this.selectedCards.push(card);
    }
  }

  setCardImageSelected(image: Phaser.GameObjects.Image, selected: boolean) {
    if (selected) {
      image.setTint(0xff0000, 0xff0000, 0xff00ff, 0xffff00);
    } else {
      image.clearTint();
    }
  }

  drawName(index: number, name: string): void {
    if (!this.nameLabels[index]) {
      this.nameLabels[index] = this.add
        .text(
          PLAYER_POSITIONS[index].x,
          PLAYER_POSITIONS[index].y,
          name,
          NAME_FONT,
        )
        .setOrigin(0, 1);
    }
  }

  drawCards(index: number, cards: Card[]): void {
    if (this.handSort === "by-suit") {
      cards.sort((a, b) =>
        a.suit === b.suit ? a.rank - b.rank : a.suit - b.suit,
      );
    } else {
      cards.sort((a, b) =>
        a.rank === b.rank ? a.suit - b.suit : a.rank - b.rank,
      );
    }

    // we must add / remove specific cards as we can see their faces
    // TODO: we can be more efficient here rather than throwing away the world and re-drawing it all
    this.handCardImages[index].forEach((x) => x.destroy());
    this.handCardImages[index] = cards.map((card, i) => {
      const assetId = cardAsset(card);
      const image = this.add.image(
        PLAYER_POSITIONS[index].hx + i * PLAYER_POSITIONS[index].dx,
        PLAYER_POSITIONS[index].hy + i * PLAYER_POSITIONS[index].dy,
        assetId,
      );

      image.setOrigin(0, 0).setData("card", card);

      if (index === 0) {
        image
          .setInteractive()
          .on("pointerup", () => this.onCardSelected(card, image));
      }

      if (this.selectedCards.indexOf(card) >= 0) {
        this.setCardImageSelected(image, true);
      } else {
        this.setCardImageSelected(image, false);
      }

      return image;
    });
  }

  async onPickupCards(pointer: PointerEvent): Promise<void> {
    if (!this.playContext) {
      this.showErrorNotification("Cannot pickup without a current context");
      return;
    }

    if (this.storedTurnCallback) {
      this.storedTurnCallback({
        pickup: true,
        played: [],
        suit: CardSuit.None,
      });

      this.selectedCards = [];
      this.storedTurnCallback = undefined;
    }
  }

  async onPlaySelectedCards(pointer: PointerEvent): Promise<void> {
    if (!this.playContext) {
      this.showErrorNotification("Cannot play without a current context");
      return;
    }

    const errors = validatePlay(this.selectedCards, this.playContext);

    if (errors.length !== 0) {
      this.showErrorNotification(errors.join("\n"));
      return;
    }

    if (this.storedTurnCallback) {
      const topCard = this.selectedCards[this.selectedCards.length - 1];
      const promptForSuitChange = changesSuit(topCard);

      let suit = CardSuit.None;
      if (promptForSuitChange) {
        this.awaitingSuitChange = true;
        suit = await this.promptForSuitChange();
        this.awaitingSuitChange = false;
      }
      this.storedTurnCallback({
        pickup: false,
        played: this.selectedCards,
        suit: suit,
      });

      this.selectedCards = [];
      this.storedTurnCallback = undefined;
    }
  }

  showErrorNotification(message: string) {
    window.dispatchEvent(
      new CustomEvent("game-notification", { detail: message }),
    );
  }
}
