import { Image } from "expo-image";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useReduceMotion } from "../useMotion";
import { IconButton } from "./IconButton";
import { clampScale, clampTranslate, doubleTapScale, MIN_ZOOM, stepScale, zoomAbout } from "./zoom";

export type ZoomableImageProps = {
  uri: string;
  /** Names the picture for a screen reader. */
  label: string;
  zoomInLabel: string;
  zoomOutLabel: string;
  closeLabel: string;
  onClose: () => void;
};

/**
 * A photo that fills the screen and can be looked at closely: pinch to zoom about the fingers, drag to move
 * when zoomed, double tap to zoom in and out. A gesture is never the only way: there are buttons for zooming in
 * and out, and one to close it.
 */
export function ZoomableImage({ uri, label, zoomInLabel, zoomOutLabel, closeLabel, onClose }: ZoomableImageProps) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduce = useReduceMotion();
  const scale = useSharedValue(MIN_ZOOM);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // What the gestures started from, so a move is measured against it.
  const startScale = useSharedValue(MIN_ZOOM);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const duration = reduce ? 0 : 180;

  // The buttons zoom about the middle of the view, and keep the photo where it is in proportion.
  const step = (direction: 1 | -1) => {
    const from = scale.get();
    const to = stepScale(from, direction);
    scale.set(withTiming(to, { duration }));
    x.set(withTiming(clampTranslate(zoomAbout(0, x.get(), from, to), to, width), { duration }));
    y.set(withTiming(clampTranslate(zoomAbout(0, y.get(), from, to), to, height), { duration }));
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.set(scale.get());
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((event) => {
      const next = clampScale(startScale.get() * event.scale);
      // Zoom about the fingers: focal points are measured from the middle of the view.
      const focalX = event.focalX - width / 2;
      const focalY = event.focalY - height / 2;
      scale.set(next);
      x.set(clampTranslate(zoomAbout(focalX, startX.get(), startScale.get(), next), next, width));
      y.set(clampTranslate(zoomAbout(focalY, startY.get(), startScale.get(), next), next, height));
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .onStart(() => {
      startX.set(x.get());
      startY.set(y.get());
    })
    .onUpdate((event) => {
      if (scale.get() <= MIN_ZOOM) return;
      x.set(clampTranslate(startX.get() + event.translationX, scale.get(), width));
      y.set(clampTranslate(startY.get() + event.translationY, scale.get(), height));
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      const from = scale.get();
      const to = doubleTapScale(from);
      const focalX = event.x - width / 2;
      const focalY = event.y - height / 2;
      const nextX = to === MIN_ZOOM ? 0 : zoomAbout(focalX, x.get(), from, to);
      const nextY = to === MIN_ZOOM ? 0 : zoomAbout(focalY, y.get(), from, to);
      scale.set(withTiming(to, { duration }));
      x.set(withTiming(clampTranslate(nextX, to, width), { duration }));
      y.set(withTiming(clampTranslate(nextY, to, height), { duration }));
    });

  const gesture = Gesture.Race(doubleTap, Gesture.Simultaneous(pinch, pan));

  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: scale.get() }],
  }));

  return (
    <View style={styles.fill}>
      <GestureDetector gesture={gesture}>
        <Animated.View style={[styles.fill, animated]}>
          <Image source={{ uri }} style={styles.image} contentFit="contain" accessibilityLabel={label} />
        </Animated.View>
      </GestureDetector>
      <View style={[styles.close, { top: insets.top + 8 }]}>
        <IconButton icon="close" label={closeLabel} onPress={onClose} variant="tonal" />
      </View>
      <View style={[styles.controls, { bottom: insets.bottom + 24 }]}>
        <IconButton icon="remove" label={zoomOutLabel} variant="tonal" onPress={() => step(-1)} />
        <IconButton icon="add" label={zoomInLabel} variant="tonal" onPress={() => step(1)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  image: { width: "100%", height: "100%" },
  close: { position: "absolute", right: 16 },
  controls: { position: "absolute", left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 16 },
});
