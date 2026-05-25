// Minimal i18n for Bulgarian / English
import { useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Lang = "bg" | "en";

const LANG_KEY = "sleda.lang";

const translations = {
  bg: {
    appName: "Следа",
    home: "Начало",
    archive: "Архив",
    start: "СТАРТ",
    stop: "СТОП",
    car: "Кола / Лодка",
    fish: "Риба",
    mushroom: "Гъба",
    hazard: "Опасност",
    water: "Чешма",
    archiveEmpty: "Няма записани маршрути",
    archiveSub: "Започнете първия си излет от Начало",
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
    archive: "Archive",
    start: "START",
    stop: "STOP",
    car: "Car / Boat",
    fish: "Fish",
    mushroom: "Mushroom",
    hazard: "Hazard",
    water: "Water",
    archiveEmpty: "No saved trips yet",
    archiveSub: "Start your first trip from Home",
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
