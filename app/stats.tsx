/**
 * Stats — proof of learning.
 *
 * Dieter Rams: honest data, no vanity metrics.
 * Susan Kare: compact visual density.
 */
import { View, Text, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import { color, space, radius } from "@/lib/design";
import { getStreak, getActivityDays, type StreakData } from "@/lib/streak";

export default function Stats() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [streak, setStreak] = useState<StreakData | null>(null);

  useEffect(() => {
    getStreak().then(setStreak);
  }, []);

  if (!streak) return null;

  const activity = getActivityDays(streak, 35);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + space.lg }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.backArrow}>←</Text>
        </Pressable>
        <Text style={styles.headerTitle}>your stats</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Streak hero */}
      <View style={styles.streakHero}>
        <Text style={styles.streakFire}>🔥</Text>
        <Text style={styles.streakNumber}>{streak.current}</Text>
        <Text style={styles.streakLabel}>
          {streak.current === 1 ? "day streak" : "day streak"}
        </Text>
      </View>

      {/* Stats grid */}
      <View style={styles.grid}>
        <StatBox label="longest streak" value={`${streak.longest}d`} />
        <StatBox label="cards mastered" value={String(streak.totalMastered)} />
        <StatBox label="total swipes" value={String(streak.totalSwipes)} />
        <StatBox label="repos learned" value={String(streak.totalRepos)} />
      </View>

      {/* Activity heatmap */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>last 5 weeks</Text>
        <View style={styles.heatmap}>
          {activity.map((day, i) => (
            <View
              key={i}
              style={[
                styles.heatCell,
                {
                  backgroundColor: day.active
                    ? color.green
                    : color.borderSubtle,
                  opacity: day.active ? 1 : 0.4,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.heatLegend}>
          <Text style={styles.legendText}>less</Text>
          <View style={[styles.heatCell, { backgroundColor: color.borderSubtle, opacity: 0.4 }]} />
          <View style={[styles.heatCell, { backgroundColor: color.green }]} />
          <Text style={styles.legendText}>more</Text>
        </View>
      </View>

      {/* Bottom spacer */}
      <View style={{ height: insets.bottom + space.lg }} />
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: color.bg,
    paddingHorizontal: space.xl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: space.xxl,
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
  // Streak hero
  streakHero: {
    alignItems: "center",
    paddingVertical: space.xxl,
    gap: space.xs,
  },
  streakFire: {
    fontSize: 48,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: "800",
    color: color.text,
    fontFamily: "monospace",
    letterSpacing: -2,
  },
  streakLabel: {
    fontSize: 15,
    color: color.textSecondary,
    letterSpacing: 0.5,
  },
  // Stats grid
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: space.sm,
  },
  statBox: {
    width: "48%",
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.borderSubtle,
    padding: space.base,
    gap: space.xs,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: color.text,
    fontFamily: "monospace",
  },
  statLabel: {
    fontSize: 12,
    color: color.textTertiary,
    letterSpacing: 0.5,
  },
  // Heatmap
  section: {
    marginTop: space.xxl,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: color.textTertiary,
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: space.md,
  },
  heatmap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  heatCell: {
    width: 16,
    height: 16,
    borderRadius: 3,
  },
  heatLegend: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: space.sm,
    justifyContent: "flex-end",
  },
  legendText: {
    fontSize: 10,
    color: color.textTertiary,
  },
});
