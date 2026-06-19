import React from "react";
import { Platform, StyleSheet } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import MapView, { Polyline, Marker, UrlTile, PROVIDER_DEFAULT, Region } from "react-native-maps";
import MarkerPin from "./MarkerPin";

import type { MapCanvasProps } from "./MapCanvas.types";

// On-device cache directory for OSM tiles - enables offline browsing of
// previously visited map regions. Android caches tiles; iOS ignores the
// path silently (react-native-maps limitation).
const TILE_CACHE_PATH =
  Platform.OS !== "web" && FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}osm-tiles`
    : undefined;

const MapCanvas = React.forwardRef<MapView, MapCanvasProps>(function MapCanvas(
  { initialRegion, route, markers, brandColor, markerLabelFor },
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
      mapType="standard"
      testID="map-view"
    >
      <UrlTile
        urlTemplate="https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png"
        maximumZ={20}
        flipY={false}
        tileCachePath={TILE_CACHE_PATH}
        tileCacheMaxAge={60 * 60 * 24 * 30}
      />

      {route.length > 1 && (
        <Polyline coordinates={route} strokeColor={brandColor} strokeWidth={5} />
      )}

      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={markerLabelFor(m.type)}
          description={m.note ?? undefined}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <MarkerPin type={m.type} />
        </Marker>
      ))}
    </MapView>
  );
});

export default MapCanvas;
