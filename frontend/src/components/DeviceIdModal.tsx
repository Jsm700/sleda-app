import { useEffect, useState } from "react";
import { Modal, View, Text, Pressable, StyleSheet, TextInput } from "react-native";
import * as Clipboard from "expo-clipboard";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getDeviceId, setDeviceId } from "@/src/utils/deviceId";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme/colors";

const SHOWN_KEY = "sleda.device_id_shown";

type Props = {
  forceVisible?: boolean;
  onClose?: () => void;
};

export default function DeviceIdModal({ forceVisible, onClose }: Props) {
  const [autoVisible, setAutoVisible] = useState(false);
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"show" | "restore">("show");
  const [inputCode, setInputCode] = useState("");
  const [restoreError, setRestoreError] = useState(false);
  const router = useRouter();
  const visible = forceVisible || autoVisible;

  useEffect(() => {
    // Кодът се генерира тихо в заден план — вече не прекъсваме
    // потребителя с принудителен modal при първо отваряне.
    // Достъпен е само ръчно, през key иконата в архива (forceVisible).
    (async () => {
      const id = await getDeviceId();
      setCode(id);
    })();
  }, [forceVisible]);

  useEffect(() => {
    if (forceVisible) {
      setMode("show");
      setCopied(false);
      setInputCode("");
      setRestoreError(false);
    }
  }, [forceVisible]);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code);
    setCopied(true);
  };

  const handleClose = async () => {
    await AsyncStorage.setItem(SHOWN_KEY, "1");
    setAutoVisible(false);
    onClose?.();
    router.replace("/(tabs)/archive");
  };

  const handleRestore = async () => {
    const trimmed = inputCode.trim().toUpperCase();
    if (!trimmed) {
      setRestoreError(true);
      return;
    }
    await setDeviceId(trimmed);
    await AsyncStorage.setItem(SHOWN_KEY, "1");
    setAutoVisible(false);
    onClose?.();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {mode === "show" ? (
            <>
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
              <Pressable onPress={() => setMode("restore")}>
                <Text style={styles.restoreLink}>Вече имам код от стар телефон</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.title}>Въведи стар код</Text>
              <Text style={styles.body}>
                Въведи кода от предишния си телефон за да възстановиш маршрутите си.
              </Text>
              <TextInput
                style={styles.input}
                value={inputCode}
                onChangeText={(t) => { setInputCode(t); setRestoreError(false); }}
                placeholder="напр. ВЪЛК-4721"
                placeholderTextColor={colors.onSurfaceTertiary}
                autoCapitalize="characters"
              />
              {restoreError && <Text style={styles.errorText}>Въведи валиден код</Text>}
              <Pressable style={styles.closeBtn} onPress={handleRestore}>
                <Text style={styles.closeText}>Възстанови маршрутите</Text>
              </Pressable>
              <Pressable onPress={() => setMode("show")}>
                <Text style={styles.restoreLink}>Назад</Text>
              </Pressable>
            </>
          )}
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
  restoreLink: { color: colors.onSurfaceTertiary, fontSize: 13, textAlign: "center", textDecorationLine: "underline" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.onSurface, fontSize: 18, fontWeight: "700", textAlign: "center", letterSpacing: 2 },
  errorText: { color: colors.error, fontSize: 13, textAlign: "center" },
});
