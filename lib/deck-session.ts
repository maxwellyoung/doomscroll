import AsyncStorage from "@react-native-async-storage/async-storage";
import type { CodeCard } from "../types";
import { parsePortableDeck } from "./portable-deck";

export interface DeckSession {
  cards: CodeCard[];
  repoName: string;
  repoDesc: string;
  repoStars: string;
}
type Storage = Pick<typeof AsyncStorage, "getItem" | "setItem" | "removeItem">;
const INDEX_KEY = "doomscroll:deck-sessions";
const key = (id: string) => `doomscroll:deck-session:${id}`;
const validId = (id: string) => /^[a-z0-9-]{8,80}$/.test(id);
let writes: Promise<unknown> = Promise.resolve();

/** Keep source code in local storage, never in a route URL or browser history. */
export function saveDeckSession(session: DeckSession, storage: Storage = AsyncStorage): Promise<string> {
  const action = writes.then(async () => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    const raw = await storage.getItem(INDEX_KEY);
    let previous: string[] = [];
    try { const parsed = JSON.parse(raw ?? "[]"); if (Array.isArray(parsed)) previous = parsed.filter(v => typeof v === "string" && validId(v)); } catch {}
    await storage.setItem(key(id), JSON.stringify(session));
    const retained = [id, ...previous].slice(0, 5);
    await storage.setItem(INDEX_KEY, JSON.stringify(retained));
    await Promise.all(previous.filter(v => !retained.includes(v)).map(v => storage.removeItem(key(v))));
    return id;
  });
  writes = action.catch(() => {});
  return action;
}

export async function loadDeckSession(id: string, storage: Storage = AsyncStorage): Promise<DeckSession | null> {
  if (!validId(id)) return null;
  const raw = await storage.getItem(key(id));
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const deck = parsePortableDeck(JSON.stringify({ version: 1, meta: { repoName: value.repoName }, cards: value.cards }));
    return { cards: deck.cards, repoName: deck.meta.repoName,
      repoDesc: typeof value.repoDesc === "string" ? value.repoDesc : "",
      repoStars: typeof value.repoStars === "string" && /^\d+$/.test(value.repoStars) ? value.repoStars : "0" };
  } catch { return null; }
}

export function clearDeckSessions(storage: Storage = AsyncStorage): Promise<void> {
  const action = writes.then(async () => {
    let ids: unknown;
    try { ids = JSON.parse(await storage.getItem(INDEX_KEY) ?? "[]"); } catch { ids = []; }
    if (Array.isArray(ids)) await Promise.all(ids.filter(v => typeof v === "string" && validId(v)).map(v => storage.removeItem(key(v))));
    await storage.removeItem(INDEX_KEY);
  });
  writes = action.catch(() => {});
  return action;
}
