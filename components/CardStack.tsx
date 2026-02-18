/**
 * CardStack — visible depth.
 *
 * Christopher Alexander: a center gains life from surrounding centers.
 * Peek cards visible at the bottom — the stack has physical presence.
 */
import { StyleSheet, View } from "react-native";
import type { CodeCard, CardProgress } from "@/types";
import { SwipeCard } from "./SwipeCard";
import { color, radius, space } from "@/lib/design";

interface Props {
  currentCard: CodeCard | null;
  nextCard: CodeCard | null;
  index: number;
  progress: Record<string, CardProgress>;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
}

export function CardStack({
  currentCard,
  nextCard,
  index,
  progress,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Second peek — visible below the active card */}
      {nextCard && <View style={styles.peek2} pointerEvents="none" />}

      {/* First peek — just behind active */}
      {nextCard && <View style={styles.peek1} pointerEvents="none" />}

      {/* Active card (has bottom: 24, leaving space for peeks) */}
      {currentCard && (
        <SwipeCard
          key={`${currentCard.id}-${index}`}
          card={currentCard}
          cardProgress={progress[currentCard.id]}
          swipeCount={index}
          onSwipeLeft={onSwipeLeft}
          onSwipeRight={onSwipeRight}
          onSwipeUp={onSwipeUp}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: space.md,
  },
  peek2: {
    position: "absolute",
    top: 12,
    bottom: 4,
    left: space.base + 10,
    right: space.base + 10,
    backgroundColor: color.surfaceRaised,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.borderSubtle,
  },
  peek1: {
    position: "absolute",
    top: 6,
    bottom: 12,
    left: space.base + 5,
    right: space.base + 5,
    backgroundColor: color.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: color.border,
  },
});
