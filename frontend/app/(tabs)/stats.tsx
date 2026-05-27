import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, ScrollView, RefreshControl, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "@/src/i18n";
import { colors, spacing, radius } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { formatDistance, formatDuration } from "@/src/utils/format";
import type { MarkerType } from "@/src/components/MapCanvas.types";

const MARKER_META: { type: MarkerType; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; labelKey: "car" | "fish" | "mushroom" | "hazard" | "water" | "poi" | "note" }[] = [
  { type: "car", icon: "car", color: colors.markerCar, labelKey: "car" },
  { type: "fish", icon: "fish", color: colors.markerFish, labelKey: "fish" },
  { type: "mushroom", icon: "mushroom", color: colors.markerMushroom, labelKey: "mushroom" },
  { type: "hazard", icon: "alert", color: colors.markerHazard, labelKey: "hazard" },
  { type: "water", icon: "water", color: colors.markerWater, labelKey: "water" },
  { type: "poi", icon: "map-marker", color: colors.brand, labelKey: "poi" },
  { type: "note", icon: "note-edit-outline", color: colors.info, labelKey: "note" },
];

type Stats = {
  total_trips: number;
  total_distance_m: number;
  total_duration_s: number;
  markers_by_type: Partial<Record<MarkerType, number>>;
};

export default function StatsScreen() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = (await api.getStats()) as Stats;
      setStats(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const sortedMarkers = stats
    ? MARKER_META.map((m) => ({ ...m, count: stats.markers_by_type[m.type] ?? 0 }))
        .filter((m) => m.count > 0)
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="stats-screen">
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>{t("stats")}</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{t("loadError")}</Text>
          <Pressable style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>{t("retry")}</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
        >
          <View style={styles.kpiRow}>
            <View style={styles.kpiCard}>
              <MaterialCommunityIcons name="map-marker-path" size={24} color={colors.brand} />
              <Text style={styles.kpiValue} testID="stat-trips">{stats?.total_trips ?? 0}</Text>
              <Text style={styles.kpiLabel}>{t("totalTrips")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <MaterialCommunityIcons name="map-marker-distance" size={24} color={colors.markerFish} />
              <Text style={styles.kpiValue} testID="stat-distance">{formatDistance(stats?.total_distance_m ?? 0)}</Text>
              <Text style={styles.kpiLabel}>{t("totalDistance")}</Text>
            </View>
            <View style={styles.kpiCard}>
              <MaterialCommunityIcons name="timer-outline" size={24} color={colors.markerCar} />
              <Text style={styles.kpiValue} testID="stat-duration">{formatDuration(stats?.total_duration_s ?? 0)}</Text>
              <Text style={styles.kpiLabel}>{t("totalTime")}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t("favoritePlaces")}</Text>
          {sortedMarkers.length === 0 ? (
            <View style={styles.emptyMarkers}>
              <Text style={styles.subtle}>—</Text>
            </View>
          ) : (
            sortedMarkers.map((m) => (
              <View key={m.type} style={styles.markerRow}>
                <View style={[styles.markerIconWrap, { backgroundColor: m.color }]}>
                  <MaterialCommunityIcons name={m.icon} size={20} color="#fff" />
                </View>
                <Text style={styles.markerLabel}>{t(m.labelKey)}</Text>
                <Text style={styles.markerCount}>{m.count}</Text>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", letterSpacing: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  errorText: { color: colors.onSurface, fontWeight: "800" },
  retryBtn: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, marginTop: spacing.sm },
  retryText: { color: "#fff", fontWeight: "800" },
  scroll: { padding: spacing.md, gap: spacing.lg },
  kpiRow: { flexDirection: "row", gap: spacing.sm },
  kpiCard: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: 4,
  },
  kpiValue: { color: colors.onSurface, fontSize: 18, fontWeight: "900", marginTop: 4 },
  kpiLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  sectionTitle: { color: colors.onSurface, fontSize: 16, fontWeight: "800", marginTop: spacing.md, marginBottom: spacing.sm },
  emptyMarkers: { padding: spacing.md, alignItems: "center" },
  subtle: { color: colors.onSurfaceTertiary },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  markerIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  markerLabel: { flex: 1, color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  markerCount: { color: colors.brand, fontSize: 20, fontWeight: "900" },
});
