import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, Clipboard } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDeviceId } from "@/src/utils/deviceId";
import { colors, spacing, radius } from "@/src/theme/colors";

const SHOWN_KEY = "sleda.device_id_shown";

export default function DeviceIdModal() {
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const shown = await AsyncStorage.getItem(SHOWN_KEY);
      if (shown) return;
      const id = await getDeviceId();
      setCode(id);
      setVisible(true);
    })();
  }, []);

  const handleCopy = () => {
    Clipboard.setString(code);
    setCopied(true);
  };

  const handleClose = async () => {
    await AsyncStorage.setItem(SHOWN_KEY, "1");
    setVisible(false);
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Твоят код за достъп</Text>
          <Text style={styles.body}>
            Запази този код! При смяна на телефон или преинсталация ще можеш да възстановиш всичките си маршрути.
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>{code}</Text>
          </View>
          <Pressable style={styles.copyBtn} onPress={handleCopy}>
            <Text style={styles.copyText}>{copied ? "✓ Копирано!" : "Копирай кода"}</Text>
          </Pressable>
          <Pressable style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeText}>Разбрах, продължи</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.md, width: "100%" },
  title: { color: colors.onSurface, fontSize: 22, fontWeight: "900", textAlign: "center" },
  body: { color: colors.onSurfaceTertiary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  codeBox: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.lg, alignItems: "center", borderWidth: 1, borderColor: colors.border },
  code: { color: colors.brand, fontSize: 28, fontWeight: "900", letterSpacing: 4 },
  copyBtn: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, padding: spacing.md, alignItems: "center", borderWidth: 1, borderColor: colors.brand },
  copyText: { color: colors.brand, fontWeight: "800", fontSize: 15 },
  closeBtn: { backgroundColor: colors.brand, borderRadius: radius.md, padding: spacing.md, alignItems: "center" },
  closeText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
