import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  AppState,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";

import { color, radius, space } from "@/lib/design";
import { haptic } from "@/lib/haptics";
import {
  clearGitHubToken,
  getGitHubToken,
  maskGitHubToken,
  saveGitHubToken,
} from "@/lib/github-auth";

export default function GitHubSettings() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [token, setToken] = useState("");
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [accessUnavailable, setAccessUnavailable] = useState(false);
  const refreshAccess = useCallback(async () => {
    try {
      const stored = await getGitHubToken();
      setSavedToken(stored); setAccessUnavailable(false); setError(null);
    } catch {
      setAccessUnavailable(true);
      setError("GitHub access could not be opened securely. Unlock this device and retry.");
    }
  }, []);
  useFocusEffect(useCallback(() => {
    let active = true;
    const refresh = () => { if (active) void refreshAccess(); };
    refresh();
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { active = false; subscription.remove(); };
  }, [refreshAccess]));

  const maskedToken = useMemo(() => maskGitHubToken(savedToken), [savedToken]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);
      await saveGitHubToken(token);
      const next = await getGitHubToken();
      setSavedToken(next);
      setAccessUnavailable(false);
      setToken("");
      setMessage(Platform.OS === "web" ? "Connected for this browser session." : "GitHub token saved in the device credential vault.");
      await haptic.success();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save token.");
      await haptic.medium();
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);
      await clearGitHubToken();
      setSavedToken(null);
      setAccessUnavailable(false);
      setToken("");
      setMessage("GitHub token removed.");
      await haptic.light();
    } catch (e: any) {
      setError(e?.message ?? "Failed to clear token.");
      await haptic.medium();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + space.lg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>github access</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>private repos need a key</Text>
          <Text style={styles.subtitle}>
            Add a GitHub token to let doomscroll read private repositories and
            avoid low anonymous rate limits.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>status</Text>
          <Text style={styles.statusValue}>{accessUnavailable ? "access unavailable" : maskedToken}</Text>
          <Text style={styles.helper}>
            {Platform.OS === "web"
              ? "Kept in memory until this page reloads. Use a read-only token."
              : "Stored in the device credential vault. Use a read-only token. Remove it here before giving away this device."}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>personal access token</Text>
          <TextInput
            style={styles.input}
            accessibilityLabel="GitHub personal access token"
            value={token}
            onChangeText={setToken}
            placeholder="github_pat_..."
            placeholderTextColor={color.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            editable={!isSaving}
          />
          <Text style={styles.helper}>
            Fine-grained token with repository read access is enough.
          </Text>

          {message ? <Text style={styles.message}>{message}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          {accessUnavailable && <Pressable accessibilityRole="button" accessibilityLabel="Retry opening GitHub access"
            onPress={() => { void refreshAccess(); }} disabled={isSaving} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>retry secure access</Text>
          </Pressable>}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSaving || !token.trim()) && styles.primaryButtonDim,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Save GitHub access token"
            accessibilityState={{ disabled: isSaving || !token.trim(), busy: isSaving }}
            onPress={handleSave}
            disabled={isSaving || !token.trim()}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? "saving..." : "save token"}
            </Text>
          </Pressable>

          {savedToken ? (
            <Pressable
              style={({ pressed }) => [
                styles.secondaryButton,
                pressed && styles.secondaryButtonDim,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Remove GitHub access token"
              accessibilityState={{ disabled: isSaving }}
              onPress={handleClear}
              disabled={isSaving}
            >
              <Text style={styles.secondaryButtonText}>remove token</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>input examples</Text>
          <Text style={styles.example}>octokit/rest.js#src</Text>
          <Text style={styles.example}>
            https://github.com/octokit/rest.js/tree/main/src
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  content: {
    paddingHorizontal: space.xl,
    gap: space.lg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.lg,
  },
  backArrow: {
    fontSize: 22,
    color: color.textSecondary,
    fontWeight: "600",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: color.text,
    letterSpacing: -0.3,
  },
  hero: {
    gap: space.sm,
    marginBottom: space.sm,
  },
  title: {
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "800",
    color: color.text,
    letterSpacing: -1.1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 24,
    color: color.textSecondary,
  },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.borderSubtle,
    padding: space.lg,
    gap: space.sm,
  },
  label: {
    fontSize: 11,
    fontWeight: "700",
    color: color.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  statusValue: {
    fontSize: 16,
    color: color.text,
    fontFamily: "monospace",
  },
  helper: {
    fontSize: 13,
    lineHeight: 20,
    color: color.textSecondary,
  },
  input: {
    height: 52,
    backgroundColor: color.bg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.base,
    fontSize: 15,
    color: color.text,
    fontFamily: "monospace",
  },
  message: {
    fontSize: 13,
    color: color.green,
  },
  error: {
    fontSize: 13,
    color: color.again,
  },
  primaryButton: {
    height: 52,
    backgroundColor: color.text,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: space.xs,
  },
  primaryButtonDim: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textInverse,
    letterSpacing: 0.4,
  },
  secondaryButton: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonDim: {
    opacity: 0.6,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: color.textSecondary,
  },
  example: {
    fontSize: 13,
    lineHeight: 20,
    color: color.text,
    fontFamily: "monospace",
  },
});
