import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { font } from "../constants/theme";
import { useTheme } from "../context/ThemeContext";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    title: "Track Every Expense",
    desc: "Stop wondering where your money goes. VOIDSPEND helps you track every expense clearly and effortlessly.",
    image: require("../assets/mascot/void1.png"),
  },
  {
    id: "2",
    title: "Control Your Salary Flow",
    desc: "Manage your spending based on your salary, set limits, and avoid running out before payday.",
    image: require("../assets/mascot/void2.png"),
  },
  {
    id: "3",
    title: "Save Smarter, Live Better",
    desc: "Build better financial habits with savings goals, expense tracking, and smarter money decisions.",
    image: require("../assets/mascot/void3.png"),
  },
];

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace("/setup");
    }
  }

  function handleSkip() {
    router.replace("/setup");
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
        <Text style={[styles.skipText, { color: colors.muted }]}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / width);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <Image
              source={item.image}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}
      />

      {/* Bottom Card */}
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <Text style={[styles.title, { color: colors.text }]}>
          {SLIDES[currentIndex].title}
        </Text>
        <Text style={[styles.desc, { color: colors.muted }]}>
          {SLIDES[currentIndex].desc}
        </Text>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === currentIndex ? colors.accent : colors.border,
                  width: i === currentIndex ? 20 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Button */}
        {currentIndex === SLIDES.length - 1 ? (
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: colors.accent }]}
            onPress={handleNext}
          >
            <Text style={[styles.btnText, { color: "#000" }]}>Get Started</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.btnOutline, { borderColor: colors.border }]}
            onPress={handleNext}
          >
            <Text style={[styles.btnOutlineText, { color: colors.text }]}>
              Next →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skipBtn: { position: "absolute", top: 52, right: 24, zIndex: 10 },
  skipText: { fontFamily: font.regular, fontSize: 13, letterSpacing: 1 },
  slide: { alignItems: "center", justifyContent: "center", paddingTop: 80 },
  image: { width: width * 0.75, height: width * 0.75 },
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    paddingBottom: 48,
  },
  title: {
    fontFamily: font.black,
    fontSize: 24,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  desc: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 28,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 28,
    alignItems: "center",
  },
  dot: { height: 8, borderRadius: 999 },
  btn: {
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  btnText: { fontFamily: font.black, fontSize: 14, letterSpacing: 2 },
  btnOutline: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  btnOutlineText: { fontFamily: font.black, fontSize: 14, letterSpacing: 2 },
});
