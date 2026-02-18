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
import { useRouter } from "expo-router";
import { color, space, radius } from "@/lib/design";
import { ingestRepo, type IngestStatus } from "@/lib/ingest";
import { mockCards } from "@/lib/mock-data";
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

  useEffect(() => {
    // Check onboarding
    hasOnboarded().then((done) => {
      if (!done) router.replace("/onboarding");
    });
    getRecent().then(setRecent);
    getStreak().then(setStreak);
  }, []);

  // Reload recent list and streak when returning to this screen
  const refreshRecent = useCallback(() => {
    getRecent().then(setRecent);
    getStreak().then(setStreak);
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
        description: result.meta.description ?? "",
        stars: result.meta.stars,
        cardCount: result.cards.length,
      });

      router.push({
        pathname: "/feed",
        params: {
          cards: JSON.stringify(result.cards),
          repoName: result.meta.fullName,
          repoDesc: result.meta.description ?? "",
          repoStars: String(result.meta.stars),
        },
      });
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

  const handleDemo = () => {
    haptic.light();
    router.push({
      pathname: "/feed",
      params: {
        cards: JSON.stringify(mockCards),
        repoName: "demo/typescript-patterns",
        repoDesc: "10 TypeScript patterns to master",
        repoStars: "0",
      },
    });
  };

  const handleRecentTap = (repo: RecentRepo) => {
    setInput(repo.fullName);
    // Auto-ingest
    haptic.light();
    setError(null);
    ingestRepo(repo.fullName, setStatus)
      .then(async (result) => {
        haptic.success();
        await recordRepo();
        await addRecent({
          owner: repo.owner,
          repo: repo.repo,
          fullName: repo.fullName,
          description: repo.description,
          stars: repo.stars,
          cardCount: result.cards.length,
        });
        router.push({
          pathname: "/feed",
          params: {
            cards: JSON.stringify(result.cards),
            repoName: result.meta.fullName,
            repoDesc: result.meta.description ?? "",
            repoStars: String(result.meta.stars),
          },
        });
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
              onPress={() => router.push("/stats")}
            >
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakCount}>{streak.current}</Text>
            </Pressable>
          )}
        </View>
        <Text style={styles.subtitle}>
          master any codebase{"\n"}by scrolling through it
        </Text>

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="owner/repo or github url"
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
        <Pressable
          style={({ pressed }) => [
            styles.demoButton,
            pressed && styles.demoButtonPressed,
          ]}
          onPress={handleDemo}
        >
          <Text style={styles.demoText}>or try the demo deck</Text>
        </Pressable>

        {/* Recent repos */}
        {recent.length > 0 && (
          <View style={styles.recentSection}>
            <Text style={styles.recentTitle}>recent</Text>
            {recent.map((repo) => (
              <Pressable
                key={repo.fullName}
                style={({ pressed }) => [
                  styles.recentItem,
                  pressed && styles.recentItemPressed,
                ]}
                onPress={() => handleRecentTap(repo)}
                disabled={isLoading}
              >
                <View style={styles.recentLeft}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {repo.fullName}
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

      {/* Bottom hint */}
      <Text style={[styles.hint, { paddingBottom: insets.bottom + space.lg }]}>
        works with any public github repo
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
    marginTop: space.xxl,
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
