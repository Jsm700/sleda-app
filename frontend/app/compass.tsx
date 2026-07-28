import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCompassHeading } from "@/src/hooks/useCompassHeading";
import { colors, spacing, radius } from "@/src/theme/colors";

const DIAL_SIZE = 320;
const RADIUS = DIAL_SIZE / 2;

const CARDINALS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
function cardinalFor(deg: number): string {
  const idx = Math.round(deg / 45) % 8;
  return CARDINALS_8[idx];
}

export default function CompassScreen() {
  const router = useRouter();
  const { heading, fieldStrength } = useCompassHeading();

  const ticks = Array.from({ length: 24 }, (_, i) => i * 15);
  const labels: { deg: number; text: string }[] = [
    { deg: 0, text: "N" },
    { deg: 45, text: "NE" },
    { deg: 90, text: "E" },
    { deg: 135, text: "SE" },
    { deg: 180, text: "S" },
    { deg: 225, text: "SW" },
    { deg: 270, text: "W" },
    { deg: 315, text: "NW" },
  ];

  return (
    <View style={styles.root} testID="compass-screen">
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="compass-back-btn">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Магнитно поле {fieldStrength.toFixed(0)} µT</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <View style={styles.center}>
        <Text style={styles.headingNumber}>{Math.round(heading)}°</Text>
        <Text style={styles.headingCardinal}>{cardinalFor(heading)}</Text>

        <View style={styles.dialWrap}>
          {/* Fixed pointer - always at top, shows current facing direction */}
          <MaterialCommunityIcons
            name="menu-down"
            size={32}
            color={colors.error}
            style={styles.pointer}
          />

          {/* Rotating ring: ticks + cardinal labels turn together as the phone turns */}
          <View style={[styles.ring, { transform: [{ rotate: `${-heading}deg` }] }]}>
            {ticks.map((angle) => {
              const isMajor = angle % 30 === 0;
              const isNorth = angle === 0;
              return (
                <View
                  key={angle}
                  style={[styles.tickPivot, { transform: [{ rotate: `${angle}deg` }] }]}
                >
                  <View
                    style={[
                      styles.tick,
                      {
                        height: isMajor ? 18 : 9,
                        backgroundColor: isNorth ? colors.error : isMajor ? "#fff" : "#777",
                        width: isNorth ? 3 : 2,
                      },
                    ]}
                  />
                </View>
              );
            })}
            {labels.map(({ deg, text }) => (
              <View key={deg} style={[styles.labelPivot, { transform: [{ rotate: `${deg}deg` }] }]}>
                <View style={[styles.labelBox, { transform: [{ rotate: `${-deg}deg` }] }]}>
                  <Text style={[styles.dialLabel, deg === 0 && styles.dialLabelNorth]}>{text}</Text>
                </View>
              </View>
            ))}
            <View style={styles.centerDot} />
          </View>
        </View>
      </View>
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
  title: { color: colors.onSurface, fontSize: 15, fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  headingNumber: { color: colors.onSurface, fontSize: 56, fontWeight: "900" },
  headingCardinal: { color: colors.onSurfaceTertiary, fontSize: 20, fontWeight: "700", marginTop: -12, marginBottom: spacing.lg },
  dialWrap: { width: DIAL_SIZE, height: DIAL_SIZE, alignItems: "center", justifyContent: "center" },
  pointer: { position: "absolute", top: -6, zIndex: 5 },
  ring: {
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    borderRadius: RADIUS,
    borderWidth: 2,
    borderColor: "#333",
    alignItems: "center",
    justifyContent: "center",
  },
  tickPivot: {
    position: "absolute",
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: "center",
  },
  tick: { position: "absolute", top: 6, borderRadius: 2 },
  labelPivot: {
    position: "absolute",
    width: DIAL_SIZE,
    height: DIAL_SIZE,
    alignItems: "center",
  },
  labelBox: { position: "absolute", top: 28, width: 36, alignItems: "center" },
  dialLabel: { color: colors.onSurface, fontSize: 16, fontWeight: "800" },
  dialLabelNorth: { color: colors.error, fontSize: 18 },
  centerDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.onSurfaceTertiary },
});
