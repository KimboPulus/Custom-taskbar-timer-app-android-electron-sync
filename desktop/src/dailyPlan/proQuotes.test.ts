import { describe, expect, it } from "vitest";
import { getRandomProQuote, proQuotes } from "./proQuotes";

describe("getRandomProQuote", () => {
  it("selects the first and last quotes deterministically", () => {
    expect(getRandomProQuote(() => 0)).toBe(proQuotes[0]);
    expect(getRandomProQuote(() => 0.999999)).toBe(
      proQuotes[proQuotes.length - 1],
    );
  });
});
