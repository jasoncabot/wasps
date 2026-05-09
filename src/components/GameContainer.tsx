import Phaser from "phaser";
import React, { useEffect } from "react";
import { MainScene, PreloadScene } from "../scenes";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  backgroundColor: "#35654D",
  parent: "game-content",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_HORIZONTALLY,
    width: 480,
    height: 640,
  },
  scene: [PreloadScene, MainScene],
  dom: {
    createContainer: false,
  },
  fps: {
    target: 60,
    limit: 60,
  },
  render: {
    pixelArt: false,
  },
};

export const GameContainer = () => {
  useEffect(() => {
    // TODO: In StrictMode this gets called twice - have a better method for initialising phaser here
    if (window.game) return;
    window.game = new Phaser.Game(config);
  });

  return (
    <div className="flex flex-col md:flex-row">
      <div id="game-content" />
    </div>
  );
};
