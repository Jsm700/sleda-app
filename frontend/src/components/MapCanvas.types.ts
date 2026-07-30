// Shared types between native and web map implementations.
export type MarkerType = "car" | "fish" | "mushroom" | "hazard" | "water" | "poi" | "note" | "start" | "end";
export type MapTileStyle = "voyager" | "topo" | "satellite";

export type MapMarker = {
  id: string;
  type: MarkerType;
  latitude: number;
  longitude: number;
  timestamp: number;
  note?: string | null;
  photo?: string | null;
};

export type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

export type MapCanvasProps = {
  initialRegion: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  route: RoutePoint[];
  ghostRoute?: RoutePoint[];
  ghostMarkers?: MapMarker[];
  markers: MapMarker[];
  brandColor: string;
  markerColorFor: (t: MarkerType) => string;
  markerLabelFor: (t: MarkerType) => string;
  onMarkerPress?: (marker: MapMarker) => void;
  mapStyle?: MapTileStyle;
};

export type MapCanvasHandle = {
  animateToRegion: (region: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  }, duration?: number) => void;
};
