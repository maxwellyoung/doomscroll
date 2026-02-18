/**
 * Spaced repetition — Christopher Alexander's pattern language.
 *
 * The queue is a living structure. Cards rise and fall based on need.
 * Unseen cards surface first (discovery). Failed cards return quickly
 * (repair). Mastered cards drift to the back (reinforcement).
 *
 * No complex SM-2 algorithm. Just three tiers with time-aware sorting.
 * Rich Harris: the simplest system that could possibly work.
 */
import type { CodeCard, CardProgress } from "@/types";

export function buildQueue(
  cards: CodeCard[],
  progress: Record<string, CardProgress>,
  justSwipedId?: string
): CodeCard[] {
  const now = Date.now();

  // Tier 1: Never seen — discovery
  const unseen = cards.filter((c) => !progress[c.id]);

  // Tier 2: Seen but not mastered — needs work
  const needsWork = cards
    .filter((c) => {
      const p = progress[c.id];
      return p && !p.mastered && c.id !== justSwipedId;
    })
    .sort((a, b) => {
      // Oldest-seen first (most due for review)
      return progress[a.id].lastSeen - progress[b.id].lastSeen;
    });

  // Tier 3: Mastered — reinforcement, least recent first
  const mastered = cards
    .filter((c) => {
      const p = progress[c.id];
      return p?.mastered && c.id !== justSwipedId;
    })
    .sort((a, b) => {
      return progress[a.id].lastSeen - progress[b.id].lastSeen;
    });

  return [...unseen, ...needsWork, ...mastered];
}

/**
 * Returns the progress tier for display.
 * The card shows dots: ○○○ (unseen) → ●○○ (seen once) → ●●○ → ●●● (mastered)
 */
export function getSeenDots(
  progress: CardProgress | undefined
): [boolean, boolean, boolean] {
  if (!progress) return [false, false, false];
  const s = progress.seen;
  return [s >= 1, s >= 2, s >= 3];
}
