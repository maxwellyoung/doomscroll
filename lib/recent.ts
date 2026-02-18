/**
 * Recent repos — remembers where you've been.
 *
 * Christopher Alexander: a place with life has memory.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "doomscroll:recent";
const MAX = 8;

export interface RecentRepo {
  owner: string;
  repo: string;
  fullName: string;
  description: string;
  stars: number;
  cardCount: number;
  lastVisited: number;
}

export async function getRecent(): Promise<RecentRepo[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecent(entry: Omit<RecentRepo, "lastVisited">) {
  const list = await getRecent();
  const filtered = list.filter((r) => r.fullName !== entry.fullName);
  const updated = [{ ...entry, lastVisited: Date.now() }, ...filtered].slice(
    0,
    MAX
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}
