/**
 * Header — Dieter Rams moral baseline.
 * Shows only what matters: where you are, how far you've come.
 * The progress bar is the entire bottom edge — no chrome, just signal.
 */
import { View, Text, StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from "react-native-reanimated";
import { useEffect } from "react";
import { color, space, spring } from "@/lib/design";

interface Props {
  mastered: number;
  total: number;
  seen: number;
}

export function Header({ mastered, total, seen }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    const target = total > 0 ? mastered / total : 0;
    progress.value = withSpring(target, spring.gentle);
  }, [mastered, total, progress]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.min(progress.value * 100, 100)}%`,
  }));

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={styles.title}>doomscroll</Text>
        <View style={styles.stats}>
          <Text style={styles.stat}>
            <Text style={styles.statValue}>{mastered}</Text>
            <Text style={styles.statLabel}> mastered</Text>
          </Text>
          <Text style={styles.divider}>·</Text>
          <Text style={styles.stat}>
            <Text style={styles.statValue}>{seen}</Text>
            <Text style={styles.statLabel}>/{total} seen</Text>
          </Text>
        </View>
      </View>
      {/* Progress — the full-width bar is the design */}
      <View style={styles.track}>
        <Animated.View style={[styles.fill, barStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: color.text,
    letterSpacing: -0.5,
  },
  stats: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: space.sm,
  },
  stat: {
    fontSize: 13,
  },
  statValue: {
    color: color.text,
    fontFamily: "monospace",
    fontWeight: "600",
  },
  statLabel: {
    color: color.textTertiary,
    fontFamily: "monospace",
  },
  divider: {
    color: color.textTertiary,
    fontSize: 13,
  },
  track: {
    height: 2,
    backgroundColor: color.border,
    borderRadius: 1,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: color.green,
    borderRadius: 1,
  },
});
