import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Alert,
  AppState,
  Platform,
  Modal,
  TextInput,
  Image,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapCanvas from "@/src/components/MapCanvas";
import type {
  MapMarker,
  RoutePoint,
  MarkerType,
  MapCanvasHandle,
} from "@/src/components/MapCanvas.types";
import { colors, spacing, radius } from "@/src/theme/colors";
import { useTranslation, type TranslationKey } from "@/src/i18n";
import { api } from "@/src/api/client";
import {
  savePendingTrip,
  loadPendingTrip,
  clearPendingTrip,
} from "@/src/utils/pendingTrip";
import {
  LOCATION_TASK_NAME,
  clearStoredRoute,
  isTrackingActive,
  readActiveTrip,
  readStoredRoute,
  setActiveTrip,
} from "@/src/tracking/locationTask";

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
  { type: "note", icon: "note-edit-outline", color: colors.info, labelKey: "note" },
];

function distanceM(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function computeTotalDistance(points: { latitude: number; longitude: number }[]): number {
  let d = 0;
  for (let i = 1; i < points.length; i++) d += distanceM(points[i - 1], points[i]);
  return d;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(2)} km`;
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useTranslation();
  const mapRef = useRef<MapCanvasHandle>(null);
  const startTimeRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const markersRef = useRef<MapMarker[]>([]);

  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObjectCoords | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [route, setRoute] = useState<RoutePoint[]>([]);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [ghostRoute, setGhostRoute] = useState<RoutePoint[]>([]);
  const [ghostModalOpen, setGhostModalOpen] = useState(false);
  const [distance, setDistance] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [, setSaving] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [notePhoto, setNotePhoto] = useState<string | null>(null);
  const [noteCoords, setNoteCoords] = useState<{ latitude: number; longitude: number } | null>(null);

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

  // ----- Storage polling: pull background route points into UI -----
  const refreshFromStorage = useCallback(async () => {
    const points = await readStoredRoute();
    if (points.length === 0) return;
    setRoute(points);
    setDistance(computeTotalDistance(points));
    const last = points[points.length - 1];
    setCurrentLocation((prev) => prev ?? ({ latitude: last.latitude, longitude: last.longitude } as Location.LocationObjectCoords));
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(refreshFromStorage, 2000);
  }, [refreshFromStorage]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ----- Upload a pending trip that failed to save previously -----
  const uploadPendingTrip = useCallback(async () => {
    const pending = await loadPendingTrip();
    if (!pending) return;
    try {
      const id = pending.tripId ?? (await api.createTrip()).id;
      await api.updateTrip(id, {
        ended_at: pending.endedAt,
        route: pending.route,
        markers: pending.markers,
        distance_m: pending.distance_m,
        duration_s: pending.duration_s,
      });
      await clearPendingTrip();
      Alert.alert(t("uploadSuccess") ?? "\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044a\u0442 \u0435 \u043a\u0430\u0447\u0435\u043d \u0443\u0441\u043f\u0435\u0448\u043d\u043e!");
    } catch (e) {
      console.warn("uploadPendingTrip failed", e);
      // Оставяме pending — ще опитаме пак при следващо отваряне.
    }
  }, [t]);

  // ----- Check for pending trip on startup -----
  const checkPendingTrip = useCallback(async () => {
    const pending = await loadPendingTrip();
    if (!pending) return;
    Alert.alert(
      t("pendingTitle") ?? "\u041d\u0435\u0437\u0430\u043f\u0430\u0437\u0435\u043d \u043c\u0430\u0440\u0448\u0440\u0443\u0442",
      t("pendingBody") ?? "\u041f\u043e\u0441\u043b\u0435\u0434\u043d\u0438\u044f\u0442 \u043c\u0430\u0440\u0448\u0440\u0443\u0442 \u043d\u0435 \u0435 \u043a\u0430\u0447\u0435\u043d. \u0414\u0430 \u043e\u043f\u0438\u0442\u0430\u043c\u0435 \u0441\u0435\u0433\u0430?",
      [
        {
          text: t("pendingDiscard") ?? "\u0418\u0437\u0442\u0440\u0438\u0439",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              t("pendingDiscardTitle") ?? "\u0421\u0438\u0433\u0443\u0440\u0435\u043d \u043b\u0438 \u0441\u0438?",
              "\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044a\u0442 \u0449\u0435 \u0431\u044a\u0434\u0435 \u0438\u0437\u0442\u0440\u0438\u0442 \u0437\u0430\u0432\u0438\u043d\u0430\u0433\u0438!",
              [
                { text: t("pendingDiscardCancel") ?? "\u041e\u0442\u043a\u0430\u0437", style: "cancel" },
                {
                  text: t("pendingDiscardConfirm") ?? "\u0414\u0430, \u0438\u0437\u0442\u0440\u0438\u0439",
                  style: "destructive",
                  onPress: clearPendingTrip,
                },
              ],
            );
          },
        },
        {
          text: t("pendingUpload") ?? "\u041a\u0430\u0447\u0438",
          onPress: uploadPendingTrip,
        },
      ],
    );
  }, [t, uploadPendingTrip]);

  // ----- Recover an in-progress trip if user re-opens the app -----
  const recoverActiveTrip = useCallback(async () => {
    try {
      const active = await isTrackingActive();
      if (!active) {
        // No active tracking — check for a pending (failed) save instead.
        await checkPendingTrip();
        return;
      }
      const { id, startedAt } = await readActiveTrip();
      if (!id || !startedAt) return;
      tripIdRef.current = id;
      startTimeRef.current = startedAt;
      setIsTracking(true);
      setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      await refreshFromStorage();
      startPolling();
    } catch (e) {
      console.warn("recoverActiveTrip failed", e);
    }
  }, [refreshFromStorage, startPolling, checkPendingTrip]);

  useEffect(() => {
    initLocation();
    recoverActiveTrip();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshFromStorage();
    });
    return () => {
      sub.remove();
      stopPolling();
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [initLocation, recoverActiveTrip, refreshFromStorage, stopPolling]);

  // ----- Timer -----
  useEffect(() => {
    if (isTracking) {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
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

  // ----- START / STOP -----
  const handleStartStop = useCallback(async () => {
    if (permissionStatus !== "granted") {
      await initLocation();
      return;
    }

    if (!isTracking) {
      // Ask for background permission. Reduced capability if denied: we
      // still track but only while screen is on (foreground service).
      let canBackground = true;
      try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        canBackground = bg.status === "granted";
      } catch {
        canBackground = false;
      }

      safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      await clearStoredRoute();
      setRoute([]);
      setMarkers([]);
      markersRef.current = [];
      setDistance(0);
      setElapsed(0);
      startTimeRef.current = Date.now();
      setIsTracking(true);

      // Create trip in backend - get id for later PATCH.
      try {
        const trip = await api.createTrip();
        tripIdRef.current = trip.id;
        await setActiveTrip(trip.id, startTimeRef.current);
      } catch (e) {
        console.warn("createTrip failed", e);
      }

      // Start the foreground/background location task.
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,
          distanceInterval: 3,
          showsBackgroundLocationIndicator: true,
          pausesUpdatesAutomatically: false,
          foregroundService:
            Platform.OS === "android"
              ? {
                  notificationTitle: "Следа",
                  notificationBody: "Записва маршрут",
                  notificationColor: colors.brand,
                }
              : undefined,
        });
      } catch (e) {
        console.warn("startLocationUpdatesAsync failed, falling back to foreground", e);
        Alert.alert(t("saveError"), String(e));
        setIsTracking(false);
        return;
      }

      if (!canBackground) {
        Alert.alert(
          t("permissionRequired"),
          t("permissionMessage"),
        );
      }

      startPolling();
    } else {
      safeHaptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      stopPolling();

      try {
        const running = await isTrackingActive();
        if (running) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
      } catch (e) {
        console.warn("stopLocationUpdatesAsync failed", e);
      }

      // Final read of accumulated points.
      const finalPoints = await readStoredRoute();
      const finalDistance = computeTotalDistance(finalPoints);
      const finalDurationS = startTimeRef.current
        ? Math.floor((Date.now() - startTimeRef.current) / 1000)
        : elapsed;
      const finalRoute = finalPoints.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        timestamp: new Date(p.timestamp).toISOString(),
      }));
      const finalMarkers = markersRef.current.map((m) => ({
        id: m.id,
        type: m.type,
        latitude: m.latitude,
        longitude: m.longitude,
        note: m.note ?? null,
        photo: m.photo ?? null,
        timestamp: new Date(m.timestamp).toISOString(),
      }));

      setIsTracking(false);
      setRoute(finalPoints);
      setDistance(finalDistance);

      setSaving(true);
      const endedAt = new Date().toISOString();
      try {
        const id = tripIdRef.current ?? (await api.createTrip()).id;
        await api.updateTrip(id, {
          ended_at: endedAt,
          route: finalRoute,
          markers: finalMarkers,
          distance_m: finalDistance,
          duration_s: finalDurationS,
        });
        await clearPendingTrip();
        Alert.alert(t("tripSavedTitle"), t("tripSavedBody"));
      } catch (e) {
        console.warn("save trip failed, storing locally", e);
        await savePendingTrip({
          tripId: tripIdRef.current,
          startedAt: new Date(startTimeRef.current ?? Date.now()).toISOString(),
          endedAt,
          route: finalRoute,
          markers: finalMarkers,
          distance_m: finalDistance,
          duration_s: finalDurationS,
        });
        Alert.alert(
          t("saveError"),
          "\u041c\u0430\u0440\u0448\u0440\u0443\u0442\u044a\u0442 \u0435 \u0437\u0430\u043f\u0430\u0437\u0435\u043d \u043b\u043e\u043a\u0430\u043b\u043d\u043e \u0438 \u0449\u0435 \u0431\u044a\u0434\u0435 \u043a\u0430\u0447\u0435\u043d \u043f\u0440\u0438 \u0441\u043b\u0435\u0434\u0432\u0430\u0449\u043e \u043e\u0442\u0432\u0430\u0440\u044f\u043d\u0435.",
        );
      } finally {
        setSaving(false);
        await clearStoredRoute();
        tripIdRef.current = null;
        startTimeRef.current = null;
      }
    }
  }, [isTracking, permissionStatus, initLocation, t, safeHaptic, elapsed, startPolling, stopPolling]);

  const handleDropMarker = useCallback(
    (type: MarkerType) => {
      if (!currentLocation) {
        Alert.alert(t("locating"));
        return;
      }
      if (type === "note") {
        // Open the note modal - photo + text will be captured before adding.
        setNoteCoords({
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
        });
        setNoteText("");
        setNotePhoto(null);
        setNoteModalOpen(true);
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
      setMarkers((prev) => {
        const next = [...prev, m];
        markersRef.current = next;
        return next;
      });
    },
    [currentLocation, t, safeHaptic],
  );

  const captureNotePhoto = useCallback(async (fromCamera: boolean) => {
    try {
      if (fromCamera) {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true,
          allowsEditing: false,
        });
        if (!res.canceled && res.assets[0]?.base64) setNotePhoto(res.assets[0].base64);
      } else {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) return;
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.5,
          base64: true,
          allowsEditing: false,
        });
        if (!res.canceled && res.assets[0]?.base64) setNotePhoto(res.assets[0].base64);
      }
    } catch (e) {
      console.warn("image picker failed", e);
    }
  }, []);

  const saveNoteMarker = useCallback(() => {
    if (!noteCoords) {
      setNoteModalOpen(false);
      return;
    }
    safeHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
    const m: MapMarker = {
      id: `${Date.now()}-note`,
      type: "note",
      latitude: noteCoords.latitude,
      longitude: noteCoords.longitude,
      timestamp: Date.now(),
      note: noteText.trim() || null,
      photo: notePhoto,
    };
    setMarkers((prev) => {
      const next = [...prev, m];
      markersRef.current = next;
      return next;
    });
    setNoteModalOpen(false);
    setNoteText("");
    setNotePhoto(null);
    setNoteCoords(null);
  }, [noteCoords, noteText, notePhoto, safeHaptic]);

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
          ghostRoute={ghostRoute}
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

          <View style={styles.langFloating} pointerEvents="box-none">
            <Pressable
              onPress={() => setLang(lang === "bg" ? "en" : "bg")}
              style={styles.langPill}
              testID="lang-toggle"
            >
              <MaterialCommunityIcons name="translate" size={16} color={colors.onSurface} />
              <Text style={styles.langPillText}>{lang === "bg" ? "БГ" : "EN"}</Text>
            </Pressable>
          </View>
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
          onPress={() => setGhostModalOpen(true)}
          style={styles.ghostBtn}
        >
          <MaterialCommunityIcons name="map-marker-path" size={24} color={colors.onSurface} />
          <Text style={styles.markerLabel}>Ghost</Text>
        </Pressable>
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

     {/* Ghost track modal */}
      <Modal
        visible={ghostModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setGhostModalOpen(false)}
      >
        <View style={styles.modalRoot}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ghost Track</Text>
              <Pressable onPress={() => setGhostModalOpen(false)} style={styles.modalClose}>
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <GhostTrackPicker onSelect={(route) => { setGhostRoute(route); setGhostModalOpen(false); }} onClear={() => { setGhostRoute([]); setGhostModalOpen(false); }} />
          </View>
        </View>
      </Modal>
      {/* Note modal: title + optional photo */}
      <Modal
        visible={noteModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setNoteModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalRoot}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t("addNote")}</Text>
              <Pressable
                onPress={() => setNoteModalOpen(false)}
                style={styles.modalClose}
                testID="note-close-btn"
              >
                <MaterialCommunityIcons name="close" size={24} color={colors.onSurface} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ gap: spacing.md }}>
              <TextInput
                value={noteText}
                onChangeText={setNoteText}
                placeholder={t("noteHint")}
                placeholderTextColor={colors.onSurfaceTertiary}
                style={styles.noteInput}
                multiline
                numberOfLines={3}
                testID="note-text-input"
              />
              {notePhoto ? (
                <View style={styles.previewWrap}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${notePhoto}` }}
                    style={styles.preview}
                  />
                  <Pressable
                    onPress={() => setNotePhoto(null)}
                    style={styles.previewRemove}
                    testID="note-photo-remove"
                  >
                    <MaterialCommunityIcons name="close" size={18} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.photoRow}>
                  <Pressable
                    style={styles.photoBtn}
                    onPress={() => captureNotePhoto(true)}
                    testID="note-camera-btn"
                  >
                    <MaterialCommunityIcons name="camera" size={22} color={colors.onSurface} />
                    <Text style={styles.photoBtnText}>{t("takePhoto")}</Text>
                  </Pressable>
                  <Pressable
                    style={styles.photoBtn}
                    onPress={() => captureNotePhoto(false)}
                    testID="note-gallery-btn"
                  >
                    <MaterialCommunityIcons name="image" size={22} color={colors.onSurface} />
                    <Text style={styles.photoBtnText}>{t("pickPhoto")}</Text>
                  </Pressable>
                </View>
              )}
              <Pressable
                style={styles.modalSaveBtn}
                onPress={saveNoteMarker}
                testID="note-save-btn"
              >
                <MaterialCommunityIcons name="check-bold" size={22} color="#fff" />
                <Text style={styles.modalSaveText}>{t("save")}</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  mapWrap: { flex: 1, backgroundColor: colors.surfaceTertiary, overflow: "hidden" },
  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
  },
  statusRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
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
  statusValue: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: 2 },
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
  recordingDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#fff" },
  recordingText: { color: "#fff", fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  langFloating: { position: "absolute", top: spacing.sm, right: spacing.md },
  langPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(18,18,18,0.92)",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
  },
  langPillText: { color: colors.onSurface, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
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
  locatingText: { color: colors.onSurface, fontSize: 13, fontWeight: "600" },
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
  permissionTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "800", textAlign: "center" },
  permissionBody: { color: colors.onSurfaceTertiary, fontSize: 14, textAlign: "center" },
  permissionBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  permissionBtnText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.6 },
  controls: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.md,
  },
  markerGrid: { flexDirection: "row", justifyContent: "space-between", gap: spacing.xs },
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
  markerBtnPressed: { backgroundColor: colors.surfaceTertiary, transform: [{ scale: 0.96 }] },
  markerLabel: { color: colors.onSurface, fontSize: 10, fontWeight: "700", letterSpacing: 0.3, textAlign: "center" },
 ghostBtn: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    gap: spacing.sm,
  },
  startStopBtn: {
    minHeight: 72,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  startStopPressed: { opacity: 0.85 },
  startStopText: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 2 },
  modalRoot: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    gap: spacing.md,
    maxHeight: "85%",
  },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modalTitle: { color: colors.onSurface, fontSize: 20, fontWeight: "900" },
  modalClose: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  noteInput: {
    backgroundColor: colors.surfaceSecondary,
    color: colors.onSurface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    fontSize: 16,
  },
  photoRow: { flexDirection: "row", gap: spacing.sm },
  photoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  photoBtnText: { color: colors.onSurface, fontWeight: "700", fontSize: 14 },
  previewWrap: { position: "relative", alignItems: "center" },
  preview: { width: "100%", height: 240, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  previewRemove: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  modalSaveBtn: {
    backgroundColor: colors.brand,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  modalSaveText: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.5 },
});
