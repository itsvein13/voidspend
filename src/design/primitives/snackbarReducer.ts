// The snackbar queue as a pure reducer: one message shows at a time, the rest wait.
export type SnackbarOptions = {
  message: string;
  /** For example "Undo". Pressing it runs onAction and closes the message. */
  actionLabel?: string;
  onAction?: () => void;
  /** Milliseconds on screen. Defaults to 6 seconds, long enough to reach Undo. */
  duration?: number;
};

export type SnackbarItem = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  duration: number;
};

export type SnackbarState = {
  current: SnackbarItem | null;
  queue: SnackbarItem[];
  nextId: number;
};

export type SnackbarAction =
  | { type: "show"; options: SnackbarOptions }
  | { type: "dismiss"; id: number };

export const DEFAULT_SNACKBAR_DURATION = 6000;

export const initialSnackbarState: SnackbarState = { current: null, queue: [], nextId: 1 };

export function snackbarReducer(state: SnackbarState, action: SnackbarAction): SnackbarState {
  switch (action.type) {
    case "show": {
      const item: SnackbarItem = {
        id: state.nextId,
        message: action.options.message,
        actionLabel: action.options.actionLabel,
        onAction: action.options.onAction,
        duration: action.options.duration ?? DEFAULT_SNACKBAR_DURATION,
      };
      if (!state.current) {
        return { ...state, current: item, nextId: state.nextId + 1 };
      }
      return { ...state, queue: [...state.queue, item], nextId: state.nextId + 1 };
    }
    case "dismiss": {
      if (state.current?.id === action.id) {
        const [next, ...rest] = state.queue;
        return { ...state, current: next ?? null, queue: rest };
      }
      return { ...state, queue: state.queue.filter((item) => item.id !== action.id) };
    }
  }
}
