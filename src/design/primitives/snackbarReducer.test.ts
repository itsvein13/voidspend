import {
  DEFAULT_SNACKBAR_DURATION,
  initialSnackbarState,
  snackbarReducer,
  type SnackbarState,
} from "./snackbarReducer";

const show = (state: SnackbarState, message: string) =>
  snackbarReducer(state, { type: "show", options: { message } });

describe("snackbarReducer", () => {
  it("shows the first message at once, with the default duration", () => {
    const state = show(initialSnackbarState, "Saved");
    expect(state.current).toMatchObject({ id: 1, message: "Saved", duration: DEFAULT_SNACKBAR_DURATION });
    expect(state.queue).toEqual([]);
  });

  it("queues messages that arrive while one is showing", () => {
    let state = show(initialSnackbarState, "one");
    state = show(state, "two");
    state = show(state, "three");
    expect(state.current?.message).toBe("one");
    expect(state.queue.map((item) => item.message)).toEqual(["two", "three"]);
  });

  it("moves to the next message when the current one is dismissed", () => {
    let state = show(initialSnackbarState, "one");
    state = show(state, "two");
    state = snackbarReducer(state, { type: "dismiss", id: 1 });
    expect(state.current?.message).toBe("two");
    state = snackbarReducer(state, { type: "dismiss", id: 2 });
    expect(state.current).toBeNull();
  });

  it("can drop a queued message without touching the one showing", () => {
    let state = show(initialSnackbarState, "one");
    state = show(state, "two");
    state = snackbarReducer(state, { type: "dismiss", id: 2 });
    expect(state.current?.message).toBe("one");
    expect(state.queue).toEqual([]);
  });

  it("keeps the action and a custom duration", () => {
    const onAction = jest.fn();
    const state = snackbarReducer(initialSnackbarState, {
      type: "show",
      options: { message: "Deleted", actionLabel: "Undo", onAction, duration: 9000 },
    });
    expect(state.current).toMatchObject({ actionLabel: "Undo", duration: 9000 });
    state.current?.onAction?.();
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("ignores a dismiss for a message that is already gone", () => {
    const state = snackbarReducer(initialSnackbarState, { type: "dismiss", id: 99 });
    expect(state).toEqual(initialSnackbarState);
  });
});
