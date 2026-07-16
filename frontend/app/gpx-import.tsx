import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system";
import MapCanvas from "@/src/components/MapCanvas";
import { parseGpx } from "@/src/utils/gpxParser";
import { api } from "@/src/api/client";
import { getDeviceId } from "@/src/utils/deviceId";
import { colors, spacing, radius } from "@/src/theme/colors";
import type { RoutePoint } from "@/src/components/MapCanvas.types";

export default function GpxImportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { url } = useLocalSearchParams<{ url: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("Импортиран маршрут");
  const [route, setRoute] = useState<RoutePoint[]>([]);

  useEffect(() => {
    if (!url) {
      setError("Няма файл за зареждане.");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        let xml: string;
        if (url.startsWith("content://")) {
          const destUri = FileSystem.cacheDirectory + "imported.gpx";
          await FileSystem.StorageAccessFramework.copyAsync({ from: url, to: destUri });
          xml = await FileSystem.readAsStringAsync(destUri);
        } else {
          xml = await FileSystem.readAsStringAsync(url);
        }
        const parsed = parseGpx(xml);
        setName(parsed.name);
        setRoute(parsed.route.map((p, i) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: new Date(p.timestamp).getTime() || i,
        })));
      } catch (e) {
        setError("Неуспешно четене на GPX файла.");
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const deviceId = await getDeviceId();
      const trip = await api.createTrip(name, deviceId);
      await api.updateTrip(trip.id, {
        ended_at: new Date().toISOString(),
        route: route.map((p) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: new Date(p.timestamp).toISOString(),
        })),
        markers: [],
        distance_m: 0,
        duration_s: 0,
      });
      Alert.alert("Успешно!", "Маршрутът е запазен в архива.", [
        { text: "OK", onPress: () => router.replace("/(tabs)/archive") },
      ]);
    } catch (e) {
      Alert.alert("Грешка", "Неуспешно запазване на маршрута.");
    } finally {
      setSaving(false);
    }
  };

  const initialRegion = route.length > 0
    ? { latitude: route[0].latitude, longitude: route[0].longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 42.69, longitude: 23.32, latitudeDelta: 0.05, longitudeDelta: 0.05 };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
      </SafeAreaView>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.brand} size="large" />
          <Text style={styles.subtle}>Зареждане...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <MapCanvas
          ref={null as any}
          initialRegion={initialRegion}
          route={route}
          markers={[]}
          brandColor={colors.brand}
          markerColorFor={() => colors.brand}
          markerLabelFor={() => ""}
        />
      )}

      {!loading && !error && (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
          <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.saveBtnText}>Запази в архива</Text>
            }
          </Pressable>
          <Pressable style={styles.cancelBtn} onPress={() => router.back()}>
            <Text style={styles.cancelBtnText}>Затвори</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  iconBtn: { padding: spacing.sm },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "800", flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  subtle: { color: colors.onSurfaceTertiary, fontSize: 14 },
  errorText: { color: colors.error, fontSize: 15, fontWeight: "700", textAlign: "center" },
  bottom: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  saveBtn: {
    backgroundColor: colors.brand,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  cancelBtn: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: { color: colors.onSurface, fontSize: 16, fontWeight: "700" },
});
