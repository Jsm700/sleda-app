// Small live compass overlay, tilt-compensated (works regardless of how
// the phone is held/tilted, not just perfectly flat).
// Classic convention: red tip = north, white tip = south.
import { View, StyleSheet } from "react-native";
import { useCompassHeading } from "@/src/hooks/useCompassHeading";

export default function Compass() {
  const { heading } = useCompassHeading();

  return (
    <View style={styles.wrap}>
      <View style={[styles.needle, { transform: [{ rotate: `${-heading}deg` }] }]}>
        <View style={styles.northHalf} />
        <View style={styles.southHalf} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", width: 44, height: 44 },
  needle: { width: 12, height: 40, alignItems: "center" },
  northHalf: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#ef4444",
  },
  southHalf: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ffffff",
  },
});
