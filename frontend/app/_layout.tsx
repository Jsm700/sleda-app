import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import "@/src/tracking/locationTask";
import DeviceIdModal from "@/src/components/DeviceIdModal";

SplashScreen.preventAutoHideAsync();

function GpxIntentHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      if (event.url && (event.url.endsWith(".gpx") || event.url.includes("gpx"))) {
        router.push({ pathname: "/gpx-import", params: { url: event.url } });
      }
    };
    const sub = Linking.addEventListener("url", handleUrl);
    Linking.getInitialURL().then((url) => {
      if (url && (url.endsWith(".gpx") || url.includes("gpx"))) {
        router.push({ pathname: "/gpx-import", params: { url } });
      }
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

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
      <Stack screenOptions={{ headerShown: false }}>
        <GpxIntentHandler />
      </Stack>
      <DeviceIdModal />
    </>
  );
}
