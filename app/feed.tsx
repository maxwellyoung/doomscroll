/**
 * Feed — the swipe experience.
 *
 * Rich Harris: no ceremony. Cards in, knowledge out.
 * Receives cards from the home screen via router params.
 */
import { View, StyleSheet, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo } from "react";
import { Header } from "@/components/Header";
import { CardStack } from "@/components/CardStack";
import { MasteryBurst } from "@/components/MasteryBurst";
import { CompletionScreen } from "@/components/CompletionScreen";
import { useCardDeck } from "@/lib/store";
import { color, space, radius } from "@/lib/design";
import type { CodeCard } from "@/types";

export default function Feed() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    cards: string;
    repoName: string;
    repoDesc: string;
    repoStars: string;
  }>();

  const cards: CodeCard[] = useMemo(() => {
    try {
      return JSON.parse(params.cards ?? "[]");
    } catch {
      return [];
    }
  }, [params.cards]);

  const deck = useCardDeck(cards, params.repoName);

  if (cards.length === 0) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>No cards to show</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backLink}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
      {/* Repo info + back */}
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.repoInfo}>
          <Text style={styles.repoName} numberOfLines={1}>
            {params.repoName}
          </Text>
          {params.repoStars !== "0" && (
            <Text style={styles.repoStars}>★ {params.repoStars}</Text>
          )}
        </View>
      </View>

      <Header
        mastered={deck.mastered}
        total={deck.total}
        seen={Object.keys(deck.progress).length}
      />

      {deck.allMastered ? (
        <CompletionScreen
          mastered={deck.mastered}
          total={deck.total}
          onRestart={deck.restart}
        />
      ) : (
        <CardStack
          currentCard={deck.currentCard}
          nextCard={deck.nextCard}
          index={Object.values(deck.progress).reduce(
            (a, p) => a + p.seen,
            0
          )}
          progress={deck.progress}
          onSwipeLeft={deck.swipeLeft}
          onSwipeRight={deck.swipeRight}
          onSwipeUp={deck.swipeUp}
        />
      )}

      <MasteryBurst
        visible={deck.justMasteredCard !== null}
        cardTitle={deck.justMasteredCard?.title ?? ""}
        onComplete={deck.clearJustMastered}
      />

      <View style={{ height: insets.bottom + space.base }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    gap: space.base,
  },
  emptyText: {
    fontSize: 16,
    color: color.textSecondary,
  },
  backLink: {
    fontSize: 15,
    color: color.blue,
    textDecorationLine: "underline",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    gap: space.md,
  },
  backArrow: {
    fontSize: 22,
    color: color.textSecondary,
    fontWeight: "600",
  },
  repoInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  repoName: {
    fontSize: 14,
    color: color.textSecondary,
    fontFamily: "monospace",
    flexShrink: 1,
  },
  repoStars: {
    fontSize: 12,
    color: color.textTertiary,
  },
});
