import AsyncStorage from "@react-native-async-storage/async-storage";

// Browsers have no OS credential vault. Keep tokens in memory until reload.
let sessionToken: string | null = null;
const LEGACY_TOKEN_KEY = "doomscroll:github-token";

export async function getGitHubToken(): Promise<string | null> {
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY).catch(() => {});
  return sessionToken;
}

export async function hasGitHubToken(): Promise<boolean> {
  return Boolean(await getGitHubToken());
}

export async function saveGitHubToken(token: string): Promise<void> {
  const normalized = token.trim();
  if (!normalized) throw new Error("Enter a GitHub token.");
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
  sessionToken = normalized;
}

export async function clearGitHubToken(): Promise<void> {
  sessionToken = null;
  await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
}

export function maskGitHubToken(token: string | null): string {
  return token ? "connected" : "not connected";
}
