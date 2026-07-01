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
  input: string;
  scopePath?: string;
  description: string;
  stars: number;
  cardCount: number;
  lastVisited: number;
}

export async function getRecent(): Promise<RecentRepo[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RecentRepo>[]) : [];
    return parsed.map((repo) => {
      const scopePath = repo.scopePath || undefined;
      const fallbackInput = scopePath
        ? `${repo.fullName || ""}#${scopePath}`
        : repo.fullName || "";
      const input = repo.input || fallbackInput;

      return {
        owner: repo.owner || "",
        repo: repo.repo || "",
        fullName: repo.fullName || "",
        input,
        scopePath,
        description: repo.description || "",
        stars: typeof repo.stars === "number" ? repo.stars : 0,
        cardCount: typeof repo.cardCount === "number" ? repo.cardCount : 0,
        lastVisited:
          typeof repo.lastVisited === "number" ? repo.lastVisited : 0,
      };
    });
  } catch {
    return [];
  }
}

export async function addRecent(entry: Omit<RecentRepo, "lastVisited">) {
  const list = await getRecent();
  const filtered = list.filter((r) => r.input !== entry.input);
  const updated = [{ ...entry, lastVisited: Date.now() }, ...filtered].slice(
    0,
    MAX
  );
  await AsyncStorage.setItem(KEY, JSON.stringify(updated));
}
