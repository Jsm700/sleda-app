import React, { useImperativeHandle, useRef } from "react";
import { View, StyleSheet, Text, Platform } from "react-native";

import type { MapCanvasProps, MapCanvasHandle } from "./MapCanvas.types";

// Web fallback: shows OSM via an iframe so designers can preview the layout.
const MapCanvas = React.forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvasWeb(
  { initialRegion, route, markers },
  ref,
) {
  const regionRef = useRef(initialRegion);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region) => {
      regionRef.current = { ...regionRef.current, ...region };
    },
  }));

  const { latitude, longitude, latitudeDelta, longitudeDelta } = initialRegion;
  const bbox = [
    longitude - longitudeDelta / 2,
    latitude - latitudeDelta / 2,
    longitude + longitudeDelta / 2,
    latitude + latitudeDelta / 2,
  ].join(",");
  const url = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude},${longitude}`;

  if (Platform.OS !== "web") {
    return (
      <View style={[StyleSheet.absoluteFill, styles.placeholder]}>
        <Text style={styles.text}>Map preview unavailable</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* @ts-expect-error - web-only iframe */}
      <iframe
        src={url}
        style={{ width: "100%", height: "100%", border: "0" }}
        title="OpenStreetMap"
      />
      <View style={styles.banner} pointerEvents="none">
        <Text style={styles.bannerText}>
          Уеб преглед · {route.length} точки · {markers.length} маркера
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: "#1E1E1E",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#A3A3A3" },
  banner: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    backgroundColor: "rgba(18,18,18,0.85)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  bannerText: {
    color: "#E5E5E5",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default MapCanvas;
