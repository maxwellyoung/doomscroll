/**
 * CompletionScreen — the end, which is also the beginning.
 *
 * Muriel Cooper: typography in space. Large numbers, quiet text.
 * Rams: nothing decorative. Just the fact of completion.
 * Alexander: wholeness — the session is complete, a pattern is resolved.
 */
import { StyleSheet, View, Text, Pressable } from "react-native";
import Animated, {
  FadeIn,
  SlideInUp,
} from "react-native-reanimated";
import { color, space, radius, spring } from "@/lib/design";

interface Props {
  mastered: number;
  total: number;
  onRestart: () => void;
}

export function CompletionScreen({ mastered, total, onRestart }: Props) {
  const allMastered = mastered === total;

  return (
    <View style={styles.container}>
      <Animated.View
        entering={FadeIn.duration(600)}
        style={styles.content}
      >
        {/* The number — Muriel Cooper scale */}
        <Animated.Text
          entering={SlideInUp.springify().damping(20).stiffness(120)}
          style={styles.bigNumber}
        >
          {mastered}
        </Animated.Text>

        <Text style={styles.label}>
          {allMastered ? "all mastered" : `of ${total} mastered`}
        </Text>

        <Text style={styles.message}>
          {allMastered
            ? "You've internalized every pattern in this deck.\nThe code is part of you now."
            : "Keep scrolling. Repetition is understanding."}
        </Text>

        {allMastered && (
          <Animated.View entering={FadeIn.delay(400).duration(400)}>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                pressed && styles.buttonPressed,
              ]}
              onPress={onRestart}
            >
              <Text style={styles.buttonText}>Review again</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: space.xxl,
  },
  content: {
    alignItems: "center",
    gap: space.base,
  },
  bigNumber: {
    fontSize: 96,
    fontWeight: "800",
    color: color.green,
    fontFamily: "monospace",
    letterSpacing: -4,
    lineHeight: 96,
  },
  label: {
    fontSize: 15,
    color: color.textSecondary,
    fontWeight: "500",
    letterSpacing: 1,
  },
  message: {
    fontSize: 15,
    lineHeight: 24,
    color: color.textTertiary,
    textAlign: "center",
    marginTop: space.sm,
  },
  button: {
    marginTop: space.xl,
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surfaceRaised,
  },
  buttonPressed: {
    backgroundColor: color.surfaceHover,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    color: color.text,
    letterSpacing: 0.5,
  },
});
