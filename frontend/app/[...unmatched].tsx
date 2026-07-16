import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { colors } from "@/src/theme/colors";

export default function UnmatchedRoute() {
  const router = useRouter();

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        router.replace({ pathname: "/gpx-import", params: { url } });
      } else {
        router.replace("/(tabs)");
      }
    });
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}
