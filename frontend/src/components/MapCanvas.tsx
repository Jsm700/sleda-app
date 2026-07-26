import React from "react";
import { Platform, StyleSheet } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import MapView, { Polyline, Marker, UrlTile, PROVIDER_DEFAULT, Region } from "react-native-maps";
import MarkerPin from "./MarkerPin";

import type { MapCanvasProps } from "./MapCanvas.types";

const TILE_CACHE_PATH =
  Platform.OS !== "web" && FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}osm-tiles`
    : undefined;

const TILE_STYLES: Record<string, { urlTemplate: string; maximumZ: number }> = {
  voyager: {
    urlTemplate: "https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png",
    maximumZ: 20,
  },
  topo: {
    urlTemplate: "https://a.tile.opentopomap.org/{z}/{x}/{y}.png",
    maximumZ: 17,
  },
  satellite: {
    urlTemplate: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    maximumZ: 19,
  },
};

const MapCanvas = React.forwardRef<MapView, MapCanvasProps>(function MapCanvas(
 { initialRegion, route, ghostRoute, ghostMarkers, markers, brandColor, markerLabelFor, onMarkerPress, mapStyle },
  ref,
) {
  const reg: Region = {
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
    latitudeDelta: initialRegion.latitudeDelta,
    longitudeDelta: initialRegion.longitudeDelta,
  };
  const tile = TILE_STYLES[mapStyle ?? "voyager"] ?? TILE_STYLES.voyager;

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
        key={mapStyle ?? "voyager"}
        urlTemplate={tile.urlTemplate}
        maximumZ={tile.maximumZ}
        flipY={false}
        tileCachePath={TILE_CACHE_PATH}
        tileCacheMaxAge={60 * 60 * 24 * 30}
      />

      {route.length > 1 && (
        <Polyline coordinates={route} strokeColor={brandColor} strokeWidth={5} />
      )}
      {ghostRoute && ghostRoute.length > 1 && (
        <Polyline coordinates={ghostRoute} strokeColor="#FF00FF" strokeWidth={8} lineDashPattern={[8, 6]} />
      )}
      {(ghostMarkers ?? []).map((m) => (
        <Marker
          key={`ghost-${m.id}`}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={markerLabelFor(m.type)}
          description={m.note ?? undefined}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onMarkerPress?.(m)}
          opacity={0.7}
        >
          <MarkerPin type={m.type} />
        </Marker>
      ))}
      {markers.map((m) => (
        <Marker
          key={m.id}
          coordinate={{ latitude: m.latitude, longitude: m.longitude }}
          title={markerLabelFor(m.type)}
          description={m.note ?? undefined}
          anchor={{ x: 0.5, y: 0.5 }}
          onPress={() => onMarkerPress?.(m)}
        >
          <MarkerPin type={m.type} />
        </Marker>
      ))}
    </MapView>
  );
});

export default MapCanvas;
