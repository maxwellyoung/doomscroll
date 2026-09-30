/**
 * Feed — the swipe experience.
 *
 * Rich Harris: no ceremony. Cards in, knowledge out.
 * Receives cards from the home screen via router params.
 */
import { View, StyleSheet, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { loadDeckSession, type DeckSession } from "@/lib/deck-session";
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
  const params = useLocalSearchParams<{ session: string }>();
  const [session, setSession] = useState<DeckSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [cards, setCards] = useState<CodeCard[]>([]);
  useEffect(() => {
    let active = true;
    setLoadingSession(true);
    loadDeckSession(params.session ?? "").then(value => {
      if (!active) return;
      setSession(value); setCards(value?.cards ?? []); setLoadingSession(false);
    }).catch(() => { if (active) { setSession(null); setCards([]); setLoadingSession(false); } });
    return () => { active = false; };
  }, [params.session]);
  const deck = useCardDeck(cards, session?.repoName);

  if (loadingSession) return <View style={[styles.screen, styles.center]}><Text style={styles.emptyText}>Loading deck…</Text></View>;
  if (deck.isLoading) return <View style={[styles.screen, styles.center]}><Text style={styles.emptyText}>Loading progress…</Text></View>;

  if (cards.length === 0) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.emptyText}>This saved deck is unavailable. Open it again from home.</Text>
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
        <Pressable accessibilityRole="button" accessibilityLabel="Back to repositories" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <View style={styles.repoInfo}>
          <Text style={styles.repoName} numberOfLines={1}>
            {session?.repoName}
          </Text>
          {session?.repoStars !== "0" && (
            <Text style={styles.repoStars}>★ {session?.repoStars}</Text>
          )}
        </View>
      </View>

      <Header
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
          index={deck.reviewCount}
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
