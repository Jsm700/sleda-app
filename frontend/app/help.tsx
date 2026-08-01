import { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { colors, spacing, radius } from "@/src/theme/colors";

type FaqItem = { question: string; answer: string };

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Моят код (смяна на телефон)",
    answer:
      "Всяко устройство получава уникален код (напр. ВЪЛК-4721), с който маршрутите ти се пазят без акаунт/парола. Преди да смениш телефон, отвори раздел \"Следи\" → иконата за ключ горе → виж кода си. На новия телефон, същото меню има опция да въведеш стария код и да си върнеш маршрутите.",
  },
  {
    question: "Повтори маршрут",
    answer:
      "Зарежда стар записан маршрут като полупрозрачна пътека (магента цвят) върху картата, докато записваш нов - полезно да следваш точно същия път като преди. Бутонът показва Скрий/Покажи, докато е зареден маршрут; дълго натискане отваря списъка за избор на друг.",
  },
  {
    question: "Офлайн карти",
    answer:
      "Сваля картинки от картата предварително, за да работят без интернет на място без покритие. Търсиш място или тапваш направо на картата, избираш радиус и детайлност, после стил (Стандартна/Топографска/Сателит). Веднъж свалени, се показват автоматично на живо в приложението - не се налага нищо друго.",
  },
  {
    question: "Споделяне на маршрут",
    answer:
      "Линк - работи във всяко приложение (Viber, Messenger, и т.н.), отваря карта в браузъра, без да е нужно другия човек да има Следа. GPX файл - стандартен формат за импорт в друго устройство със Следа, пази маркери и снимки, но не се отваря директно в чат приложения като Viber.",
  },
  {
    question: "Стилове на картата",
    answer:
      "Стандартна - обикновена карта с улици/сгради. Топографска - contour линии, показва туристически пътеки ясно, по подразбиране. Сателит - реални снимки от въздух, детайлността варира по локация (по-слаба в отдалечени райони).",
  },
  {
    question: "Маркери и снимки",
    answer:
      "Тапваш бутон (Гъба/Риба/Опасност/Бележка) → маркер се поставя на текущата ти позиция. Можеш да добавиш снимка и бележка към всеки. При СТАРТ и СТОП автоматично се поставят Начало/Край маркери, без ръчно действие.",
  },
  {
    question: "Разходка / Лодка режим",
    answer:
      "Превключвателят горе сменя набора от бутони (Гъба за Разходка, Риба за Лодка) и активира допълнителни функции за Лодка - разстояние до бряг, известия при приближаване/отдалечаване от вода.",
  },
  {
    question: "Пауза при запис",
    answer:
      "Спира да брои времето/дистанцията към \"движение\", но GPS продължава да записва (полезно при дрейф с лодка или почивка по пътя). След запис виждаш разбивка Движение/Пауза, с различен цвят на пътеката за всяка отсечка.",
  },
  {
    question: "Известия за брега",
    answer:
      "Само в режим Лодка, по време на запис. Тапваш бейджа с вълничката, за да зададеш кога да получиш известие - при приближаване под избрано разстояние, или при отдалечаване над него. По подразбиране е изключено.",
  },
];

export default function HelpScreen() {
  const router = useRouter();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <View style={styles.root} testID="help-screen">
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.headerWrap}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn} testID="help-back-btn">
            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Помощ</Text>
          <View style={{ width: 44 }} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: spacing.md, paddingBottom: spacing.xl }}>
        {FAQ_ITEMS.map((item, i) => {
          const open = openIndex === i;
          return (
            <View key={i} style={styles.card}>
              <Pressable
                onPress={() => setOpenIndex(open ? null : i)}
                style={styles.cardHeader}
                testID={`faq-item-${i}`}
              >
                <Text style={styles.question}>{item.question}</Text>
                <MaterialCommunityIcons
                  name={open ? "chevron-up" : "chevron-down"}
                  size={22}
                  color={colors.onSurfaceTertiary}
                />
              </Pressable>
              {open && <Text style={styles.answer}>{item.answer}</Text>}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  headerWrap: { backgroundColor: colors.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.sm },
  title: { color: colors.onSurface, fontSize: 18, fontWeight: "900" },
  scroll: { flex: 1 },
  card: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
  },
  question: { color: colors.onSurface, fontSize: 15, fontWeight: "800", flex: 1, marginRight: spacing.sm },
  answer: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 20,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
});
