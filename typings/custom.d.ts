interface ResponseWithSocket extends Response {
  webSocket: WebSocket;
}

interface Window {
  game: Phaser.Game | undefined;
}
