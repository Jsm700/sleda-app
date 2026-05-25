import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapCanvas from "@/src/components/MapCanvas";
import type { MapMarker, RoutePoint, MarkerType, MapCanvasHandle } from "@/src/components/MapCanvas.types";
import { colors, spacing, radius } from "@/src/theme/colors";
import { useTranslation, type TranslationKey } from "@/src/i18n";

const MARKER_BUTTONS: {
  type: MarkerType;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  color: string;
  labelKey: TranslationKey;
}[] = [
  { type: "car", icon: "car", color: colors.markerCar, labelKey: "car" },
  { type: "fish", icon: "fish", color: colors.markerFish, labelKey: "fish" },
  { type: "mushroom", icon: "mushroom", color: colors.markerMushroom, labelKey: "mushroom" },
  { type: "hazard", icon: "alert", color: colors.markerHazard, labelKey: "hazard" },
  { type: "water", icon: "water", color: colors.markerWater, labelKey: "water" },
];

function distanceM(a: RoutePoint, b: RoutePoint): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const mapRef = useRef<MapCanvasHandle>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const safeHaptic = useCallback((fn: () => Promise<void> | void) => {
    try {
      const r = fn();
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch(() => {});
      }
    } catch {
      /* haptics unavailable on web */
    }
  }, []);

  const initLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCurrentLocation(loc.coords);
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );
    } catch (e) {
      console.warn("Location init failed", e);
      setPermissionStatus(Location.PermissionStatus.DENIED);
    }
  }, []);

  useEffect(() => {
    initLocation();
    return () => {
      watchRef.current?.remove();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [initLocation]);

  useEffect(() => {
    if (isTracking) {
      startTimeRef.current = Date.now();
      tickRef.current = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
    } else if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [isTracking]);

  const handleStartStop = useCallback(async () => {
    if (permissionStatus !== "granted") {
      await initLocation();
      return;
    }

    if (!isTracking) {
      safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      setRoute([]);
      setMarkers([]);
      setDistance(0);
      setElapsed(0);
      setIsTracking(true);

      watchRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
        },
        (loc) => {
          const point: RoutePoint = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            timestamp: loc.timestamp,
          };
          setCurrentLocation(loc.coords);
          setRoute((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const d = distanceM(last, point);
              if (d < 2) return prev;
              setDistance((dist) => dist + d);
            }
            return [...prev, point];
          });
        },
      );
    } else {
      safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      watchRef.current?.remove();
      watchRef.current = null;
      setIsTracking(false);
      Alert.alert(t("tripSavedTitle"), t("tripSavedBody"));
    }
  }, [isTracking, permissionStatus, initLocation, t, safeHaptic]);

  const handleDropMarker = useCallback(
    (type: MarkerType) => {
      if (!currentLocation) {
        Alert.alert(t("locating"));
        return;
      }
      safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
      const m: MapMarker = {
        id: `${Date.now()}-${type}`,
        type,
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timestamp: Date.now(),
      };
      setMarkers((prev) => [...prev, m]);
    },
    [currentLocation, t, safeHaptic],
  );

  const markerColorFor = useCallback(
    (type: MarkerType) =>
      MARKER_BUTTONS.find((b) => b.type === type)?.color ?? colors.brand,
    [],
  );
  const markerLabelFor = useCallback(
    (type: MarkerType) => {
      const b = MARKER_BUTTONS.find((x) => x.type === type);
      return b ? t(b.labelKey) : "";
    },
    [t],
  );

  const initialRegion = {
    latitude: currentLocation?.latitude ?? 42.6977,
    longitude: currentLocation?.longitude ?? 23.3219,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  return (
    <View style={styles.root} testID="home-screen">
      <StatusBar style="light" />

      <View style={[styles.mapWrap, { paddingTop: insets.top }]}>
        <MapCanvas
          ref={mapRef}
          initialRegion={initialRegion}
          route={route}
          markers={markers}
          brandColor={colors.brand}
          markerColorFor={markerColorFor}
          markerLabelFor={markerLabelFor}
        />

        <SafeAreaView edges={["top"]} style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.statusRow} pointerEvents="none">
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>{t("distance")}</Text>
              <Text style={styles.statusValue} testID="status-distance">
                {formatDistance(distance)}
              </Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>{t("duration")}</Text>
              <Text style={styles.statusValue} testID="status-duration">
                {formatDuration(elapsed)}
              </Text>
            </View>
            <View style={styles.statusCard}>
              <Text style={styles.statusLabel}>{t("markers")}</Text>
              <Text style={styles.statusValue} testID="status-markers">
                {markers.length}
              </Text>
            </View>
          </View>

          {isTracking && (
            <View style={styles.recordingBadge} pointerEvents="none">
              <View style={styles.recordingDot} />
              <Text style={styles.recordingText}>{t("tracking")}</Text>
            </View>
          )}
        </SafeAreaView>

        {!currentLocation && permissionStatus === "granted" && (
          <View style={styles.locatingOverlay} pointerEvents="none">
            <ActivityIndicator color={colors.brand} size="large" />
            <Text style={styles.locatingText}>{t("locating")}</Text>
          </View>
        )}

        {permissionStatus && permissionStatus !== "granted" && (
          <View style={styles.permissionOverlay}>
            <MaterialCommunityIcons name="map-marker-off" size={48} color={colors.warning} />
            <Text style={styles.permissionTitle}>{t("permissionRequired")}</Text>
            <Text style={styles.permissionBody}>{t("permissionMessage")}</Text>
            <Pressable
              style={styles.permissionBtn}
              onPress={initLocation}
              testID="permission-btn"
            >
              <Text style={styles.permissionBtnText}>{t("enableLocation")}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View
        style={[styles.controls, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}
      >
        <View style={styles.markerGrid}>
          {MARKER_BUTTONS.map((btn) => (
            <Pressable
              key={btn.type}
              style={({ pressed }) => [
                styles.markerBtn,
                { borderColor: btn.color },
                pressed && styles.markerBtnPressed,
              ]}
              onPress={() => handleDropMarker(btn.type)}
              testID={`marker-${btn.type}-btn`}
            >
              <MaterialCommunityIcons name={btn.icon} size={28} color={btn.color} />
              <Text style={styles.markerLabel} numberOfLines={1}>
                {t(btn.labelKey)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          onPress={handleStartStop}
          style={({ pressed }) => [
            styles.startStopBtn,
            { backgroundColor: isTracking ? colors.error : colors.success },
            pressed && styles.startStopPressed,
          ]}
          testID="start-stop-btn"
        >
          <MaterialCommunityIcons
            name={isTracking ? "stop-circle" : "play-circle"}
            size={32}
            color="#fff"
          />
          <Text style={styles.startStopText}>
            {isTracking ? t("stop") : t("start")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  mapWrap: {
    flex: 1,
    backgroundColor: colors.surfaceTertiary,
    overflow: "hidden",
  },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  statusRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  statusCard: {
    flex: 1,
    backgroundColor: "rgba(18,18,18,0.85)",
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: "center",
  },
  statusLabel: {
    color: colors.onSurfaceTertiary,
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  statusValue: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  recordingBadge: {
    alignSelf: "center",
    marginTop: spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239,68,68,0.95)",
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    gap: 6,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  recordingText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  locatingOverlay: {
    position: "absolute",
    bottom: spacing.lg,
    alignSelf: "center",
    backgroundColor: "rgba(18,18,18,0.85)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  locatingText: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "600",
  },
  permissionOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(18,18,18,0.92)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: {
    color: colors.onSurface,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  permissionBody: {
    color: colors.onSurfaceTertiary,
    fontSize: 14,
    textAlign: "center",
  },
  permissionBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  permissionBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  controls: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  markerGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.xs,
  },
  markerBtn: {
    flex: 1,
    minHeight: 76,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  markerBtnPressed: {
    backgroundColor: colors.surfaceTertiary,
    transform: [{ scale: 0.96 }],
  },
  markerLabel: {
    color: colors.onSurface,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    textAlign: "center",
  },
  startStopBtn: {
    minHeight: 72,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  startStopPressed: {
    opacity: 0.85,
  },
  startStopText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: 2,
  },
});
