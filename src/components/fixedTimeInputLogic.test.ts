import { describe, expect, it } from "vitest";
import { getTimeDigitUpdate } from "./fixedTimeInputLogic";

describe("fixed time input digit updates", () => {
  it("advances the caret when typing the digit already in the field", () => {
    expect(getTimeDigitUpdate("00:25:00", 0, "0")).toEqual({
      value: "00:25:00",
      caretPosition: 1,
      changed: false,
    });
    expect(getTimeDigitUpdate("00:25:00", 1, "0")).toEqual({
      value: "00:25:00",
      caretPosition: 3,
      changed: false,
    });
  });

  it("reports changed digits with the next editable caret position", () => {
    expect(getTimeDigitUpdate("00:25:00", 3, "3")).toEqual({
      value: "00:35:00",
      caretPosition: 4,
      changed: true,
    });
  });

  it("keeps deletion on the cleared position even when it was already zero", () => {
    expect(getTimeDigitUpdate("00:25:00", 6, "0", 6)).toEqual({
      value: "00:25:00",
      caretPosition: 6,
      changed: false,
    });
  });
});
