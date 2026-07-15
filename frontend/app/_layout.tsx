import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import "@/src/tracking/locationTask";
import DeviceIdModal from "@/src/components/DeviceIdModal";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      <DeviceIdModal />
    </>
  );
}
