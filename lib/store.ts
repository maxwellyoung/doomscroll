/**
 * Card deck state — Dan Abramov clarity, Sindre Sorhus minimalism.
 *
 * One hook. One mental model: a queue you swipe through.
 * The queue reorders itself based on what you know.
 * Progress persists per-repo across sessions.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CodeCard, CardProgress } from "@/types";
import { buildQueue } from "./repetition";
import { recordSwipe } from "./streak";
import { cardFingerprint, reconcileProgress } from "./progress";

function storageKey(repoName: string) {
  return `doomscroll:progress:${repoName}`;
}

interface DeckState {
  currentCard: CodeCard | null;
  nextCard: CodeCard | null;
  progress: Record<string, CardProgress>;
  mastered: number;
  total: number;
  allMastered: boolean;
  justMasteredCard: CodeCard | null;
  isLoading: boolean;
  reviewCount: number;
  swipeRight: () => void;
  swipeLeft: () => void;
  swipeUp: () => void;
  clearJustMastered: () => void;
  restart: () => void;
}

export function useCardDeck(cards: CodeCard[], repoName = "default"): DeckState {
  const [progress, setProgress] = useState<Record<string, CardProgress>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [justMasteredCard, setJustMasteredCard] = useState<CodeCard | null>(null);
  const [lastSwipedId, setLastSwipedId] = useState<string | undefined>();
  const [reviewCount, setReviewCount] = useState(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const total = cards.length;
  const key = storageKey(repoName);

  const loadedKey = useRef<string | null>(null);
  const writeQueue = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    loadedKey.current = null;
    setIsLoading(true);
    setProgress({});
    progressRef.current = {};
    setReviewCount(0);
    setLastSwipedId(undefined);
    setJustMasteredCard(null);
    writeQueue.current.then(() => AsyncStorage.getItem(key))
      .then(raw => {
        if (!active) return;
        setProgress(reconcileProgress(cards, raw ? JSON.parse(raw) : {}));
        loadedKey.current = key;
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setProgress({});
        loadedKey.current = key;
        setIsLoading(false);
      });
    return () => { active = false; loadedKey.current = null; };
  }, [key, cards]);

  useEffect(() => {
    if (isLoading || loadedKey.current !== key) return;
    const serialized = JSON.stringify(progress);
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(key, serialized)).catch(() => {});
  }, [progress, isLoading, key]);

  // Queue recomputes when progress changes
  const queue = useMemo(
    () => buildQueue(cards, progress, lastSwipedId),
    [cards, progress, lastSwipedId]
  );

  const currentCard = isLoading ? null : queue[0] ?? null;
  const nextCard = queue[1] ?? null;

  const mastered = useMemo(
    () => Object.values(progress).filter((p) => p.mastered).length,
    [progress]
  );
  const allMastered = mastered >= total && total > 0;

  const swipeRight = useCallback(() => {
    if (!currentCard || isLoading) return;
    const id = currentCard.id;
    const card = currentCard;
    setLastSwipedId(id);
    const previous = progressRef.current[id];
    const seen = (previous?.seen ?? 0) + 1;
    const isMastered = seen >= 3;
    if (isMastered && !previous?.mastered) setJustMasteredCard(card);
    void recordSwipe(isMastered && !previous?.mastered).catch(() => {});
    const next = { ...progressRef.current,
      [id]: { cardId: id, seen, mastered: isMastered, lastSeen: Date.now(), fingerprint: cardFingerprint(card) },
    };
    progressRef.current = next;
    setProgress(next);
    setReviewCount(count => count + 1);
  }, [currentCard, isLoading]);

  const swipeLeft = useCallback(() => {
    if (!currentCard || isLoading) return;
    const id = currentCard.id;
    setLastSwipedId(id);
    // Record swipe for streak tracking
    void recordSwipe(false).catch(() => {});
    const next = { ...progressRef.current,
      [id]: { cardId: id, seen: 0, mastered: false, lastSeen: Date.now(), fingerprint: cardFingerprint(currentCard) },
    };
    progressRef.current = next;
    setProgress(next);
    setReviewCount(count => count + 1);
  }, [currentCard, isLoading]);

  const swipeUp = useCallback(() => {
    if (!currentCard || isLoading) return;
    setLastSwipedId(currentCard.id);
    setReviewCount(count => count + 1);
  }, [currentCard, isLoading]);

  const clearJustMastered = useCallback(() => {
    setJustMasteredCard(null);
  }, []);

  const restart = useCallback(() => {
    progressRef.current = {};
    setProgress({});
    setReviewCount(count => count + 1);
    setLastSwipedId(undefined);

  }, [key]);

  return {
    currentCard,
    nextCard,
    progress,
    mastered,
    total,
    allMastered,
    justMasteredCard,
    isLoading,
    reviewCount,
    swipeRight,
    swipeLeft,
    swipeUp,
    clearJustMastered,
    restart,
  };
}
