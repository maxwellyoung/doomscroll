import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";

import { color, radius, space } from "@/lib/design";
import { haptic } from "@/lib/haptics";
import { parsePortableDeck } from "@/lib/portable-deck";
import { saveDeckSession } from "@/lib/deck-session";

export default function ImportDeck() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const handlePickDeck = async () => {
    try {
      setIsImporting(true);
      setError(null);
      setMessage(null);

      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.[0]) {
        setMessage("Import canceled.");
        return;
      }

      const asset = result.assets[0];
      // Expo FileSystem has no browser implementation; use the picker’s File.
      if (Platform.OS === "web" && !asset.file) throw new Error("Could not read this browser file. Choose the JSON deck again.");
      const raw = asset.file ? await asset.file.text() : await new File(asset.uri).text();
      const deck = parsePortableDeck(raw);

      await haptic.success();
      const session = await saveDeckSession({ cards: deck.cards, repoName: deck.meta.repoName,
        repoDesc: deck.meta.description ?? "Imported deck", repoStars: "0" });
      router.push({ pathname: "/feed", params: { session } });
    } catch (e: any) {
      setError(e?.message ?? "Failed to import deck.");
      await haptic.medium();
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.lg }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>import deck</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.hero}>
          <Text style={styles.title}>study a local repo</Text>
          <Text style={styles.subtitle}>
            Import a portable deck JSON exported from a local codebase, then
            study it like any other doomscroll session.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>how it works</Text>
          <Text style={styles.body}>
            1. Run the local export script on your machine.
          </Text>
          <Text style={styles.body}>
            2. Save the generated `.json` file somewhere accessible.
          </Text>
          <Text style={styles.body}>
            3. Import it here and jump straight into the deck.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>export command</Text>
          <Text style={styles.example}>
            npm run deck:export-local -- /path/to/repo --scope apps/mobile
          </Text>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={({ pressed }) => [
            styles.button,
            (pressed || isImporting) && styles.buttonDim,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Choose a JSON deck file"
          accessibilityState={{ disabled: isImporting, busy: isImporting }}
          onPress={handlePickDeck}
          disabled={isImporting}
        >
          <Text style={styles.buttonText}>
            {isImporting ? "importing..." : "choose deck file"}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
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
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: color.textSecondary,
  },
  example: {
    fontSize: 13,
    lineHeight: 20,
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
  button: {
    height: 54,
    backgroundColor: color.text,
    borderRadius: radius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDim: {
    opacity: 0.75,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: color.textInverse,
    letterSpacing: 0.4,
  },
});
