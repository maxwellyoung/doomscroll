import type { CodeCard, CardProgress } from "../types";

// Compare the actual learning material, not a list index or a moving branch name.
export function cardFingerprint(card: CodeCard): string {
  return JSON.stringify([card.filePath, card.type, card.title, card.code, card.prompt ?? "", card.explanation]);
}

export function reconcileProgress(cards: CodeCard[], saved: unknown): Record<string, CardProgress> {
  if (!saved || typeof saved !== "object" || Array.isArray(saved)) return {};
  const result: Record<string, CardProgress> = {};
  for (const card of cards) {
    const progress = (saved as Record<string, CardProgress>)[card.id];
    if (progress && progress.cardId === card.id && progress.fingerprint === cardFingerprint(card) &&
        Number.isInteger(progress.seen) && progress.seen >= 0 &&
        Number.isFinite(progress.lastSeen) && typeof progress.mastered === "boolean") {
      result[card.id] = { ...progress, mastered: progress.seen >= 3 };
    }
  }
  return result;
}

export function sourceUrl(card: CodeCard): string | undefined {
  const source = card.source;
  if (!source || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repo) ||
      !/^[a-f0-9]{40}$/.test(source.commit) || !Number.isInteger(source.startLine) ||
      !Number.isInteger(source.endLine) || source.startLine < 1 || source.endLine < source.startLine ||
      card.filePath.split("/").some(part => !part || part === "." || part === "..")) return undefined;
  return `https://github.com/${source.repo}/blob/${source.commit}/${card.filePath.split("/").map(encodeURIComponent).join("/")}#L${source.startLine}-L${source.endLine}`;
}
