import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator, Alert, TextInput } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as FileSystem from "expo-file-system/legacy";
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
  const [description, setDescription] = useState("");
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
          const response = await fetch(url);
          xml = await response.text();
        } else {
          xml = await FileSystem.readAsStringAsync(url);
        }
        const parsed = parseGpx(xml);
        setName(parsed.name);
        setDescription(parsed.description ?? "");
        setRoute(parsed.route.map((p, i) => ({
          latitude: p.latitude,
          longitude: p.longitude,
          timestamp: new Date(p.timestamp).getTime() || i,
        })));
      } catch (e) {
        console.log("GPX import error:", e);
        setError(`Грешка: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [url]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const deviceId = await getDeviceId();
      const trip = await api.createTrip(name, deviceId, description || undefined);
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
        <>
          <MapCanvas
            ref={null as any}
            initialRegion={initialRegion}
            route={route}
            markers={[]}
            brandColor={colors.brand}
            markerColorFor={() => colors.brand}
            markerLabelFor={() => ""}
          />
          <View style={styles.fields}>
            <Text style={styles.fieldLabel}>Име</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Име на маршрута"
              placeholderTextColor={colors.onSurfaceTertiary}
            />
            <Text style={styles.fieldLabel}>Описание (незадължително)</Text>
            <TextInput
              style={[styles.input, styles.inputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="напр. Гъби в Родопите - около Рожен"
              placeholderTextColor={colors.onSurfaceTertiary}
              multiline
              numberOfLines={3}
            />
          </View>
        </>
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
  fields: {
    padding: spacing.md,
    gap: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: 13, fontWeight: "700", marginTop: spacing.xs },
  input: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.onSurface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
  },
  inputMultiline: { minHeight: 70, textAlignVertical: "top" },
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
