import { useEffect, useRef } from "react";
import { StyleSheet, Animated, View } from "react-native";
import { useRouter } from "expo-router";

export default function IntroScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const router = useRouter();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1200,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        router.replace("/(tabs)");
      }, 600);
    });
  }, [fadeAnim, router]);

  return (
    <View style={styles.container}>
      <Animated.Image
        source={require("../assets/images/splash-image.png")}
        style={[styles.image, { opacity: fadeAnim }]}
        resizeMode="cover"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  image: { width: "100%", height: "100%" },
});
