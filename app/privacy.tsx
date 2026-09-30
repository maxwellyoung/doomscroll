import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearGitHubToken } from "@/lib/github-auth";
import { clearDeckSessions } from "@/lib/deck-session";
import { color, space, radius } from "@/lib/design";

export default function Privacy() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function clear() {
    if (!confirming) { setConfirming(true); return; }
    setBusy(true);
    try {
      await clearGitHubToken();
      await clearDeckSessions();
      const keys = (await AsyncStorage.getAllKeys()).filter(key => key.startsWith("doomscroll:"));
      await AsyncStorage.multiRemove(keys);
      setMessage("Local decks, progress, history, activity, and GitHub access have been removed.");
      setConfirming(false);
    } catch { setMessage("Could not remove all local data. Try again."); }
    finally { setBusy(false); }
  }
  return <ScrollView style={[styles.screen, { paddingTop: insets.top }]} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.xl }]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={styles.button}><Text style={styles.link}>← back</Text></Pressable>
    <Text style={styles.title}>your code stays yours</Text>
    <Text style={styles.heading}>On this device</Text>
    <Text style={styles.body}>doomscroll saves review progress, repository names, activity, and up to five recent code decks in local app storage. Decks and progress fingerprints can include private source code. Browser storage belongs to this browser profile. Device backups may include local app data.</Text>
    <Text style={styles.heading}>When you import</Text>
    <Text style={styles.body}>GitHub imports contact GitHub directly for repository details and selected code files. An optional token is sent to GitHub to authorize access. Source links open GitHub in your browser. JSON deck imports use your file picker. No code is sent to an AI service. There is no doomscroll account, analytics, advertising, or cloud sync.</Text>
    <Text style={styles.heading}>GitHub access</Text>
    <Text style={styles.body}>Native tokens use the device credential vault. Older tokens migrate from local storage only after the vault confirms the write. Browser tokens remain in memory until reload. Remove access in GitHub settings, and revoke the token on GitHub to disable it everywhere. iOS credential storage may survive reinstalling the app.</Text>
    <Text style={styles.heading}>Remove local data</Text>
    <Text style={styles.body}>This removes saved code decks, progress, recent repositories, activity, onboarding settings, and this app’s stored token. It does not change your GitHub repositories or revoke a token on GitHub. Exported files and browser history must be removed separately.</Text>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} onPress={clear} disabled={busy} style={styles.deleteButton}><Text style={styles.deleteText}>{busy ? "removing…" : confirming ? "confirm: remove all local data" : "remove local app data"}</Text></Pressable>
    {confirming && <Pressable accessibilityRole="button" onPress={() => setConfirming(false)} style={styles.button}><Text style={styles.link}>cancel</Text></Pressable>}
    {!!message && <Text accessibilityLiveRegion="polite" style={styles.body}>{message}</Text>}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  content: { paddingHorizontal: space.xl, gap: space.base },
  title: { fontSize: 30, lineHeight: 36, color: color.text, fontWeight: "800" },
  heading: { fontSize: 18, color: color.text, fontWeight: "600", marginTop: space.sm },
  body: { fontSize: 15, lineHeight: 24, color: color.textSecondary },
  button: { minHeight: 44, justifyContent: "center" },
  link: { fontSize: 16, color: color.blue },
  deleteButton: { minHeight: 52, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: color.again, borderRadius: radius.md, padding: space.sm },
  deleteText: { fontSize: 15, color: color.again, fontWeight: "600" },
});
