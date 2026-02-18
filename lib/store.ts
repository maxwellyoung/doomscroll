/**
 * Card deck state — Dan Abramov clarity, Sindre Sorhus minimalism.
 *
 * One hook. One mental model: a queue you swipe through.
 * The queue reorders itself based on what you know.
 * Progress persists across sessions.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CodeCard, CardProgress } from "@/types";
import { buildQueue } from "./repetition";

const STORAGE_KEY = "doomscroll:progress";

interface DeckState {
  currentCard: CodeCard | null;
  nextCard: CodeCard | null;
  progress: Record<string, CardProgress>;
  mastered: number;
  total: number;
  allMastered: boolean;
  justMasteredCard: CodeCard | null;
  isLoading: boolean;
  swipeRight: () => void;
  swipeLeft: () => void;
  swipeUp: () => void;
  clearJustMastered: () => void;
  restart: () => void;
}

async function loadProgress(): Promise<Record<string, CardProgress>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveProgress(progress: Record<string, CardProgress>) {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {}
}

export function useCardDeck(cards: CodeCard[]): DeckState {
  const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [justMasteredCard, setJustMasteredCard] = useState<CodeCard | null>(null);
  const [lastSwipedId, setLastSwipedId] = useState<string | undefined>();
  const total = cards.length;

  // Load persisted progress on mount
  useEffect(() => {
    loadProgress().then((saved) => {
      setProgress(saved);
      setIsLoading(false);
    });
  }, []);

  // Save progress on every change (skip initial load)
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isLoading) {
      saveProgress(progress);
    }
  }, [progress, isLoading]);

  // Queue recomputes when progress changes
  const queue = useMemo(
    () => buildQueue(cards, progress, lastSwipedId),
    [cards, progress, lastSwipedId]
  );

  const currentCard = queue[0] ?? null;
  const nextCard = queue[1] ?? null;

  const mastered = useMemo(
    () => Object.values(progress).filter((p) => p.mastered).length,
    [progress]
  );
  const allMastered = mastered >= total && total > 0;

  const swipeRight = useCallback(() => {
    if (!currentCard) return;
    const id = currentCard.id;
    const card = currentCard;
    setLastSwipedId(id);
    setProgress((prev) => {
      const seen = (prev[id]?.seen ?? 0) + 1;
      const wasMastered = prev[id]?.mastered ?? false;
      const isMastered = seen >= 3;

      // Trigger celebration on first mastery
      if (isMastered && !wasMastered) {
        setJustMasteredCard(card);
      }

      return {
        ...prev,
        [id]: { cardId: id, seen, mastered: isMastered, lastSeen: Date.now() },
      };
    });
  }, [currentCard]);

  const swipeLeft = useCallback(() => {
    if (!currentCard) return;
    const id = currentCard.id;
    setLastSwipedId(id);
    setProgress((prev) => ({
      ...prev,
      [id]: {
        cardId: id,
        seen: (prev[id]?.seen ?? 0) + 1,
        mastered: false,
        lastSeen: Date.now(),
      },
    }));
  }, [currentCard]);

  const swipeUp = useCallback(() => {
    if (!currentCard) return;
    setLastSwipedId(currentCard.id);
  }, [currentCard]);

  const clearJustMastered = useCallback(() => {
    setJustMasteredCard(null);
  }, []);

  const restart = useCallback(() => {
    setProgress({});
    setLastSwipedId(undefined);
    void AsyncStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    currentCard,
    nextCard,
    progress,
    mastered,
    total,
    allMastered,
    justMasteredCard,
    isLoading,
    swipeRight,
    swipeLeft,
    swipeUp,
    clearJustMastered,
    restart,
  };
}
