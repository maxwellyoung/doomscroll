/**
 * MasteryBurst — the reward.
 *
 * Kowalski: a spring-driven scale pulse.
 * Rams: as little as possible — just a glow, a word, a haptic.
 * Singer: product poetry — it should feel earned.
 *
 * No confetti. No fireworks. Just the quiet satisfaction of understanding.
 */
import { StyleSheet, View, Text } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
  Easing,
} from "react-native-reanimated";
import { useEffect, useRef } from "react";
import { color, spring, space } from "@/lib/design";
import { haptic } from "@/lib/haptics";

interface Props {
  visible: boolean;
  cardTitle: string;
  onComplete: () => void;
}

export function MasteryBurst({ visible, cardTitle, onComplete }: Props) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const glowOpacity = useSharedValue(0);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  useEffect(() => {
    if (!visible) return;

    haptic.success();

    // Text: fade in, hold, fade out
    opacity.value = withSequence(
      withSpring(1, spring.responsive),
      withDelay(1200, withTiming(0, { duration: 400, easing: Easing.out(Easing.quad) }))
    );

    // Scale: spring in, settle
    scale.value = withSequence(
      withSpring(1.05, spring.bouncy),
      withSpring(1, spring.gentle)
    );

    // Glow ring
    glowOpacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withDelay(1000, withTiming(0, { duration: 600 }))
    );

    // Callback after animation completes
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, 1800);

    return () => clearTimeout(timer);
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {/* Glow ring */}
      <Animated.View style={[styles.glow, glowStyle]} />

      {/* Text */}
      <Animated.View style={[styles.content, containerStyle]}>
        <Text style={styles.label}>MASTERED</Text>
        <Text style={styles.title} numberOfLines={1}>
          {cardTitle}
        </Text>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotFilled]} />
          <View style={[styles.dot, styles.dotFilled]} />
          <View style={[styles.dot, styles.dotFilled]} />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  glow: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: color.green,
    opacity: 0.1,
  },
  content: {
    alignItems: "center",
    gap: space.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 4,
    color: color.green,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: color.text,
    fontFamily: "monospace",
    letterSpacing: -0.5,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginTop: space.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotFilled: {
    backgroundColor: color.green,
  },
});
