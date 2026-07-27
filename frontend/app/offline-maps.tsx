import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import MapView, { UrlTile, Marker, Region, PROVIDER_DEFAULT } from "react-native-maps";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { colors, spacing, radius } from "@/src/theme/colors";
import {
  tilesForRegion,
  tileCenterLatLon,
  estimateRegionSize,
  loadOfflineRegions,
  saveOfflineRegion,
  deleteOfflineRegion,
  ZOOM_PRESETS,
  type ZoomPreset,
  type OfflineRegion,
  type LatLon,
} from "@/src/utils/offlineMaps";
import type { MapTileStyle } from "@/src/components/MapCanvas.types";

const DOWNLOAD_TILE_STYLES: Record<MapTileStyle, { urlTemplate: string; maximumZ: number; label: string }> = {
  voyager: {
    urlTemplate: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    maximumZ: 20,
    label: "Стандартна",
  },
  topo: {
    urlTemplate: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    maximumZ: 17,
    label: "Топографска",
  },
  satellite: {
    urlTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maximumZ: 19,
    label: "Сателит",
  },
};
const TILE_CACHE_PATH =
  Platform.OS !== "web" && FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}osm-tiles`
    : undefined;
const RADIUS_OPTIONS = [5, 10, 20, 30];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function OfflineMapsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);

  const [center, setCenter] = useState<LatLon>({ latitude: 42.6977, longitude: 23.3219 });
  const [radiusKm, setRadiusKm] = useState(10);
  const [preset, setPreset] = useState<ZoomPreset>("walker");
  const [downloadStyle, setDownloadStyle] = useState<MapTileStyle>("topo");
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressTotal, setProgressTotal] = useState(0);
  const [regionName, setRegionName] = useState("");
  const [regions, setRegions] = useState<OfflineRegion[]>([]);

  const loadRegions = useCallback(async () => {
    setRegions(await loadOfflineRegions());
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  useFocusEffect(
    useCallback(() => {
      loadRegions();
    }, [loadRegions]),
  );

  const initialRegion: Region = {
    latitude: center.latitude,
    longitude: center.longitude,
    latitudeDelta: 0.3,
    longitudeDelta: 0.3,
  };

  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText)}&format=json&limit=1`,
        { headers: { "User-Agent": "SledaApp/1.0 (Android outdoor tracking app)" } },
      );
      const data = await res.json();
      if (!data || data.length === 0) {
        Alert.alert("Не е намерено", "Опитай с друго име или премести картата ръчно.");
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setCenter({ latitude: lat, longitude: lon });
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lon, latitudeDelta: 0.15, longitudeDelta: 0.15 },
        500,
      );
    } catch (e) {
      Alert.alert("Грешка при търсене", String(e));
    } finally {
      setSearching(false);
    }
  }, [searchText]);

  const tileCount = tilesForRegion(center, radiusKm, preset).length;
  const approxMb = estimateRegionSize(tileCount, preset);

  const handleDownload = useCallback(async () => {
    const tiles = tilesForRegion(center, radiusKm, preset);
    if (tiles.length === 0) return;
    setDownloading(true);
    setProgress(0);
    setProgressTotal(tiles.length);

    // Group tiles into small camera "stops" per zoom level, and pan the
    // map through each stop so UrlTile requests (and caches) them the
    // same way it would for normal browsing - this also naturally paces
    // requests instead of bursting hundreds at once.
    const byZoom = new Map<number, typeof tiles>();
    for (const t of tiles) {
      const arr = byZoom.get(t.z) ?? [];
      arr.push(t);
      byZoom.set(t.z, arr);
    }

    let done = 0;
    try {
      for (const [z, zTiles] of byZoom) {
        const stepDeg = (3 * 360) / Math.pow(2, z);
        const stops = new Set<string>();
        for (const t of zTiles) {
          const c = tileCenterLatLon(t);
          const key = `${Math.round(c.latitude / stepDeg)}_${Math.round(c.longitude / stepDeg)}`;
          if (!stops.has(key)) {
            stops.add(key);
            mapRef.current?.animateToRegion(
              {
                latitude: c.latitude,
                longitude: c.longitude,
                latitudeDelta: stepDeg * 1.4,
                longitudeDelta: stepDeg * 1.4,
              },
              150,
            );
            await sleep(450);
          }
          done += 1;
          setProgress(done);
        }
      }

      const saved = await saveOfflineRegion({
        name: regionName.trim() || "Регион",
        center,
        radiusKm,
        preset,
        style: downloadStyle,
        tileCount: tiles.length,
        approxSizeMb: approxMb,
      });
      await loadRegions();
      Alert.alert("Готово", `"${saved.name}" е свален за офлайн ползване.`);
      setRegionName("");
    } catch (e) {
      Alert.alert("Грешка при сваляне", String(e));
    } finally {
      setDownloading(false);
    }
  }, [center, radiusKm, preset, downloadStyle, regionName, approxMb, loadRegions]);

  const handleJumpToRegion = useCallback((region: OfflineRegion) => {
    setCenter(region.center);
    const latDelta = (region.radiusKm / 111) * 2.4;
    mapRef.current?.animateToRegion(
      {
        latitude: region.center.latitude,
        longitude: region.center.longitude,
        latitudeDelta: latDelta,
        longitudeDelta: latDelta,
      },
      500,
    );
  }, []);

  const handleDeleteRegion = useCallback(
    (id: string, name: string) => {
      Alert.alert("Изтриване", `Регион "${name}" ще бъде премахнат от списъка. Сигурен ли си?`, [
        { text: "Отказ", style: "cancel" },
        {
          text: "Изтрий",
          style: "destructive",
          onPress: async () => {
            await deleteOfflineRegion(id);
            await loadRegions();
          },
        },
      ]);
    },
    [loadRegions],
  );

  return (
    <View style={styles.root} testID="offline-maps-screen">
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="offline-back-btn">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Офлайн карти</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Търси място..."
          placeholderTextColor={colors.onSurfaceTertiary}
          onSubmitEditing={handleSearch}
          testID="offline-search-input"
        />
        <Pressable style={styles.searchBtn} onPress={handleSearch} testID="offline-search-btn">
          {searching ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <MaterialCommunityIcons name="magnify" size={20} color="#fff" />
          )}
        </Pressable>
      </View>

      <View style={styles.mapWrap}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onRegionChangeComplete={(r) => setCenter({ latitude: r.latitude, longitude: r.longitude })}
          testID="offline-map-view"
        >
          <UrlTile
            key={downloadStyle}
            urlTemplate={DOWNLOAD_TILE_STYLES[downloadStyle].urlTemplate}
            maximumZ={DOWNLOAD_TILE_STYLES[downloadStyle].maximumZ}
            flipY={false}
            tileCachePath={TILE_CACHE_PATH}
            tileCacheMaxAge={60 * 60 * 24 * 30}
          />
          <Marker coordinate={center} anchor={{ x: 0.5, y: 0.5 }}>
            <MaterialCommunityIcons name="map-marker" size={36} color={colors.brand} />
          </Marker>
        </MapView>
      </View>

      <ScrollView
        style={styles.panel}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, spacing.lg) }}
      >
        <Text style={styles.sectionLabel}>Радиус</Text>
        <View style={styles.pillRow}>
          {RADIUS_OPTIONS.map((r) => (
            <Pressable
              key={r}
              onPress={() => setRadiusKm(r)}
              style={[styles.pill, radiusKm === r && styles.pillActive]}
              testID={`radius-${r}`}
            >
              <Text style={[styles.pillText, radiusKm === r && styles.pillTextActive]}>{r} км</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Детайл</Text>
        <View style={styles.pillRow}>
          {(Object.keys(ZOOM_PRESETS) as ZoomPreset[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => setPreset(p)}
              style={[styles.pill, preset === p && styles.pillActive]}
              testID={`preset-${p}`}
            >
              <Text style={[styles.pillText, preset === p && styles.pillTextActive]}>
                {ZOOM_PRESETS[p].label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Стил на картата за офлайн</Text>
        <View style={styles.pillRow}>
          {(Object.keys(DOWNLOAD_TILE_STYLES) as MapTileStyle[]).map((s) => (
            <Pressable
              key={s}
              onPress={() => setDownloadStyle(s)}
              style={[styles.pill, downloadStyle === s && styles.pillActive]}
              testID={`download-style-${s}`}
            >
              <Text style={[styles.pillText, downloadStyle === s && styles.pillTextActive]}>
                {DOWNLOAD_TILE_STYLES[s].label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.estimate}>
          ~{tileCount} тайла · ~{approxMb} MB
        </Text>

        {downloading ? (
          <View style={styles.progressWrap}>
            <ActivityIndicator color={colors.brand} />
            <Text style={styles.progressText}>
              {progress} от {progressTotal}
            </Text>
          </View>
        ) : (
          <>
            <TextInput
              style={styles.nameInput}
              value={regionName}
              onChangeText={setRegionName}
              placeholder="Име на региона"
              placeholderTextColor={colors.onSurfaceTertiary}
              testID="region-name-input"
            />
            <Pressable style={styles.downloadBtn} onPress={handleDownload} testID="download-region-btn">
              <MaterialCommunityIcons name="cloud-download-outline" size={20} color="#fff" />
              <Text style={styles.downloadBtnText}>Свали региона</Text>
            </Pressable>
          </>
        )}

        {regions.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>Свалени региони</Text>
            {regions.map((r) => (
              <View key={r.id} style={styles.regionRowContainer}>
                <Pressable
                  style={styles.regionRow}
                  onPress={() => handleJumpToRegion(r)}
                  testID={`jump-region-${r.id}`}
                >
                  <Text style={styles.regionName}>{r.name}</Text>
                  <Text style={styles.regionInfo}>
                    {r.radiusKm} км · {ZOOM_PRESETS[r.preset].label} · {DOWNLOAD_TILE_STYLES[r.style]?.label ?? "Топографска"} · ~{r.approxSizeMb} MB
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.deleteRegionBtn}
                  onPress={() => handleDeleteRegion(r.id, r.name)}
                  testID={`delete-region-${r.id}`}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
                </Pressable>
              </View>
            ))}
          </>
        )}
      </ScrollView>
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
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  searchRow: { flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  searchBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brand,
    borderRadius: radius.md,
  },
  mapWrap: { height: 260, backgroundColor: colors.surfaceTertiary },
  panel: { flex: 1, padding: spacing.md },
  sectionLabel: { color: colors.onSurfaceTertiary, fontSize: 12, fontWeight: "800", textTransform: "uppercase", marginBottom: spacing.xs },
  pillRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" },
  pill: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  pillActive: { backgroundColor: colors.brand, borderColor: colors.brand },
  pillText: { color: colors.onSurface, fontWeight: "700", fontSize: 13 },
  pillTextActive: { color: "#fff" },
  estimate: { color: colors.onSurfaceTertiary, fontSize: 13, marginBottom: spacing.md },
  nameInput: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    marginBottom: spacing.sm,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
  },
  downloadBtnText: { color: "#fff", fontWeight: "900", fontSize: 15 },
  progressWrap: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md },
  progressText: { color: colors.onSurface, fontWeight: "700" },
  regionRowContainer: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.sm },
  regionRow: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  regionName: { color: colors.onSurface, fontWeight: "800", fontSize: 15 },
  regionInfo: { color: colors.onSurfaceTertiary, fontSize: 12 },
  deleteRegionBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
