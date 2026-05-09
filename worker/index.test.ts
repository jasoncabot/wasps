import { describe, expect, it } from "vitest";
import worker from "./index";

describe("worker", () => {
  it("exports a fetch handler", () => {
    expect(typeof worker.fetch).toBe("function");
  });
});
