/**
 * Streak tracking — the reason you come back.
 *
 * Simple: did you swipe at least one card today?
 * If yes, streak continues. If not, it resets.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "doomscroll:streak";

export interface StreakData {
  current: number;
  longest: number;
  lastActiveDate: string; // YYYY-MM-DD
  /** Activity log — dates you were active (last 60 days) */
  activeDays: string[];
  /** Total cards ever swiped (right or left, not skip) */
  totalSwipes: number;
  /** Total cards mastered (across all repos) */
  totalMastered: number;
  /** Total repos ingested */
  totalRepos: number;
}

const DEFAULT: StreakData = {
  current: 0,
  longest: 0,
  lastActiveDate: "",
  activeDays: [],
  totalSwipes: 0,
  totalMastered: 0,
  totalRepos: 0,
};

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function getStreak(): Promise<StreakData> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULT;
    const data: StreakData = JSON.parse(raw);

    // Check if streak should reset (missed yesterday)
    const t = today();
    const y = yesterday();
    if (data.lastActiveDate !== t && data.lastActiveDate !== y) {
      // Streak broken — reset current but keep stats
      return { ...data, current: 0 };
    }
    return data;
  } catch {
    return DEFAULT;
  }
}

async function saveStreak(data: StreakData) {
  await AsyncStorage.setItem(KEY, JSON.stringify(data));
}

/** Record a swipe action (call on every right/left swipe) */
export async function recordSwipe(mastered: boolean): Promise<StreakData> {
  const data = await getStreak();
  const t = today();

  data.totalSwipes += 1;
  if (mastered) data.totalMastered += 1;

  if (data.lastActiveDate !== t) {
    // First swipe of the day
    if (data.lastActiveDate === yesterday()) {
      data.current += 1; // Streak continues
    } else {
      data.current = 1; // New streak
    }
    data.lastActiveDate = t;

    // Add to activity log (keep last 60 days)
    if (!data.activeDays.includes(t)) {
      data.activeDays.push(t);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 60);
      const cutoffStr = cutoff.toISOString().slice(0, 10);
      data.activeDays = data.activeDays.filter((d) => d >= cutoffStr);
    }
  }

  data.longest = Math.max(data.longest, data.current);
  await saveStreak(data);
  return data;
}

/** Record a new repo ingestion */
export async function recordRepo(): Promise<void> {
  const data = await getStreak();
  data.totalRepos += 1;
  await saveStreak(data);
}

/** Get activity for the last N days (for heatmap) */
export function getActivityDays(
  data: StreakData,
  days = 30
): { date: string; active: boolean }[] {
  const result: { date: string; active: boolean }[] = [];
  const activeSet = new Set(data.activeDays);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    result.push({ date: dateStr, active: activeSet.has(dateStr) });
  }
  return result;
}
