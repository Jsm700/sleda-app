import { View, Text, StyleSheet, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useTranslation } from "@/src/i18n";
import { colors, spacing, radius } from "@/src/theme/colors";

export default function ArchiveScreen() {
  const { t, lang, setLang } = useTranslation();

  return (
    <SafeAreaView style={styles.root} edges={["top", "bottom"]} testID="archive-screen">
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title}>{t("archive")}</Text>
        <View style={styles.langSwitcher}>
          <Pressable
            onPress={() => setLang("bg")}
            style={[styles.langBtn, lang === "bg" && styles.langBtnActive]}
            testID="lang-bg"
          >
            <Text style={[styles.langText, lang === "bg" && styles.langTextActive]}>
              БГ
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setLang("en")}
            style={[styles.langBtn, lang === "en" && styles.langBtnActive]}
            testID="lang-en"
          >
            <Text style={[styles.langText, lang === "en" && styles.langTextActive]}>
              EN
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.empty} testID="archive-empty">
        <MaterialCommunityIcons
          name="map-search-outline"
          size={72}
          color={colors.onSurfaceTertiary}
        />
        <Text style={styles.emptyTitle}>{t("archiveEmpty")}</Text>
        <Text style={styles.emptySub}>{t("archiveSub")}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    color: colors.onSurface,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  langSwitcher: {
    flexDirection: "row",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  langBtn: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
  },
  langBtnActive: {
    backgroundColor: colors.brand,
  },
  langText: {
    color: colors.onSurfaceTertiary,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  langTextActive: {
    color: "#fff",
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  emptyTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "800",
    marginTop: spacing.md,
    textAlign: "center",
  },
  emptySub: {
    color: colors.onSurfaceTertiary,
    fontSize: 14,
    textAlign: "center",
  },
});
