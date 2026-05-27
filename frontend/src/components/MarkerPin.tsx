// Branded marker visual used on react-native-maps. Renders a coloured circle
// with the matching MaterialCommunityIcons glyph (e.g. car / fish / mushroom).
import React from "react";
import { View, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@/src/theme/colors";
import type { MarkerType } from "./MapCanvas.types";

const ICONS: Record<MarkerType, keyof typeof MaterialCommunityIcons.glyphMap> = {
  car: "car",
  fish: "fish",
  mushroom: "mushroom",
  hazard: "alert",
  water: "water",
  note: "note-edit-outline",
};

const COLORS: Record<MarkerType, string> = {
  car: colors.markerCar,
  fish: colors.markerFish,
  mushroom: colors.markerMushroom,
  hazard: colors.markerHazard,
  water: colors.markerWater,
  note: colors.info,
};

export default function MarkerPin({ type, size = 36 }: { type: MarkerType; size?: number }) {
  const bg = COLORS[type] ?? colors.brand;
  const icon = ICONS[type] ?? "map-marker";
  return (
    <View
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={Math.round(size * 0.55)} color="#fff" />
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
});
