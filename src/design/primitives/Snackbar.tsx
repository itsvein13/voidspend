import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme";
import { motion, radius } from "../tokens";
import { useReduceMotion } from "../useMotion";
import { Button } from "./Button";
import { initialSnackbarState, snackbarReducer, type SnackbarItem, type SnackbarOptions } from "./snackbarReducer";
import { Text } from "./Text";

type SnackbarApi = {
  show: (options: SnackbarOptions) => void;
  dismiss: (id: number) => void;
};

const SnackbarContext = createContext<SnackbarApi | null>(null);

/** `bottomOffset` lifts snackbars above something that floats at the bottom, such as the dock. */
export function SnackbarProvider({ children, bottomOffset = 0 }: { children: ReactNode; bottomOffset?: number }) {
  const [state, dispatch] = useReducer(snackbarReducer, initialSnackbarState);
  const show = useCallback((options: SnackbarOptions) => dispatch({ type: "show", options }), []);
  const dismiss = useCallback((id: number) => dispatch({ type: "dismiss", id }), []);
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <SnackbarContext.Provider value={api}>
      {children}
      {state.current ? <SnackbarHost key={state.current.id} item={state.current} onDismiss={dismiss} bottomOffset={bottomOffset} /> : null}
    </SnackbarContext.Provider>
  );
}

/** `const { show } = useSnackbar(); show({ message, actionLabel: t.common.undo, onAction })` */
export function useSnackbar(): SnackbarApi {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used inside SnackbarProvider");
  return ctx;
}

function SnackbarHost({ item, onDismiss, bottomOffset }: { item: SnackbarItem; onDismiss: (id: number) => void; bottomOffset: number }) {
  const { color, elevation } = useTheme();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const [paused, setPaused] = useState(false);
  const remaining = useRef(item.duration);
  const startedAt = useRef(0);

  // Touching the message stops the clock, so there is time to reach Undo.
  useEffect(() => {
    if (paused) return;
    startedAt.current = Date.now();
    const timer = setTimeout(() => onDismiss(item.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current -= Date.now() - startedAt.current;
    };
  }, [paused, onDismiss, item.id]);

  // Screen readers do not always read a message that appears without focus.
  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(item.message);
  }, [item.message]);

  const resume = () => setPaused(false);

  return (
    <View style={[StyleSheet.absoluteFill, styles.host, { paddingBottom: insets.bottom + 16 + bottomOffset }]}>
      <Animated.View
        entering={reduce ? FadeIn.duration(0) : FadeInDown.duration(motion.duration.base)}
        exiting={reduce ? FadeOut.duration(0) : FadeOutDown.duration(motion.duration.fast)}
        accessibilityLiveRegion="polite"
        onTouchStart={() => setPaused(true)}
        onTouchEnd={resume}
        onTouchCancel={resume}
        style={[
          styles.bar,
          { backgroundColor: color.surface3, borderColor: color.outline, boxShadow: elevation.floating },
        ]}
      >
        <Text variant="body" style={styles.message}>
          {item.message}
        </Text>
        {item.actionLabel ? (
          <Button
            label={item.actionLabel}
            variant="quiet"
            size="sm"
            onPress={() => {
              item.onAction?.();
              onDismiss(item.id);
            }}
          />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { justifyContent: "flex-end", paddingHorizontal: 16, pointerEvents: "box-none" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 56,
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: radius.button,
  },
  message: { flex: 1 },
});
