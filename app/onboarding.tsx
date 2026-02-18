/**
 * Onboarding — the first scroll.
 *
 * Jordan Singer: product poetry in three breaths.
 * Mariana Castilho: fluid, swipeable, alive.
 */
import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  type ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { color, space, radius } from "@/lib/design";
import { haptic } from "@/lib/haptics";

const { width: W } = Dimensions.get("window");
const ONBOARDED_KEY = "doomscroll:onboarded";

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  visual: string;
}

const slides: Slide[] = [
  {
    id: "1",
    title: "master any\ncodebase",
    subtitle: "Point at a GitHub repo.\nWe turn it into a deck of code cards.",
    visual: "ƒ  τ  ◆  ◇  □",
  },
  {
    id: "2",
    title: "swipe to\nlearn",
    subtitle:
      "Swipe right if you get it.\nSwipe left to see it again.\nSwipe up to skip.",
    visual: "← again   ↑ skip   got it →",
  },
  {
    id: "3",
    title: "build a\nstreak",
    subtitle:
      "Master cards through spaced repetition.\nLearn a little every day.\nThe code sticks.",
    visual: "🔥",
  },
];

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]) {
        setActiveIndex(viewableItems[0].index ?? 0);
      }
    }
  ).current;

  const handleDone = async () => {
    haptic.medium();
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    router.replace("/");
  };

  const handleNext = () => {
    haptic.light();
    if (activeIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1 });
    } else {
      handleDone();
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width: W }]}>
            <Text style={styles.visual}>{item.visual}</Text>
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Bottom controls */}
      <View
        style={[styles.controls, { paddingBottom: insets.bottom + space.xl }]}
      >
        {/* Dots */}
        <View style={styles.dots}>
          {slides.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    i === activeIndex ? color.text : color.borderSubtle,
                  width: i === activeIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Button */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>
            {activeIndex === slides.length - 1 ? "let's go" : "next"}
          </Text>
        </Pressable>

        {/* Skip */}
        {activeIndex < slides.length - 1 && (
          <Pressable onPress={handleDone}>
            <Text style={styles.skipText}>skip</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Check if user has completed onboarding */
export async function hasOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARDED_KEY)) === "true";
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  slide: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: space.xxl,
    gap: space.lg,
  },
  visual: {
    fontSize: 40,
    color: color.textTertiary,
    letterSpacing: 8,
    textAlign: "center",
    marginBottom: space.xl,
  },
  slideTitle: {
    fontSize: 40,
    fontWeight: "800",
    color: color.text,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  slideSubtitle: {
    fontSize: 17,
    lineHeight: 26,
    color: color.textSecondary,
  },
  controls: {
    alignItems: "center",
    gap: space.lg,
    paddingHorizontal: space.xxl,
  },
  dots: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  button: {
    width: "100%",
    height: 56,
    backgroundColor: color.text,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: "700",
    color: color.textInverse,
    letterSpacing: 0.5,
  },
  skipText: {
    fontSize: 15,
    color: color.textTertiary,
    paddingVertical: space.sm,
  },
});
