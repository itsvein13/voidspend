import {
  emptyKeypad,
  keypadExpression,
  keypadFromAmount,
  keypadHasOperator,
  keypadTotal,
  MAX_DIGITS,
  pressKey,
  type KeypadKey,
  type KeypadState,
} from "./keypad";

const press = (keys: KeypadKey[], from: KeypadState = emptyKeypad) =>
  keys.reduce((state, key) => pressKey(state, key), from);

describe("typing digits", () => {
  it("builds a number", () => {
    expect(press(["2", "5", "0", "0", "0"]).tokens).toEqual(["25000"]);
  });

  it("never keeps a leading zero", () => {
    expect(press(["0", "0", "0"]).tokens).toEqual(["0"]);
    expect(press(["0", "5"]).tokens).toEqual(["5"]);
    expect(press(["000"]).tokens).toEqual(["0"]);
  });

  it("adds three zeros at once", () => {
    expect(press(["2", "5", "000"]).tokens).toEqual(["25000"]);
  });

  it("stops at the longest allowed number", () => {
    const full = press(Array(MAX_DIGITS + 3).fill("9") as KeypadKey[]);
    expect(full.tokens[0]).toHaveLength(MAX_DIGITS);
    expect(pressKey(full, "000").tokens[0]).toHaveLength(MAX_DIGITS);
  });

  it("fits only as many of the three zeros as there is room for", () => {
    const nearFull = press(Array(MAX_DIGITS - 1).fill("9") as KeypadKey[]);
    expect(pressKey(nearFull, "000").tokens[0]).toHaveLength(MAX_DIGITS);
  });
});

describe("adding and subtracting", () => {
  it("adds terms left to right", () => {
    const state = press(["2", "5", "000", "+", "1", "2", "5", "0", "0"]);
    expect(state.tokens).toEqual(["25000", "+", "12500"]);
    expect(keypadTotal(state)).toBe(37500);
    expect(keypadHasOperator(state)).toBe(true);
  });

  it("subtracts, and never goes below zero", () => {
    expect(keypadTotal(press(["9", "-", "4"]))).toBe(5);
    expect(keypadTotal(press(["4", "-", "9"]))).toBe(0);
  });

  it("ignores an operator with nothing before it", () => {
    expect(press(["+"]).tokens).toEqual([]);
    expect(press(["-", "5"]).tokens).toEqual(["5"]);
  });

  it("replaces an operator that is pressed twice", () => {
    expect(press(["5", "+", "-"]).tokens).toEqual(["5", "-"]);
  });

  it("ignores a trailing operator in the total", () => {
    expect(keypadTotal(press(["5", "0", "+"]))).toBe(50);
  });

  it("starts a new term after an operator without a leading zero", () => {
    expect(press(["5", "+", "000"]).tokens).toEqual(["5", "+", "0"]);
  });
});

describe("backspace, clear and equals", () => {
  it("deletes the last digit, then the term, then the operator", () => {
    let state = press(["1", "2", "+", "3", "4"]);
    state = pressKey(state, "back");
    expect(state.tokens).toEqual(["12", "+", "3"]);
    state = pressKey(state, "back");
    expect(state.tokens).toEqual(["12", "+"]);
    state = pressKey(state, "back");
    expect(state.tokens).toEqual(["12"]);
  });

  it("does nothing on an empty keypad", () => {
    expect(pressKey(emptyKeypad, "back")).toBe(emptyKeypad);
  });

  it("clears everything", () => {
    expect(press(["1", "+", "2", "clear"]).tokens).toEqual([]);
  });

  it("collapses a sum into one number on equals", () => {
    expect(press(["2", "+", "3", "equals"]).tokens).toEqual(["5"]);
  });

  it("empties the keypad when the sum is not above zero", () => {
    expect(press(["2", "-", "5", "equals"]).tokens).toEqual([]);
  });

  it("leaves a plain number alone on equals", () => {
    const state = press(["7"]);
    expect(pressKey(state, "equals")).toBe(state);
  });
});

describe("display helpers", () => {
  it("groups thousands and uses a real minus sign", () => {
    expect(keypadExpression(press(["2", "5", "000", "-", "1", "000"]))).toBe("25.000 − 1.000");
  });

  it("can start from an existing amount", () => {
    expect(keypadFromAmount(54300).tokens).toEqual(["54300"]);
    expect(keypadFromAmount(0)).toBe(emptyKeypad);
    expect(keypadFromAmount(-5)).toBe(emptyKeypad);
    expect(keypadFromAmount(NaN)).toBe(emptyKeypad);
  });
});
