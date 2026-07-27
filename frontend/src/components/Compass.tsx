// Small live compass overlay using the phone's magnetometer.
// Note: raw magnetometer heading is a basic approximation (no tilt
// compensation) - accuracy depends on how flat/level the phone is held
// and can drift near metal objects. Good enough for general orientation,
// not precision navigation.
import { useEffect, useState } from "react";
import { View, StyleSheet } from "react-native";
import { Magnetometer } from "expo-sensors";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/src/theme/colors";

export default function Compass() {
  const [heading, setHeading] = useState(0);

  useEffect(() => {
    Magnetometer.setUpdateInterval(200);
    const sub = Magnetometer.addListener(({ x, y }) => {
      let angle = Math.atan2(y, x) * (180 / Math.PI);
      angle = angle < 0 ? angle + 360 : angle;
      setHeading(angle);
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={[styles.rose, { transform: [{ rotate: `${-heading}deg` }] }]}>
      <MaterialCommunityIcons name="compass" size={28} color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  rose: { alignItems: "center", justifyContent: "center" },
});
