// Larger, higher-contrast live compass using the phone's magnetometer.
// Classic convention: red tip = north, white tip = south (white instead
// of literal black, since black would be invisible against our dark
// circular button background - the point of the convention is a clearly
// distinct pair of colors, which red/white preserves).
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
    borderBottomColor: "#ef4444", // red = north
  },
  southHalf: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 20,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#ffffff", // white = south (visible against dark button)
  },
});
