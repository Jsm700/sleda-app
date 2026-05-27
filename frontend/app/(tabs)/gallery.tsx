import { useCallback, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, Pressable, Image, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "@/src/i18n";
import { colors, spacing, radius } from "@/src/theme/colors";
import { api } from "@/src/api/client";
import { formatDateTime } from "@/src/utils/format";

type Photo = {
  trip_id: string;
  marker_id: string;
  type: "car" | "fish" | "mushroom" | "hazard" | "water" | "note";
  note: string | null;
  photo: string;
  timestamp: string;
  trip_started_at: string;
};

export default function GalleryScreen() {
  const { t, lang } = useTranslation();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Photo | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = (await api.listPhotos()) as Photo[];
      setPhotos(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="gallery-screen">
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>{t("gallery")}</Text>
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.brand} size="large" /></View>
      ) : error ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color={colors.error} />
          <Text style={styles.errorText}>{t("loadError")}</Text>
          <Pressable style={styles.retryBtn} onPress={load}><Text style={styles.retryText}>{t("retry")}</Text></Pressable>
        </View>
      ) : photos.length === 0 ? (
        <View style={styles.center}>
          <MaterialCommunityIcons name="image-off-outline" size={72} color={colors.onSurfaceTertiary} />
          <Text style={styles.emptyTitle}>{t("noPhotos")}</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(p) => p.marker_id}
          numColumns={3}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <Pressable
              style={styles.cell}
              onPress={() => setSelected(item)}
              testID={`photo-${item.marker_id}`}
            >
              <Image source={{ uri: `data:image/jpeg;base64,${item.photo}` }} style={styles.thumb} />
            </Pressable>
          )}
        />
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSelected(null)}>
          {selected && (
            <View style={styles.viewer}>
              <Image source={{ uri: `data:image/jpeg;base64,${selected.photo}` }} style={styles.fullImg} resizeMode="contain" />
              <View style={styles.viewerMeta}>
                <Text style={styles.viewerDate}>{formatDateTime(selected.timestamp, lang)}</Text>
                {selected.note ? <Text style={styles.viewerNote}>{selected.note}</Text> : null}
              </View>
            </View>
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { color: colors.onSurface, fontSize: 28, fontWeight: "900", letterSpacing: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  errorText: { color: colors.onSurface, fontWeight: "800" },
  retryBtn: { backgroundColor: colors.brand, paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.md, marginTop: spacing.sm },
  retryText: { color: "#fff", fontWeight: "800" },
  emptyTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "800", marginTop: spacing.md, textAlign: "center" },
  grid: { padding: 2 },
  cell: { flex: 1 / 3, aspectRatio: 1, padding: 2 },
  thumb: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radius.sm },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  viewer: { width: "100%", flex: 1, alignItems: "center", justifyContent: "center" },
  fullImg: { width: "100%", height: "75%" },
  viewerMeta: { padding: spacing.lg, alignItems: "center", gap: spacing.xs },
  viewerDate: { color: colors.onSurfaceTertiary, fontSize: 13 },
  viewerNote: { color: colors.onSurface, fontSize: 15, fontWeight: "700", textAlign: "center" },
});
