/** Review queue: unseen first, then least recently reviewed.
 * Three consecutive "got it" ratings complete a card's self-assessment.
 * This queue has no interval scheduling and does not measure understanding.
 */
import type { CodeCard, CardProgress } from "@/types";

export function buildQueue(
  cards: CodeCard[],
  progress: Record<string, CardProgress>,
  justSwipedId?: string
): CodeCard[] {


  // Tier 1: Never seen — discovery
  const unseen = cards.filter((c) => !progress[c.id]);

  // Tier 2: Seen but not mastered — needs work
  const needsWork = cards
    .filter((c) => {
      const p = progress[c.id];
      return p && !p.mastered && c.id !== justSwipedId;
    })
    .sort((a, b) => {
      // Oldest-seen first (least recently reviewed)
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

  const ordered = [...unseen, ...needsWork, ...mastered].filter(c => c.id !== justSwipedId);
  const skipped = cards.find(c => c.id === justSwipedId);
  return skipped ? [...ordered, skipped] : ordered;
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
