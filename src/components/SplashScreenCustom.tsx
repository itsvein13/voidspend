import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { colors, font } from "../constants/theme";

type Props = {
  onFinish: () => void;
};

const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&";
const TARGET = "veingh0st";

export default function SplashScreenCustom({ onFinish }: Props) {
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleY = useRef(new Animated.Value(30)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const createdByOpacity = useRef(new Animated.Value(0)).current;
  const [glitchText, setGlitchText] = useState(TARGET);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(titleY, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(300),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.delay(400),
      Animated.timing(createdByOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
    ]).start(() => onFinish());
  }, []);

  // Jalanin glitch effect setelah createdBy muncul
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const startGlitch = () => {
      let iteration = 0;
      const maxIterations = TARGET.length * 3;

      const interval = setInterval(() => {
        setGlitchText(
          TARGET.split("")
            .map((char, i) => {
              if (i < Math.floor(iteration / 3)) return TARGET[i];
              return CHARS[Math.floor(Math.random() * CHARS.length)];
            })
            .join(""),
        );

        iteration++;
        if (iteration >= maxIterations) {
          clearInterval(interval);
          setGlitchText(TARGET);
        }
      }, 50);
    };

    // Delay sesuai animasi sebelumnya
    timeout = setTimeout(startGlitch, 1600);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.center}>
        <Animated.Text
          style={[
            styles.title,
            { opacity: titleOpacity, transform: [{ translateY: titleY }] },
          ]}
        >
          VOIDSPEND
        </Animated.Text>
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          track the drain.
        </Animated.Text>
      </View>

      <Animated.View
        style={[styles.createdByWrap, { opacity: createdByOpacity }]}
      >
        <Text style={styles.createdByLabel}>created by </Text>
        <Text style={styles.createdByName}>{glitchText}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "center",
    alignItems: "center",
  },
  center: {
    alignItems: "center",
  },
  title: {
    fontFamily: font.black,
    fontSize: 36,
    color: colors.text,
    letterSpacing: 6,
  },
  tagline: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.muted,
    letterSpacing: 3,
    marginTop: 10,
  },
  createdByWrap: {
    position: "absolute",
    bottom: 48,
    flexDirection: "row",
    alignItems: "center",
  },
  createdByLabel: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.muted,
    letterSpacing: 2,
  },
  createdByName: {
    fontFamily: font.black,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 2,
  },
});
