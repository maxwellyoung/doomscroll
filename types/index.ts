export type CardType = "function" | "type" | "concept" | "pattern" | "file";

export interface CodeCard {
  id: string;
  type: CardType;
  title: string;
  filePath: string;
  code: string;
  language: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
}

export type SwipeDirection = "left" | "right" | "up";

export interface CardProgress {
  cardId: string;
  seen: number;
  mastered: boolean;
  lastSeen: number;
}

export interface RepoSession {
  repoName: string;
  cards: CodeCard[];
  progress: Record<string, CardProgress>;
  totalMastered: number;
  totalCards: number;
}
