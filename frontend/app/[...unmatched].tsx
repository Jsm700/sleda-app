import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { colors } from "@/src/theme/colors";

export default function UnmatchedRoute() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    const url = typeof params.unmatched === "string"
      ? params.unmatched
      : Array.isArray(params.unmatched)
      ? params.unmatched.join("/")
      : "";

    if (url) {
      router.replace({ pathname: "/gpx-import", params: { url: `content://${url}` } });
    } else {
      router.replace("/(tabs)");
    }
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.brand} size="large" />
    </View>
  );
}
