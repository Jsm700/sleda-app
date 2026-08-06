import { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, Modal, Image, ScrollView, Share } from "react-native";
import type { MapMarker } from "@/src/components/MapCanvas.types";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import MapCanvas from "@/src/components/MapCanvas";
import type { MapCanvasHandle, MarkerType } from "@/src/components/MapCanvas.types";
import { useTranslation } from "@/src/i18n";
import { colors, spacing, radius } from "@/src/theme/colors";
import { api, type ApiTrip } from "@/src/api/client";
import { formatDateTime, formatDistance, formatDuration } from "@/src/utils/format";
import { shareTripAsGpx } from "@/src/utils/gpx";
import { computeBearing } from "@/src/utils/bearing";

const MARKER_COLORS: Record<MarkerType, string> = {
  car: colors.markerCar,
  fish: colors.markerFish,
  mushroom: colors.markerMushroom,
  hazard: colors.markerHazard,
  water: colors.markerWater,
  poi: colors.brand,
  note: colors.info,
  start: colors.success,
  end: colors.error,
};

const MARKER_LABELS_BG: Record<MarkerType, string> = {
  car: "Кола / Лодка",
  fish: "Риба",
  mushroom: "Гъба",
  hazard: "Опасност",
  water: "Чешма",
  poi: "Маркер",
  note: "Бележка",
  start: "Начало",
  end: "Край",
};
const MARKER_LABELS_EN: Record<MarkerType, string> = {
  car: "Car / Boat",
  fish: "Fish",
  mushroom: "Mushroom",
  hazard: "Hazard",
  water: "Water",
  poi: "Marker",
  note: "Note",
  start: "Start",
  end: "End",
};

