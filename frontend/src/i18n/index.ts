// Minimal i18n for Bulgarian / English
import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "bg" | "en";

const LANG_KEY = "sleda.lang";

const translations = {
  bg: {
    appName: "Следа",
    home: "Начало",
    archive: "Следи",
    start: "СТАРТ",
    stop: "СТОП",
    car: "Кола / Лодка",
    fish: "Риба",
    mushroom: "Гъба",
    hazard: "Опасност",
    water: "Чешма",
    poi: "Маркер",
    note: "Бележка",
    addNote: "Добави бележка",
    note_text: "Текст",
    noteHint: "Опишете точката (по желание)",
    takePhoto: "Снимка от камера",
    pickPhoto: "Избери от галерия",
    skipPhoto: "Без снимка",
    save: "Запази",
    photo: "Снимка",
    stats: "Статистики",
    gallery: "Галерия",
    totalTrips: "Излизания",
    totalDistance: "Общо",
    totalTime: "Време",
    favoritePlaces: "Любими точки",
    noPhotos: "Няма снимки",
    exportGpx: "Експортирай GPX",
    exporting: "Подготвя файл...",
    archiveEmpty: "Няма записани маршрути",
    archiveSub: "Започнете първия си излет от Начало",
    loading: "Зареждане...",
    retry: "Опитай отново",
    loadError: "Грешка при зареждане",
    saveError: "Грешка при запис",
    saving: "Запазване...",
    tripDetail: "Маршрут",
    delete: "Изтрий",
    deleteConfirm: "Сигурни ли сте, че искате да изтриете този маршрут?",
    points: "точки",
    back: "Назад",
    permissionRequired: "Нужно е разрешение за GPS",
    permissionMessage: "Разрешете достъп до местоположението, за да започнете маршрут.",
    enableLocation: "Разреши",
    locating: "Търсене на GPS...",
    distance: "Разстояние",
    duration: "Време",
    markers: "Точки",
    tripSavedTitle: "Маршрутът е запазен",
    tripSavedBody: "Излетът е добавен в Архив.",
    ok: "OK",
    cancel: "Отказ",
    settings: "Настройки",
    language: "Език",
    tracking: "Записва маршрут",
  },
  en: {
    appName: "Sleda",
    home: "Home",
    archive: "Tracks",
    start: "START",
    stop: "STOP",
    car: "Car / Boat",
    fish: "Fish",
    mushroom: "Mushroom",
    hazard: "Hazard",
    water: "Water",
    poi: "Marker",
    note: "Note",
    addNote: "Add note",
    note_text: "Text",
    noteHint: "Describe this point (optional)",
    takePhoto: "Take photo",
    pickPhoto: "Pick from gallery",
    skipPhoto: "Skip photo",
    save: "Save",
    photo: "Photo",
    stats: "Stats",
    gallery: "Gallery",
    totalTrips: "Trips",
    totalDistance: "Total",
    totalTime: "Time",
    favoritePlaces: "Favorite spots",
    noPhotos: "No photos yet",
    exportGpx: "Export GPX",
    exporting: "Preparing file...",
    archiveEmpty: "No saved trips yet",
    archiveSub: "Start your first trip from Home",
    loading: "Loading...",
    retry: "Try again",
    loadError: "Failed to load",
    saveError: "Failed to save",
    saving: "Saving...",
    tripDetail: "Trip",
    delete: "Delete",
    deleteConfirm: "Are you sure you want to delete this trip?",
    points: "points",
    back: "Back",
    permissionRequired: "Location permission needed",
    permissionMessage: "Please grant location access to track your route.",
    enableLocation: "Allow",
    locating: "Acquiring GPS...",
    distance: "Distance",
    duration: "Duration",
    markers: "Markers",
    tripSavedTitle: "Trip saved",
    tripSavedBody: "Your trip is now in the Archive.",
    ok: "OK",
    cancel: "Cancel",
    settings: "Settings",
    language: "Language",
    tracking: "Recording route",
  },
} as const;

export type TranslationKey = keyof typeof translations["bg"];

let currentLang: Lang = "bg";
const listeners = new Set<(l: Lang) => void>();

export async function initLang(): Promise<Lang> {
  try {
    const stored = (await AsyncStorage.getItem(LANG_KEY)) as Lang | null;
    if (stored === "bg" || stored === "en") {
      currentLang = stored;
    }
  } catch {}
  return currentLang;
}

export async function setLang(lang: Lang) {
  currentLang = lang;
  try {
    await AsyncStorage.setItem(LANG_KEY, lang);
  } catch {}
  listeners.forEach((cb) => cb(lang));
}

export function getLang(): Lang {
  return currentLang;
}

export function t(key: TranslationKey, lang: Lang = currentLang): string {
  return translations[lang][key] ?? key;
}

export function useTranslation() {
  const [lang, setLangState] = useState<Lang>(currentLang);

  useEffect(() => {
    let cancelled = false;
    initLang().then((l) => {
      if (!cancelled) setLangState(l);
    });
    const cb = (l: Lang) => setLangState(l);
    listeners.add(cb);
    return () => {
      cancelled = true;
      listeners.delete(cb);
    };
  }, []);

  const change = useCallback((l: Lang) => {
    setLang(l);
  }, []);

  return {
    lang,
    setLang: change,
    t: useCallback((key: TranslationKey) => t(key, lang), [lang]),
  };
}
