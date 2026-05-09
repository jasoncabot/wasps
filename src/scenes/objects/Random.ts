import type { Randomiser } from "./Game";

export const defaultRandom: Randomiser = {
  shuffle<T>(array: T[]): T[] {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },
  integerInRange(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
};

export const randomBetween = (min: number, max: number): number =>
  Math.floor(Math.random() * (max - min + 1)) + min;
