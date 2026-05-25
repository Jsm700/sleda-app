import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useTranslation } from "@/src/i18n";
import { colors, spacing, radius } from "@/src/theme/colors";
import { api, type ApiTrip } from "@/src/api/client";
import { formatDateTime, formatDistance, formatDuration } from "@/src/utils/format";

export default function ArchiveScreen() {
  const { t, lang, setLang } = useTranslation();
  const router = useRouter();
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.listTrips();
      setTrips(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const renderItem = ({ item }: { item: ApiTrip }) => (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/trip/${item.id}`)}
      testID={`trip-card-${item.id}`}
    >
      <View style={styles.cardHeader}>
        <MaterialCommunityIcons name="map-marker-path" size={22} color={colors.brand} />
        <Text style={styles.cardDate} numberOfLines={1}>
          {formatDateTime(item.started_at, lang)}
        </Text>
      </View>
      <View style={styles.cardStats}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>{t("distance")}</Text>
          <Text style={styles.statValue}>{formatDistance(item.distance_m)}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>{t("duration")}</Text>
          <Text style={styles.statValue}>{formatDuration(item.duration_s)}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>{t("markers")}</Text>
          <Text style={styles.statValue}>{item.markers.length}</Text>
        </View>
      </View>
    </Pressable>
  );

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="archive-screen">
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>{t("archive")}</Text>
        <View style={styles.langSwitcher}>
          <Pressable
            onPress={() => setLang("bg")}
            style={[styles.langBtn, lang === "bg" && styles.langBtnActive]}
            testID="lang-bg"
          >
            <Text style={[styles.langText, lang === "bg" && styles.langTextActive]}>БГ</Text>
          </Pressable>
          <Pressable
            onPress={() => setLang("en")}
            style={[styles.langBtn, lang === "en" && styles.langBtnActive]}
            testID="lang-en"
          >
            <Text style={[styles.langText, lang === "en" && styles.langTextActive]}>EN</Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <View style={styles.center} testID="archive-loading">
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.subtle}>{t("loading")}</Text>
        </View>
      ) : error ? (
        <View style={styles.center} testID="archive-error">
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorTitle}>{t("loadError")}</Text>
          <Pressable style={styles.retryBtn} onPress={load} testID="archive-retry">
            <Text style={styles.retryText}>{t("retry")}</Text>
          </Pressable>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.center} testID="archive-empty">
          <MaterialCommunityIcons name="map-search-outline" size={72} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyTitle}>{t("archiveEmpty")}</Text>
          <Text style={styles.emptySub}>{t("archiveSub")}</Text>
        </View>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.brand}
              colors={[colors.brand]}
            />
          }
          testID="trip-list"
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", letterSpacing: 0.5 },
  langSwitcher: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langBtn: { paddingVertical: 6, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  langBtnActive: { backgroundColor: colors.brand },
  langText: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "800", letterSpacing: 0.5 },
  langTextActive: { color: "#fff" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: spacing.xl, gap: spacing.sm },
  subtle: { color: colors.onSurfaceTertiary, fontSize: 14 },
  errorTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800" },
  retryBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  retryText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.5 },
  emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: spacing.md, textAlign: "center" },
  emptySub: { color: colors.onSurfaceTertiary, fontSize: 14, textAlign: "center" },
  listContent: { padding: spacing.md, gap: spacing.md },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  cardPressed: { backgroundColor: colors.surfaceTertiary },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  cardDate: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flex: 1 },
  cardStats: { flexDirection: "row", gap: spacing.sm },
  statBlock: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
  },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { color: colors.onSurface, fontSize: 16, fontWeight: "900", marginTop: 2 },
});