export default function TripDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, lang } = useTranslation();

  const [trip, setTrip] = useState<ApiTrip | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    setLoading(true);
    try {
      const data = await api.getTrip(id);
      setTrip(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleExportGpx = useCallback(async () => {
    if (!trip) return;
    try {
      await shareTripAsGpx(trip);
    } catch (e) {
      Alert.alert(t("saveError"), String(e));
    }
  }, [trip, t]);

  const handleShareLink = useCallback(async () => {
    if (!trip) return;
    const url = `${process.env.EXPO_PUBLIC_BACKEND_URL}/trip/${trip.id}`;
    try {
      await Share.share({ message: url, url });
    } catch (e) {
      Alert.alert(t("saveError"), String(e));
    }
  }, [trip, t]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert(t("delete"), t("deleteConfirm"), [
      { text: t("cancel"), style: "cancel" },
      {
        text: t("delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await api.deleteTrip(id);
            router.back();
          } catch (e) {
            Alert.alert(t("saveError"), String(e));
          }
        },
      },
    ]);
  }, [id, router, t]);

  const route = trip?.route ?? [];
  const markers = trip?.markers ?? [];

  const center = route[0] ??
    (markers[0]
      ? { latitude: markers[0].latitude, longitude: markers[0].longitude }
      : { latitude: 42.6977, longitude: 23.3219 });

  const initialRegion = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  const labels = lang === "bg" ? MARKER_LABELS_BG : MARKER_LABELS_EN;

  const routePoints = route.map((p, i) => ({
    latitude: p.latitude,
    longitude: p.longitude,
    timestamp: typeof p.timestamp === "string" ? new Date(p.timestamp).getTime() : i,
  }));
  const mapMarkers = markers.map((m, i) => ({
    id: m.id ?? `${i}`,
    type: m.type,
    latitude: m.latitude,
    longitude: m.longitude,
    timestamp: 0,
    note: m.note ?? null,
    photo: m.photo ?? null,
  }));

  const segments = trip?.segments ?? [];
  const routeSegmentsDrawing = segments.length > 0
    ? segments.map((seg) => {
        const startMs = new Date(seg.started_at).getTime();
        const endMs = new Date(seg.ended_at).getTime();
        return {
          points: routePoints.filter((p) => p.timestamp >= startMs && p.timestamp <= endMs),
          color: seg.type === "pause" ? colors.onSurfaceTertiary : colors.brand,
          dashed: seg.type === "pause",
        };
      })
    : undefined;

  const pauseSegments = segments.filter((s) => s.type === "pause");
  const moveSegments = segments.filter((s) => s.type === "move");
  const hasPauses = pauseSegments.length > 0;

  const ARROW_INTERVAL = 8; // points between arrows — denser trips get more arrows
  const movePointsForArrows = segments.length > 0
    ? moveSegments.flatMap((seg) => {
        const startMs = new Date(seg.started_at).getTime();
        const endMs = new Date(seg.ended_at).getTime();
        return routePoints.filter((p) => p.timestamp >= startMs && p.timestamp <= endMs);
      })
    : routePoints;
  const directionArrows = (() => {
    const arrows: { latitude: number; longitude: number; rotation: number }[] = [];
    for (let i = 0; i < movePointsForArrows.length - 1; i += ARROW_INTERVAL) {
      const a = movePointsForArrows[i];
      const b = movePointsForArrows[Math.min(i + 1, movePointsForArrows.length - 1)];
      if (a.latitude === b.latitude && a.longitude === b.longitude) continue;
      arrows.push({ latitude: a.latitude, longitude: a.longitude, rotation: computeBearing(a, b) });
    }
    return arrows;
  })();

  const pauseDurationS = pauseSegments.reduce(
    (sum, s) => sum + Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000),
    0,
  );
  const moveDurationS = moveSegments.reduce(
    (sum, s) => sum + Math.max(0, (new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000),
    0,
  );

  return (
    <View style={styles.root} testID="trip-detail-screen">
      <StatusBar style="light" />

      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            testID="back-btn"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>{t("tripDetail")}</Text>
          <View style={{ flexDirection: "row" }}>
            <Pressable
              onPress={handleExportGpx}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              testID="export-gpx-btn"
            >
              <MaterialCommunityIcons name="export-variant" size={22} color={colors.brand} />
            </Pressable>
            <Pressable
              onPress={handleShareLink}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              testID="share-link-btn"
            >
              <MaterialCommunityIcons name="link-variant" size={22} color={colors.brand} />
            </Pressable>
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
              testID="delete-btn"
            >
              <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.error} />
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.mapWrap}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.subtle}>{t("loading")}</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
            <Text style={styles.errorText}>{t("loadError")}</Text>
            <Pressable style={styles.retryBtn} onPress={load} testID="detail-retry">
              <Text style={styles.retryText}>{t("retry")}</Text>
            </Pressable>
          </View>
        ) : (
       <MapCanvas
            ref={undefined as unknown as React.Ref<MapCanvasHandle>}
            initialRegion={initialRegion}
            route={routePoints}
            routeSegments={routeSegmentsDrawing}
            directionArrows={directionArrows}
            markers={mapMarkers}
            brandColor={colors.brand}
            markerColorFor={(type) => MARKER_COLORS[type]}
            markerLabelFor={(type) => labels[type]}
            onMarkerPress={(m) => { if (m.photo || m.note) setSelectedMarker(m); }}
          />   
        )}
      </View>

      {trip && !loading && (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Text style={styles.date} testID="detail-date">
            {formatDateTime(trip.started_at, lang)}
          </Text>
          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>{t("distance")}</Text>
              <Text style={styles.statValue} testID="detail-distance">
                {formatDistance(trip.distance_m)}
              </Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>{t("duration")}</Text>
              <Text style={styles.statValue} testID="detail-duration">
                {formatDuration(trip.duration_s)}
              </Text>
            </View>
            <View style={styles.statBlock}>
              <Text style={styles.statLabel}>{t("markers")}</Text>
              <Text style={styles.statValue} testID="detail-markers">
                {trip.markers.length}
              </Text>
            </View>
          </View>
          {hasPauses && (
            <View style={styles.segmentBreakdown} testID="segment-breakdown">
              <View style={styles.segmentRow}>
                <View style={styles.segmentDot} />
                <Text style={styles.segmentText}>Движение: {formatDuration(moveDurationS)}</Text>
              </View>
              <View style={styles.segmentRow}>
                <View style={[styles.segmentDot, styles.segmentDotPause]} />
                <Text style={styles.segmentText}>Пауза: {formatDuration(pauseDurationS)}</Text>
              </View>
            </View>
          )}
        </View>
      )}
   <Modal visible={!!selectedMarker} transparent animationType="fade" onRequestClose={() => setSelectedMarker(null)}>
        <Pressable style={styles.photoBackdrop} onPress={() => setSelectedMarker(null)}>
          <View style={styles.photoViewer}>
            {selectedMarker?.photo && (
              <Image source={{ uri: selectedMarker.photo }} style={styles.photoFull} resizeMode="contain" />
            )}
            {selectedMarker?.note && (
              <Text style={styles.photoNote}>{selectedMarker.note}</Text>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerWrap: { backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  pressed: { backgroundColor: colors.surfaceTertiary },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "900", letterSpacing: 0.5 },
  mapWrap: { flex: 1, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  subtle: { color: colors.onSurfaceTertiary },
  errorText: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  retryBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  retryText: { color: "#fff", fontWeight: "800", letterSpacing: 0.5 },
  bottom: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  date: { color: colors.onSurfaceSecondary, fontSize: 14, fontWeight: "700" },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  segmentBreakdown: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xs },
  segmentRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  segmentDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
  segmentDotPause: { backgroundColor: colors.onSurfaceTertiary },
  segmentText: { color: colors.onSurfaceSecondary, fontSize: 12, fontWeight: "600" },
  statBlock: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    alignItems: "center",
  },
  statLabel: { color: colors.onSurfaceTertiary, fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4 },
  statValue: { color: colors.onSurface, fontSize: 18, fontWeight: "900", marginTop: 2 },
  photoBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  photoViewer: { width: "100%", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  photoFull: { width: "100%", height: 400, borderRadius: radius.md },
  photoNote: { color: colors.onSurface, fontSize: 16, fontWeight: "700", textAlign: "center" },
});
