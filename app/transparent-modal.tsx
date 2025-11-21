import { StyleSheet, Text, Pressable } from "react-native";
import { router } from "expo-router";
import { GlassView } from "expo-glass-effect";
import { useTheme } from "@react-navigation/native";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function TransparentModal() {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <Pressable style={styles.backdrop} onPress={() => router.back()}>
      <Pressable onPress={(e) => e.stopPropagation()}>
        <GlassView style={styles.modal} glassEffectStyle="regular">
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {t("modals.transparentModal")}
          </Text>
          <Text style={[styles.text, { color: theme.colors.text }]}>
            {t("modals.transparentModalDescription")}
          </Text>
        </GlassView>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modal: {
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    minWidth: 200,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 12,
    // color handled dynamically
  },
  text: {
    fontSize: 16,
    textAlign: "center",
    // color handled dynamically
  },
});
