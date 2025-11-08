import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTheme } from "@react-navigation/native";

import { IconSymbol } from "@/components/IconSymbol";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useCasesStore } from "@/stores/cases/casesStore";

const PRIORITY_ACCENTS: Record<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', string> = {
  LOW: "#38bdf8",
  NORMAL: "#22c55e",
  HIGH: "#f97316",
  URGENT: "#ef4444",
};

const PRIORITY_ICONS: Record<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', string> = {
  LOW: "tortoise.fill",
  NORMAL: "calendar",
  HIGH: "exclamationmark.circle.fill",
  URGENT: "bolt.fill",
};

const SERVICE_ICONS: Record<string, string> = {
  STUDENT_VISA: "graduationcap.fill",
  WORK_PERMIT: "briefcase.fill",
  FAMILY_REUNIFICATION: "person.2.fill",
  TOURIST_VISA: "airplane.departure",
  BUSINESS_VISA: "chart.bar.fill",
  PERMANENT_RESIDENCY: "house.fill",
};

const SERVICE_TYPES = Object.keys(SERVICE_ICONS) as Array<keyof typeof SERVICE_ICONS>;
const PRIORITY_TYPES = Object.keys(PRIORITY_ACCENTS) as Array<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>;

export default function NewCaseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [serviceType, setServiceType] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const { createCase, isLoading } = useCasesStore();

  const colors = useMemo(() => ({
    primary: theme.colors.primary ?? '#2563EB',
    card: theme.colors.card ?? (theme.dark ? '#1c1c1e' : '#ffffff'),
    cardBorder: theme.colors.border ?? (theme.dark ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.08)'),
    subtleBackground: theme.dark ? 'rgba(118,118,128,0.18)' : 'rgba(37,99,235,0.08)',
    mutedText: theme.dark ? 'rgba(235,235,245,0.7)' : 'rgba(71,85,105,1)',
    elevatedBackground: theme.dark ? 'rgba(37,99,235,0.24)' : 'rgba(37,99,235,0.12)',
    highlightBackground: theme.dark ? 'rgba(37,99,235,0.18)' : 'rgba(37,99,235,0.05)',
  }), [theme]);

  const handleSubmit = async () => {
    if (!serviceType) {
      showAlert({ title: t('common.error'), message: t('newCase.fillAllFields') });
      return;
    }

    const newCase = await createCase({
      serviceType,
      priority,
    });

    if (newCase) {
      showAlert({
        title: t('common.success'),
        message: t('newCase.caseCreated'),
        actions: [{ text: t('common.close'), onPress: () => router.back(), variant: 'primary' }],
      });
    } else {
      showAlert({ title: t('common.error'), message: t('newCase.caseFailed') });
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('newCase.title')}</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { backgroundColor: theme.colors.background }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.hero, { backgroundColor: colors.subtleBackground, borderColor: colors.cardBorder }]}>
            <View style={[styles.heroIcon, { backgroundColor: colors.elevatedBackground }]}>
              <IconSymbol name="square.and.pencil" size={22} color={colors.primary} />
            </View>
            <View style={styles.heroCopy}>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>{t('newCase.heroTitle')}</Text>
              <Text style={[styles.heroSubtitle, { color: colors.mutedText }]}>{t('newCase.heroSubtitle')}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('newCase.serviceType')} <Text style={[styles.sectionRequired, { color: colors.mutedText }]}>{t('newCase.required')}</Text>
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>{t('newCase.serviceTypeHelper')}</Text>
            </View>

            <View style={styles.cardGrid}>
              {SERVICE_TYPES.map((type) => {
                const isSelected = serviceType === type;
                const translationKey = type.toLowerCase();
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.cardOption,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.cardBorder,
                        shadowColor: theme.dark ? '#000' : colors.primary,
                      },
                      isSelected && {
                        borderColor: colors.primary,
                        backgroundColor: colors.highlightBackground,
                        shadowOpacity: theme.dark ? 0.35 : 0.12,
                        shadowRadius: 18,
                      },
                    ]}
                    onPress={() => setServiceType(type)}
                  >
                    <View style={[
                      styles.cardIconWrapper,
                      { backgroundColor: isSelected ? colors.primary : colors.elevatedBackground },
                    ]}>
                      <IconSymbol
                        name={SERVICE_ICONS[type]}
                        size={20}
                        color={isSelected ? theme.colors.background : colors.primary}
                      />
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
                        {t(`newCase.serviceTypes.${translationKey}.title`)}
                      </Text>
                      <Text style={[styles.cardSubtitle, { color: colors.mutedText }]}>
                        {t(`newCase.serviceTypes.${translationKey}.description`)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                {t('newCase.priority')} <Text style={[styles.sectionRequired, { color: colors.mutedText }]}>{t('newCase.required')}</Text>
              </Text>
              <Text style={[styles.sectionSubtitle, { color: colors.mutedText }]}>{t('newCase.priorityHelper')}</Text>
            </View>

            <View style={styles.priorityColumn}>
              {PRIORITY_TYPES.map((type) => {
                const isSelected = priority === type;
                const translationKey = type.toLowerCase();
                return (
                  <Pressable
                    key={type}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    style={[
                      styles.priorityPill,
                      {
                        borderColor: isSelected ? PRIORITY_ACCENTS[type] : colors.cardBorder,
                        backgroundColor: isSelected ? colors.highlightBackground : colors.card,
                      },
                    ]}
                    onPress={() => setPriority(type)}
                  >
                    <View style={[
                      styles.priorityIconWrapper,
                      { backgroundColor: isSelected ? PRIORITY_ACCENTS[type] : colors.elevatedBackground },
                    ]}>
                      <IconSymbol
                        name={PRIORITY_ICONS[type]}
                        size={16}
                        color={isSelected ? '#ffffff' : PRIORITY_ACCENTS[type]}
                      />
                    </View>
                    <View style={styles.priorityCopy}>
                      <Text style={[styles.priorityTitle, { color: theme.colors.text }]}>
                        {t(`newCase.priorities.${translationKey}.title`)}
                      </Text>
                      <Text style={[styles.prioritySubtitle, { color: colors.mutedText }]}>
                        {t(`newCase.priorities.${translationKey}.description`)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            style={[styles.submitButton, { backgroundColor: colors.primary }, ((!serviceType || !priority) || isLoading) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!serviceType || !priority || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.submitButtonText}>{t('newCase.submitCta')}</Text>
            )}
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 24,
  },
  hero: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    gap: 16,
  },
  sectionHeader: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  sectionRequired: {
    fontSize: 14,
    fontWeight: '500',
  },
  sectionSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  cardGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  cardOption: {
    flexGrow: 1,
    minWidth: '48%',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    gap: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 18,
    elevation: 2,
  },
  cardIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  priorityColumn: {
    gap: 12,
  },
  priorityPill: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  priorityIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  priorityCopy: {
    flex: 1,
    gap: 4,
  },
  priorityTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  prioritySubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  submitButton: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});
