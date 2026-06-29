import { useEffect, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, StyleSheet } from "react-native";
import { api } from "@/src/api/client";
import type { ApiTrip } from "@/src/api/client";
import type { RoutePoint } from "./MapCanvas.types";
import { colors, spacing, radius } from "@/src/theme/colors";

type Props = {
  onSelect: (route: RoutePoint[]) => void;
  onClear: () => void;
};

export default function GhostTrackPicker({ onSelect, onClear }: Props) {
  const [trips, setTrips] = useState<ApiTrip[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listTrips()
      .then((all) => setTrips(all.filter((t) => t.route && t.route.length > 1)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} />;

  return (
    <ScrollView contentContainerStyle={{ gap: spacing.sm }}>
      <Pressable onPress={onClear} style={styles.clearBtn}>
        <Text style={styles.clearText}>Изчисти ghost track</Text>
      </Pressable>
      {trips.map((trip) => (
        <Pressable
          key={trip.id}
          style={styles.tripRow}
          onPress={() => onSelect(trip.route.map((p) => ({ latitude: p.latitude, longitude: p.longitude, timestamp: new Date(p.timestamp).getTime() })))}
        >
          <Text style={styles.tripDate}>{new Date(trip.started_at).toLocaleDateString("bg-BG")}</Text>
          <Text style={styles.tripInfo}>{(trip.distance_m / 1000).toFixed(2)} km · {trip.route.length} точки</Text>
        </Pressable>
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
  tripRow: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 4,
  },
  tripDate: { color: colors.onSurface, fontWeight: "700", fontSize: 15 },
  tripInfo: { color: colors.onSurfaceTertiary, fontSize: 13 },
});
