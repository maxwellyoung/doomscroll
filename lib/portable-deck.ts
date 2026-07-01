import type { CodeCard } from "@/types";

export interface PortableDeckMeta {
  repoName: string;
  description?: string;
  generatedAt?: string;
  sourceType?: "github" | "local";
  sourcePath?: string;
  scopePath?: string;
}

export interface PortableDeck {
  version: 1;
  meta: PortableDeckMeta;
  cards: CodeCard[];
}

function isDifficulty(value: unknown): value is 1 | 2 | 3 {
  return value === 1 || value === 2 || value === 3;
}

function isCodeCard(value: unknown): value is CodeCard {
  if (!value || typeof value !== "object") return false;
  const card = value as Record<string, unknown>;

  return (
    typeof card.id === "string" &&
    typeof card.type === "string" &&
    typeof card.title === "string" &&
    typeof card.filePath === "string" &&
    typeof card.code === "string" &&
    typeof card.language === "string" &&
    (typeof card.prompt === "undefined" || typeof card.prompt === "string") &&
    typeof card.explanation === "string" &&
    isDifficulty(card.difficulty)
  );
}

export function parsePortableDeck(raw: string): PortableDeck {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Deck file is not valid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Deck file has an invalid top-level shape.");
  }

  const deck = parsed as Record<string, unknown>;
  const meta =
    deck.meta && typeof deck.meta === "object"
      ? (deck.meta as Record<string, unknown>)
      : null;
  const cards = Array.isArray(deck.cards) ? deck.cards : null;

  if (deck.version !== 1) {
    throw new Error("Unsupported deck version.");
  }

  if (!meta || typeof meta.repoName !== "string" || !meta.repoName.trim()) {
    throw new Error("Deck metadata is missing repoName.");
  }

  if (!cards || cards.length === 0) {
    throw new Error("Deck does not contain any cards.");
  }

  if (!cards.every(isCodeCard)) {
    throw new Error("Deck contains invalid card entries.");
  }

  return {
    version: 1,
    meta: {
      repoName: meta.repoName,
      description:
        typeof meta.description === "string" ? meta.description : undefined,
      generatedAt:
        typeof meta.generatedAt === "string" ? meta.generatedAt : undefined,
      sourceType:
        meta.sourceType === "github" || meta.sourceType === "local"
          ? meta.sourceType
          : undefined,
      sourcePath:
        typeof meta.sourcePath === "string" ? meta.sourcePath : undefined,
      scopePath:
        typeof meta.scopePath === "string" ? meta.scopePath : undefined,
    },
    cards,
  };
}
