import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { createTokenVault } from "./token-storage";

const LEGACY_TOKEN_KEY = "doomscroll:github-token";
const TOKEN_KEY = "doomscroll.github-token";
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
const vault = createTokenVault({
  readSecure: () => SecureStore.getItemAsync(TOKEN_KEY, options),
  writeSecure: value => SecureStore.setItemAsync(TOKEN_KEY, value, options),
  removeSecure: () => SecureStore.deleteItemAsync(TOKEN_KEY, options),
  readLegacy: () => AsyncStorage.getItem(LEGACY_TOKEN_KEY),
  removeLegacy: () => AsyncStorage.removeItem(LEGACY_TOKEN_KEY),
});

export async function getGitHubToken(): Promise<string | null> {
  // A locked or unavailable vault must never fall back to a plaintext token.
  try { return await vault.get(); }
  catch { throw new Error("GitHub access could not be opened securely. Unlock this device and retry in GitHub settings."); }
}
export async function hasGitHubToken(): Promise<boolean> {
  return Boolean(await getGitHubToken().catch(() => null));
}
export const saveGitHubToken = vault.save;
export const clearGitHubToken = vault.clear;
export function maskGitHubToken(token: string | null): string {
  return token ? "connected" : "not connected";
}
