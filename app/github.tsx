import { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

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

  useEffect(() => {
    getGitHubToken().then(setSavedToken);
  }, []);

  const maskedToken = useMemo(() => maskGitHubToken(savedToken), [savedToken]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setMessage(null);
      await saveGitHubToken(token);
      const next = await getGitHubToken();
      setSavedToken(next);
      setToken("");
      setMessage("GitHub token saved locally on this device.");
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
          <Pressable onPress={() => router.back()} hitSlop={12}>
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
          <Text style={styles.statusValue}>{maskedToken}</Text>
          <Text style={styles.helper}>
            Stored locally on this device. Use a read-only token if possible.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>personal access token</Text>
          <TextInput
            style={styles.input}
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
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              (pressed || isSaving || !token.trim()) && styles.primaryButtonDim,
            ]}
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
              onPress={handleClear}
              disabled={isSaving}
            >
              <Text style={styles.secondaryButtonText}>remove token</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>input examples</Text>
          <Text style={styles.example}>maxwellyoung/silk-monorepo#apps/mobile</Text>
          <Text style={styles.example}>
            https://github.com/maxwellyoung/silk-monorepo/tree/monorepo/apps/mobile
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
