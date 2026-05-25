import React from "react";
import { Platform, StyleSheet } from "react-native";
import MapView, { Polyline, Marker, UrlTile, PROVIDER_DEFAULT, Region } from "react-native-maps";

import type { MapCanvasProps } from "./MapCanvas.types";

const MapCanvas = React.forwardRef<MapView, MapCanvasProps>(function MapCanvas(
  { initialRegion, route, markers, brandColor, markerColorFor, markerLabelFor },
  ref,
) {
  const reg: Region = {
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
    latitudeDelta: initialRegion.latitudeDelta,
    longitudeDelta: initialRegion.longitudeDelta,
  };

  return (
    <MapView
      ref={ref}
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      initialRegion={reg}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass
      mapType={Platform.OS === "android" ? "none" : "standard"}
      testID="map-view"
    >
      <UrlTile
        urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maximumZ={19}
        flipY={false}
      />

      {route.length > 1 && (
        <Polyline coordinates={route} strokeColor={brandColor} strokeWidth={5} />
      )}

      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          pinColor={markerColorFor(m.type)}
          title={markerLabelFor(m.type)}
        />
      ))}
    </MapView>
  );
});

export default MapCanvas;
