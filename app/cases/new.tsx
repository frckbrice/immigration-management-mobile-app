
import React, { useState, useMemo } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";

export default function NewCaseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [serviceType, setServiceType] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const { createCase, isLoading } = useCasesStore();

  const serviceTypeOptions = useMemo(() => [
    'STUDENT_VISA',
    'WORK_PERMIT',
    'FAMILY_REUNIFICATION',
    'TOURIST_VISA',
    'BUSINESS_VISA',
    'PERMANENT_RESIDENCY',
  ], []);

  const priorityOptions: Array<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'> = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];

  const formatLabel = (value: string) =>
    value
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/(^|\s)\w/g, (character) => character.toUpperCase());

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
        actions: [{ text: t('common.close'), onPress: () => router.back(), variant: 'primary' }]
      });
    } else {
      showAlert({ title: t('common.error'), message: t('newCase.caseFailed') });
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {t('newCase.title')}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Service Type */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}> 
              {t('newCase.serviceType')} *
            </Text>
            <View style={styles.caseTypeGrid}>
              {serviceTypeOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.caseTypeButton,
                    serviceType === option && styles.caseTypeButtonSelected,
                    { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' },
                    serviceType === option && { backgroundColor: '#2196F3' },
                  ]}
                  onPress={() => setServiceType(option)}
                >
                  <Text
                    style={[
                      styles.caseTypeText,
                      { color: theme.colors.text },
                      serviceType === option && { color: '#fff' },
                    ]}
                  >
                    {formatLabel(option)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Priority */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}> 
              {t('newCase.priority')} *
            </Text>
            <View style={styles.caseTypeGrid}>
              {priorityOptions.map((option) => (
                <Pressable
                  key={option}
                  style={[
                    styles.caseTypeButton,
                    priority === option && styles.caseTypeButtonSelected,
                    { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' },
                    priority === option && { backgroundColor: '#2196F3' },
                  ]}
                  onPress={() => setPriority(option)}
                >
                  <Text
                    style={[
                      styles.caseTypeText,
                      { color: theme.colors.text },
                      priority === option && { color: '#fff' },
                    ]}
                  >
                    {formatLabel(option)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <Pressable 
            style={[
              styles.submitButton,
              ((!serviceType || !priority) || isLoading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!serviceType || !priority || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit Case</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  caseTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  caseTypeButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  caseTypeButtonSelected: {
    backgroundColor: '#2196F3',
  },
  caseTypeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
