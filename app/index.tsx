/**
 * Home — the beginning of understanding.
 *
 * Jordan Singer: product poetry. The input is an invitation.
 * Muriel Cooper: typography in space. Large, confident, quiet.
 * Sindre Sorhus: one input, one button, one outcome.
 * Christopher Alexander: memory of where you've been.
 */
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { color, space, radius } from "@/lib/design";
import { ingestRepo, type IngestStatus } from "@/lib/ingest";
import { formatRepoSessionName } from "@/lib/github";
import { hasGitHubToken } from "@/lib/github-auth";
import { mockCards } from "@/lib/mock-data";
import { saveDeckSession } from "@/lib/deck-session";
import { haptic } from "@/lib/haptics";
import { getRecent, addRecent, type RecentRepo } from "@/lib/recent";
import { getStreak, recordRepo, type StreakData } from "@/lib/streak";
import { hasOnboarded } from "./onboarding";

export default function Home() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<IngestStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<RecentRepo[]>([]);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    // Check onboarding
    hasOnboarded().then((done) => {
      if (!done) router.replace("/onboarding");
    });
    getRecent().then(setRecent);
    getStreak().then(setStreak);
    hasGitHubToken().then(setHasToken);
  }, []);

  useFocusEffect(
    useCallback(() => {
      hasGitHubToken().then(setHasToken);
    }, [])
  );

  // Reload recent list and streak when returning to this screen
  const refreshRecent = useCallback(() => {
    getRecent().then(setRecent);
    getStreak().then(setStreak);
    hasGitHubToken().then(setHasToken);
  }, []);

  const isLoading =
    status !== null &&
    status.phase !== "done" &&
    status.phase !== "error";

  const handleIngest = async () => {
    if (!input.trim() || isLoading) return;
    setError(null);
    haptic.light();

    try {
      const result = await ingestRepo(input.trim(), setStatus);
      haptic.success();

      // Track repo + save to recent
      await recordRepo();
      await addRecent({
        owner: result.meta.fullName.split("/")[0],
        repo: result.meta.fullName.split("/")[1],
        fullName: result.meta.fullName,
        input: input.trim(),
        scopePath: result.scopePath,
        description: result.meta.description ?? "",
        stars: result.meta.stars,
        cardCount: result.cards.length,
      });

      const session = await saveDeckSession({ cards: result.cards, repoName: result.repoSessionName,
        repoDesc: result.meta.description ?? "", repoStars: String(result.meta.stars) });
      router.push({ pathname: "/feed", params: { session } });
      // Reset for when user comes back
      setStatus(null);
      setInput("");
      refreshRecent();
    } catch (e: any) {
      setError(e.message ?? "Something went wrong");
      setStatus({ phase: "error", message: e.message });
      haptic.medium();
    }
  };

  const handleDemo = async () => {
    haptic.light();
    try {
      const session = await saveDeckSession({ cards: mockCards, repoName: "demo/typescript-patterns",
        repoDesc: "10 TypeScript patterns to explore", repoStars: "0" });
      router.push({ pathname: "/feed", params: { session } });
    } catch { setError("Could not save this deck on the device. Try again."); }
  };

  const handleRecentTap = (repo: RecentRepo) => {
    setInput(repo.input);
    // Auto-ingest
    haptic.light();
    setError(null);
    ingestRepo(repo.input, setStatus)
      .then(async (result) => {
        haptic.success();
        await recordRepo();
        await addRecent({
          owner: repo.owner,
          repo: repo.repo,
          fullName: repo.fullName,
          input: repo.input,
          scopePath: result.scopePath,
          description: repo.description,
          stars: repo.stars,
          cardCount: result.cards.length,
        });
        const session = await saveDeckSession({ cards: result.cards, repoName: result.repoSessionName,
          repoDesc: result.meta.description ?? "", repoStars: String(result.meta.stars) });
        router.push({ pathname: "/feed", params: { session } });
        setStatus(null);
        setInput("");
        refreshRecent();
      })
      .catch((e: any) => {
        setError(e.message ?? "Something went wrong");
        setStatus({ phase: "error", message: e.message });
        haptic.medium();
      });
  };

  const statusMessage =
    status && status.phase !== "done" && status.phase !== "error"
      ? "message" in status
        ? status.message
        : "Starting..."
      : null;

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top + space.xxxl }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Title + streak */}
        <View style={styles.titleRow}>
          <Text style={styles.title}>doomscroll</Text>
          {streak && streak.current > 0 && (
            <Pressable
              style={styles.streakBadge}
              accessibilityRole="button"
              accessibilityLabel="View activity statistics"
              onPress={() => router.push("/stats")}
            >
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakCount}>{streak.current}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>
          learn your way around{"\n"}a codebase
        </Text>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            accessibilityLabel="GitHub repository or folder URL"
            value={input}
            onChangeText={setInput}
            placeholder="owner/repo#apps/mobile"
            placeholderTextColor={color.textTertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleIngest}
            editable={!isLoading}
          />

          <Pressable
            style={({ pressed }) => [
              styles.button,
              isLoading && styles.buttonDisabled,
              pressed && !isLoading && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel={isLoading ? "Importing repository" : "Learn this repository"}
            accessibilityState={{ disabled: isLoading || !input.trim(), busy: isLoading }}
            onPress={handleIngest}
            disabled={isLoading || !input.trim()}
          >
            {isLoading ? (
              <ActivityIndicator color={color.bg} size="small" />
            ) : (
              <Text style={styles.buttonText}>learn</Text>
            )}
          </Pressable>
        </View>

        {/* Status message */}
        {statusMessage && (
          <Text style={styles.status}>{statusMessage}</Text>
        )}

        {/* Error */}
        {error && <Text style={styles.error}>{error}</Text>}

        {/* Demo link */}
        <View style={styles.utilityRow}>
          <Pressable
            style={({ pressed }) => [
              styles.demoButton,
              pressed && styles.demoButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Try the demo deck"
            onPress={handleDemo}
          >
            <Text style={styles.demoText}>try the demo deck</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.tokenButton,
              pressed && styles.tokenButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="GitHub access for private repositories"
            onPress={() => router.push("/github")}
          >
            <Text style={styles.tokenButtonText}>
              {hasToken ? "github connected" : "private repos"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.tokenButton,
              pressed && styles.tokenButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Import a local deck file"
            onPress={() => router.push("/import")}
          >
            <Text style={styles.tokenButtonText}>import deck</Text>
          </Pressable>
        </View>

        {/* Recent repos */}
        {recent.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>recent</Text>
            {recent.map((repo) => (
              <Pressable
                key={repo.input}
                style={({ pressed }) => [
                  styles.recentItem,
                  pressed && styles.recentItemPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${formatRepoSessionName(repo.fullName, repo.scopePath)}`}
                accessibilityState={{ disabled: isLoading }}
                onPress={() => handleRecentTap(repo)}
                disabled={isLoading}
              >
                <View style={styles.recentLeft}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {formatRepoSessionName(repo.fullName, repo.scopePath)}
                  </Text>
                  {repo.description ? (
                    <Text style={styles.recentDesc} numberOfLines={1}>
                      {repo.description}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.recentRight}>
                  <Text style={styles.recentCards}>
                    {repo.cardCount} cards
                  </Text>
                  {repo.stars > 0 && (
                    <Text style={styles.recentStars}>
                      ★ {repo.stars >= 1000 ? `${(repo.stars / 1000).toFixed(1)}k` : repo.stars}
                    </Text>
                  )}
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable accessibilityRole="button" accessibilityLabel="Privacy and local data" onPress={() => router.push("/privacy")} style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: color.textSecondary, fontSize: 13 }}>privacy & local data</Text>
      </Pressable>
      {/* Bottom hint */}
      <Text style={[styles.hint, { paddingBottom: insets.bottom + space.lg }]}>
        works with public repos, scoped monorepo paths, and private repos with a token
      </Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 40,
    fontWeight: "800",
    color: color.text,
    letterSpacing: -1.5,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: radius.full,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    gap: 4,
    borderWidth: 1,
    borderColor: color.borderSubtle,
  },
  streakFire: {
    fontSize: 16,
  },
  streakCount: {
    fontSize: 16,
    fontWeight: "700",
    color: color.amber,
    fontFamily: "monospace",
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 26,
    color: color.textSecondary,
    marginTop: space.sm,
    marginBottom: space.xxxl,
  },
  inputContainer: {
    flexDirection: "row",
    gap: space.sm,
  },
  input: {
    flex: 1,
    height: 52,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingHorizontal: space.base,
    fontSize: 16,
    color: color.text,
    fontFamily: "monospace",
  },
  button: {
    height: 52,
    paddingHorizontal: space.xl,
    backgroundColor: color.text,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textInverse,
    letterSpacing: 0.5,
  },
  status: {
    fontSize: 13,
    color: color.textSecondary,
    marginTop: space.md,
    fontFamily: "monospace",
  },
  error: {
    fontSize: 13,
    color: color.again,
    marginTop: space.md,
  },
  demoButton: {
    minHeight: 44,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  demoButtonPressed: {
    opacity: 0.6,
  },
  demoText: {
    fontSize: 15,
    color: color.textTertiary,
    textDecorationLine: "underline",
    textDecorationColor: color.borderSubtle,
  },
  utilityRow: {
    marginTop: space.xxl,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.md,
    alignItems: "center",
  },
  tokenButton: {
    minHeight: 44,
    paddingHorizontal: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.border,
    backgroundColor: color.surface,
    justifyContent: "center",
  },
  tokenButtonPressed: {
    opacity: 0.75,
  },
  tokenButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textSecondary,
    letterSpacing: 0.3,
  },
  // Recent repos
  recentSection: {
    marginTop: space.xxxl,
  },
  recentTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textTertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: space.md,
  },
  recentItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.md,
    paddingHorizontal: space.base,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    marginBottom: space.sm,
    borderWidth: 1,
    borderColor: color.borderSubtle,
  },
  recentItemPressed: {
    backgroundColor: color.surfaceHover,
  },
  recentLeft: {
    flex: 1,
    marginRight: space.md,
  },
  recentName: {
    fontSize: 14,
    fontWeight: "600",
    color: color.text,
    fontFamily: "monospace",
  },
  recentDesc: {
    fontSize: 12,
    color: color.textTertiary,
    marginTop: 2,
  },
  recentRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  recentCards: {
    fontSize: 12,
    color: color.textSecondary,
    fontFamily: "monospace",
  },
  recentStars: {
    fontSize: 11,
    color: color.textTertiary,
  },
  hint: {
    fontSize: 12,
    color: color.textTertiary,
    textAlign: "center",
    letterSpacing: 0.5,
  },
});
