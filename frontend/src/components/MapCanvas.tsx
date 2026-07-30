import React from "react";
import { Platform, StyleSheet } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import MapView, { Polyline, Marker, UrlTile, PROVIDER_DEFAULT, Region } from "react-native-maps";
import MarkerPin from "./MarkerPin";

import type { MapCanvasProps } from "./MapCanvas.types";

// IMPORTANT: cache path must be unique PER STYLE. tileCachePath keys tiles
// by z/x/y coordinate only, not by URL - so if different styles shared one
// cache folder, a tile fetched once as e.g. satellite would be silently
// reused for the same coordinate under topo/voyager later, producing a
// patchwork of mismatched styles at different zoom levels.
function tileCachePathFor(style: string): string | undefined {
  return Platform.OS !== "web" && FileSystem.cacheDirectory
    ? `${FileSystem.cacheDirectory}osm-tiles-${style}`
    : undefined;
}

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
 { initialRegion, route, routeSegments, ghostRoute, ghostMarkers, markers, brandColor, markerLabelFor, onMarkerPress, mapStyle },
  ref,
) {
  const reg: Region = {
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
    latitudeDelta: initialRegion.latitudeDelta,
    longitudeDelta: initialRegion.longitudeDelta,
  };
  const activeStyle = mapStyle ?? "voyager";
  const tile = TILE_STYLES[activeStyle] ?? TILE_STYLES.voyager;

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
        key={activeStyle}
        urlTemplate={tile.urlTemplate}
        maximumZ={tile.maximumZ}
        flipY={false}
        tileCachePath={tileCachePathFor(activeStyle)}
        tileCacheMaxAge={60 * 60 * 24 * 30}
      />

      {routeSegments && routeSegments.length > 0 ? (
        routeSegments.map((seg, i) =>
          seg.points.length > 1 ? (
            <Polyline
              key={`seg-${i}`}
              coordinates={seg.points}
              strokeColor={seg.color}
              strokeWidth={5}
              lineDashPattern={seg.dashed ? [6, 6] : undefined}
            />
          ) : null,
        )
      ) : (
        route.length > 1 && (
          <Polyline coordinates={route} strokeColor={brandColor} strokeWidth={5} />
        )
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
