import React, { useEffect, useState } from "react";
import { GameContainer } from ".";

export const App = () => {
  const [notifications, setNotifications] = useState<
    { id: number; message: string }[]
  >([]);

  useEffect(() => {
    const handler = (e: Event) => {
      const message = (e as CustomEvent<string>).detail;
      const id = Date.now();
      setNotifications((prev) => [...prev, { id, message }]);
      setTimeout(
        () => setNotifications((prev) => prev.filter((n) => n.id !== id)),
        5000,
      );
    };
    window.addEventListener("game-notification", handler);
    return () => window.removeEventListener("game-notification", handler);
  }, []);

  return (
    <div className="App">
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 flex flex-col gap-2 z-50">
        {notifications.map((n) => (
          <div
            key={n.id}
            className="bg-red-600 text-white px-4 py-2 rounded shadow-lg text-sm"
          >
            {n.message}
          </div>
        ))}
      </div>
      <GameContainer />
    </div>
  );
};
