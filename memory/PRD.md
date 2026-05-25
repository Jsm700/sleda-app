# PRD - Следа (Trace)

## Overview
A spartan, offline-friendly mobile app for fishermen and mushroom pickers. Provides live GPS tracking, route drawing on OpenStreetMap, and quick point-of-interest marking for trips outdoors.

## Tech Stack
- Frontend: Expo (React Native) + expo-router file-based routing
- Map: `react-native-maps` with `UrlTile` pulling free OSM tiles (`tile.openstreetmap.org`)
- Location: `expo-location` (foreground tracking)
- Backend: FastAPI + MongoDB (motor)
- i18n: Bulgarian (default) + English with `AsyncStorage` persistence

## Screens
1. **Начало (Home)** - `app/(tabs)/index.tsx`
   - Map with OSM tiles, user location, polyline of the active route
   - Status row: distance, duration, marker count
   - 5 marker buttons: Кола/Лодка, Риба, Гъба, Опасност, Чешма
   - Large green START / red STOP button to start/stop route recording
   - Permission overlay if GPS denied
2. **Архив (Archive)** - `app/(tabs)/archive.tsx`
   - Empty-state placeholder with language switcher (БГ/EN)
   - Will list saved trips in next iteration

## Backend API (`/api`)
- `GET /api/` health check
- `POST /api/trips` create trip
- `GET /api/trips` list trips (most recent first)
- `GET /api/trips/{id}` get trip
- `PATCH /api/trips/{id}` update trip (route, markers, ended_at, etc.)
- `DELETE /api/trips/{id}` remove trip
- `POST /api/trips/{id}/markers` add marker

## Storage Model (MongoDB)
- `trips` collection:
  - `id`, `name`, `started_at`, `ended_at`, `route` (RoutePoint[]), `markers` (Marker[]), `distance_m`, `duration_s`

## Design
- Dark-first spartan theme. High contrast. No glassmorphism. Glove-friendly 64dp+ targets.
- Tokens defined in `frontend/src/theme/colors.ts` and `design_guidelines.json`.

## Not yet implemented
- Sharing of trips between users (planned: QR-code peer-to-peer sharing as a growth feature).
- iOS native offline tile cache (`tileCachePath` is Android-only in react-native-maps).
