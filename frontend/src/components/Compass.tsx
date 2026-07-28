// Small live compass overlay using the phone's magnetometer.
// Follows the classic red/black needle convention: red tip = north,
// dark tip = south, so it's readable without extra labels.
// Note: raw magnetometer heading is a basic approximation (no tilt
// compensation) - accuracy depends on how flat/level the phone is held
// and can drift near metal objects. Good enough for general orientation,
// not precision navigation.
import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Magnetometer } from "expo-sensors";

export default function Compass() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener(({ x, y }: { x: number; y: number; z: number }) => {
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      angle = angle < 0 ? angle + 360 : angle;
      setHeading(angle);
    });
    return () => sub.remove();
  }, []);

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
  wrap: { alignItems: "center", justifyContent: "center", width: 28, height: 28 },
  needle: { width: 6, height: 26, alignItems: "center" },
  northHalf: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#ef4444", // red = north
  },
  southHalf: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 13,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#d4d4d4", // light/dark grey = south
  },
});
