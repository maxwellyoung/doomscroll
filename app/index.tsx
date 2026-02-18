/**
 * The feed — the entire experience.
 *
 * Rich Harris: no ceremony. The app is a deck of cards.
 * Evan Bacon: Expo Router. One file, one screen, zero config.
 * Sindre Sorhus: the less code here, the more correct.
 */
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Header } from "@/components/Header";
import { CardStack } from "@/components/CardStack";
import { MasteryBurst } from "@/components/MasteryBurst";
import { CompletionScreen } from "@/components/CompletionScreen";
import { useCardDeck } from "@/lib/store";
import { mockCards } from "@/lib/mock-data";
import { color, space } from "@/lib/design";

export default function Feed() {
  const insets = useSafeAreaInsets();
  const deck = useCardDeck(mockCards);

  if (deck.isLoading) {
    return (
      <View style={[styles.screen, styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={color.textTertiary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.sm }]}>
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
          index={Object.values(deck.progress).reduce((a, p) => a + p.seen, 0)}
          progress={deck.progress}
          onSwipeLeft={deck.swipeLeft}
          onSwipeRight={deck.swipeRight}
          onSwipeUp={deck.swipeUp}
        />
      )}

      {/* Mastery celebration overlay */}
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
  },
});
