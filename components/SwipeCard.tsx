/**
 * SwipeCard — the atomic unit of doomscroll.
 *
 * Mariana Castilho: fluid — border color bleeds with direction.
 * Emil Kowalski: motion grammar — rotation tracks translation.
 * Susan Kare: type symbol, one glyph, one color.
 * Muriel Cooper: code in dark space, gradient depth.
 * Marc Rousavy: haptic at every threshold crossing.
 */
import { Dimensions, StyleSheet, View, Text, ScrollView } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  interpolateColor,
  Extrapolation,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import type { CodeCard, CardProgress } from "@/types";
import { color, space, radius, spring, swipe, cardTypes, difficulty } from "@/lib/design";
import { SyntaxHighlight } from "@/lib/syntax";
import { haptic } from "@/lib/haptics";
import { getSeenDots } from "@/lib/repetition";

const { width: W } = Dimensions.get("window");
const THRESHOLD = W * swipe.threshold;

interface Props {
  card: CodeCard;
  cardProgress?: CardProgress;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
}

export function SwipeCard({
  card,
  cardProgress,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: Props) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const hasTriggeredHaptic = useSharedValue(false);

  const gesture = Gesture.Pan()
    .onUpdate((e) => {
      tx.value = e.translationX;
      ty.value = e.translationY;

      const past =
        Math.abs(e.translationX) > THRESHOLD ||
        e.translationY < swipe.upThreshold;
      if (past && !hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = true;
        runOnJS(haptic.light)();
      } else if (!past && hasTriggeredHaptic.value) {
        hasTriggeredHaptic.value = false;
      }
    })
    .onEnd((e) => {
      // Skip
      if (
        e.translationY < swipe.upThreshold ||
        e.velocityY < -swipe.velocityThreshold
      ) {
        ty.value = withSpring(-800, spring.silk);
        runOnJS(haptic.medium)();
        runOnJS(onSwipeUp)();
        return;
      }
      // Got it
      if (
        e.translationX > THRESHOLD ||
        e.velocityX > swipe.velocityThreshold
      ) {
        tx.value = withSpring(W * 1.5, spring.silk);
        runOnJS(haptic.medium)();
        runOnJS(onSwipeRight)();
        return;
      }
      // Again
      if (
        e.translationX < -THRESHOLD ||
        e.velocityX < -swipe.velocityThreshold
      ) {
        tx.value = withSpring(-W * 1.5, spring.silk);
        runOnJS(haptic.medium)();
        runOnJS(onSwipeLeft)();
        return;
      }
      // Snap back
      tx.value = withSpring(0, spring.responsive);
      ty.value = withSpring(0, spring.responsive);
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      tx.value,
      [-W, 0, W],
      [-swipe.maxRotation, 0, swipe.maxRotation],
      Extrapolation.CLAMP
    );
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(
      tx.value,
      [-THRESHOLD, 0, THRESHOLD],
      [color.again, color.border, color.got]
    ),
  }));

  // Swipe indicators
  const gotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      tx.value,
      [0, THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));
  const againStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      tx.value,
      [0, -THRESHOLD],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));
  const skipStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      ty.value,
      [0, swipe.upThreshold],
      [0, 1],
      Extrapolation.CLAMP
    ),
  }));

  const ct = cardTypes[card.type];
  const diff = difficulty[card.difficulty];
  const seenDots = getSeenDots(cardProgress);

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, cardStyle, borderStyle]}>
        {/* Top gradient — type-colored ambient light */}
        <LinearGradient
          colors={[ct.color + "0a", "transparent"]}
          style={styles.topGradient}
        />

        {/* Swipe indicators */}
        <Animated.View style={[styles.label, styles.labelRight, gotStyle]}>
          <Text style={[styles.labelText, { color: color.got }]}>GOT IT</Text>
        </Animated.View>
        <Animated.View style={[styles.label, styles.labelLeft, againStyle]}>
          <Text style={[styles.labelText, { color: color.again }]}>AGAIN</Text>
        </Animated.View>
        <Animated.View style={[styles.label, styles.labelTop, skipStyle]}>
          <Text style={[styles.labelText, { color: color.skip }]}>SKIP</Text>
        </Animated.View>

        {/* Header — type symbol + seen dots */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.symbol, { color: ct.color }]}>
              {ct.symbol}
            </Text>
            <Text style={[styles.typeLabel, { color: ct.color }]}>
              {ct.label}
            </Text>
          </View>
          <View style={styles.headerRight}>
            {/* Seen progress dots */}
            <View style={styles.seenDots}>
              {seenDots.map((filled, i) => (
                <View
                  key={i}
                  style={[
                    styles.seenDot,
                    {
                      backgroundColor: filled
                        ? color.green
                        : color.borderSubtle,
                    },
                  ]}
                />
              ))}
            </View>
            {/* Difficulty */}
            <View style={styles.diffDots}>
              {Array.from({ length: 3 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.diffDot,
                    {
                      backgroundColor:
                        i < diff.dots ? color.text : color.borderSubtle,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>
          {card.title}
        </Text>
        <Text style={styles.filePath} numberOfLines={1}>
          {card.filePath}
        </Text>

        {/* Code — fills the reading area between title and explanation */}
        <ScrollView
          style={styles.codeScroll}
          contentContainerStyle={styles.codeContent}
          showsVerticalScrollIndicator={false}
          nestedScrollEnabled
        >
          <SyntaxHighlight code={card.code} />
        </ScrollView>

        {/* Explanation — pinned near bottom */}
        <Text style={styles.explanation}>{card.explanation}</Text>

        {/* Hint bar */}
        <View style={styles.hintBar}>
          <Text style={[styles.hint, { color: color.again }]}>
            ← again
          </Text>
          <Text style={[styles.hint, { color: color.skip }]}>↑ skip</Text>
          <Text style={[styles.hint, { color: color.got }]}>
            got it →
          </Text>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    bottom: 24,
    left: space.base,
    right: space.base,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
    overflow: "hidden",
  },
  topGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  // Swipe labels
  label: {
    position: "absolute",
    zIndex: 10,
  },
  labelRight: { top: space.lg, right: space.lg },
  labelLeft: { top: space.lg, left: space.lg },
  labelTop: {
    top: space.lg,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  labelText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 3,
  },
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  symbol: {
    fontSize: 16,
    fontWeight: "600",
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  seenDots: {
    flexDirection: "row",
    gap: 4,
  },
  seenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  diffDots: {
    flexDirection: "row",
    gap: 3,
  },
  diffDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // Title
  title: {
    fontSize: 26,
    fontWeight: "700",
    color: color.text,
    fontFamily: "monospace",
    paddingHorizontal: space.lg,
    marginTop: space.md,
    letterSpacing: -0.5,
  },
  filePath: {
    fontSize: 12,
    color: color.textTertiary,
    fontFamily: "monospace",
    paddingHorizontal: space.lg,
    marginTop: space.xs,
  },
  // Code
  codeScroll: {
    flex: 1,
    marginHorizontal: space.base,
    marginTop: space.base,
    backgroundColor: color.bg,
    borderRadius: radius.md,
  },
  codeContent: {
    padding: space.base,
  },
  // Explanation
  explanation: {
    fontSize: 14,
    lineHeight: 21,
    color: color.textSecondary,
    paddingHorizontal: space.lg,
    paddingTop: space.base,
  },
  // Hints
  hintBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  hint: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 0.5,
  },
});
