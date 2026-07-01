import AsyncStorage from "@react-native-async-storage/async-storage";

const GITHUB_TOKEN_KEY = "doomscroll:github-token";

function normalizeGitHubToken(token: string): string {
  return token.trim();
}

export async function getGitHubToken(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(GITHUB_TOKEN_KEY);
    const token = raw ? normalizeGitHubToken(raw) : "";
    return token || null;
  } catch {
    return null;
  }
}

export async function hasGitHubToken(): Promise<boolean> {
  return Boolean(await getGitHubToken());
}

export async function saveGitHubToken(token: string): Promise<void> {
  const normalized = normalizeGitHubToken(token);
  if (!normalized) {
    throw new Error("Enter a GitHub token.");
  }
  await AsyncStorage.setItem(GITHUB_TOKEN_KEY, normalized);
}

export async function clearGitHubToken(): Promise<void> {
  await AsyncStorage.removeItem(GITHUB_TOKEN_KEY);
}

export function maskGitHubToken(token: string | null): string {
  if (!token) return "not connected";
  if (token.length <= 8) return "connected";
  return `${token.slice(0, 4)}••••${token.slice(-4)}`;
}
