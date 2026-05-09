import Phaser from "phaser";
import { suits } from "../assets/suits";
import { cardBack, cardJoker, cards } from "./../assets/cards";

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: "PreloadScene" });
  }

  preload() {
    for (let index = 0; index < cards.length; index++) {
      this.load.image(`card_${index + 1}`, cards[index]);
    }
    this.load.image(`card_back`, cardBack);
    this.load.image(`card_joker`, cardJoker);

    suits.forEach((suit: { name: string; asset: string }) =>
      this.load.image(suit.name, suit.asset),
    );
  }

  create() {
    this.scene.start("MainScene");
  }
}
