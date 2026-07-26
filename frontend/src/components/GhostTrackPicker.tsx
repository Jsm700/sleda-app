import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet, Alert } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { api } from "@/src/api/client";
import type { ApiTrip } from "@/src/api/client";
import type { RoutePoint, MapMarker } from "./MapCanvas.types";
import { colors, spacing, radius } from "@/src/theme/colors";
import { getDeviceId } from "@/src/utils/deviceId";

type Props = {
  onSelect: (route: RoutePoint[], markers: MapMarker[]) => void;
  onClear: () => void;
};

export default function GhostTrackPicker({ onSelect, onClear }: Props) {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDeviceId().then((deviceId) =>
      api.listTrips(deviceId)
        .then((all) => setTrips(all.filter((t) => t.route && t.route.length > 1)))
    )
      .finally(() => setLoading(false));
  }, []);

  const handleDeleteTrip = (id: string) => {
    Alert.alert(
      "Изтриване на маршрут",
      "Този маршрут ще бъде изтрит завинаги. Сигурен ли си?",
      [
        { text: "Отказ", style: "cancel" },
        {
          text: "Изтрий",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteTrip(id);
              setTrips((prev) => prev.filter((t) => t.id !== id));
            } catch (e) {
              Alert.alert("Грешка", String(e));
            }
          },
        },
      ],
    );
  };

  if (loading) return <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} />;

  return (
    <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
      <Pressable onPress={onClear} style={styles.clearBtn}>
        <Text style={styles.clearText}>Изчисти ghost track</Text>
      </Pressable>
      {trips.map((trip) => (
        <View key={trip.id} style={styles.tripRowContainer}>
          <Pressable
            style={styles.tripRow}
            onPress={() => {
              const mappedRoute = trip.route.map((p) => ({ latitude: p.latitude, longitude: p.longitude, timestamp: new Date(p.timestamp).getTime() }));
              const mappedMarkers: MapMarker[] = (trip.markers ?? []).map((m) => ({
                id: m.id ?? `${m.timestamp}-${m.type}`,
                type: m.type,
                latitude: m.latitude,
                longitude: m.longitude,
                timestamp: m.timestamp ? new Date(m.timestamp).getTime() : 0,
                note: m.note ?? null,
                photo: m.photo ?? null,
              }));
              console.log("Ghost route selected, points:", mappedRoute.length, "markers:", mappedMarkers.length);
              onSelect(mappedRoute, mappedMarkers);
            }}
          >
            <Text style={styles.tripDate}>{new Date(trip.started_at).toLocaleDateString("bg-BG")}</Text>
            <Text style={styles.tripInfo}>{(trip.distance_m / 1000).toFixed(2)} km · {trip.route.length} точки</Text>
          </Pressable>
          <Pressable
            style={styles.deleteTripBtn}
            onPress={() => handleDeleteTrip(trip.id)}
            testID={`ghost-delete-${trip.id}`}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.error} />
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  clearBtn: {
    backgroundColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  clearText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  tripRowContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  tripRow: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  deleteTripBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tripDate: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  tripInfo: { color: colors.onSurfaceTertiary, fontSize: 13 },
});
