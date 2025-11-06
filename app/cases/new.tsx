
import React, { useState } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, ActivityIndicator, Alert } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function NewCaseScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [caseTitle, setCaseTitle] = useState('');
  const [caseType, setCaseType] = useState('');
  const [description, setDescription] = useState('');
  const { createCase, isLoading } = useCasesStore();

  const caseTypes = [
    'H-1B Visa',
    'Green Card',
    'F-1 Student Visa',
    'L-1 Visa',
    'O-1 Visa',
    'Other',
  ];

  const handleSubmit = async () => {
    if (!caseTitle.trim() || !caseType || !description.trim()) {
      Alert.alert(t('common.error'), t('newCase.fillAllFields'));
      return;
    }

    const newCase = await createCase({
      title: caseTitle.trim(),
      type: caseType,
      description: description.trim(),
    });

    if (newCase) {
      Alert.alert(t('common.success'), t('newCase.caseCreated'), [
        { text: t('common.close'), onPress: () => router.back() },
      ]);
    } else {
      Alert.alert(t('common.error'), t('newCase.caseFailed'));
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
          {/* Case Title */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {t('newCase.caseTitle')} *
            </Text>
            <View style={[styles.inputWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                placeholder={t('newCase.caseTitlePlaceholder')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={caseTitle}
                onChangeText={setCaseTitle}
              />
            </View>
          </View>

          {/* Case Type */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {t('newCase.caseType')} *
            </Text>
            <View style={styles.caseTypeGrid}>
              {caseTypes.map((type) => (
                <Pressable
                  key={type}
                  style={[
                    styles.caseTypeButton,
                    caseType === type && styles.caseTypeButtonSelected,
                    { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' },
                    caseType === type && { backgroundColor: '#2196F3' },
                  ]}
                  onPress={() => setCaseType(type)}
                >
                  <Text
                    style={[
                      styles.caseTypeText,
                      { color: theme.colors.text },
                      caseType === type && { color: '#fff' },
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.inputContainer}>
            <Text style={[styles.inputLabel, { color: theme.colors.text }]}>
              {t('newCase.description')} *
            </Text>
            <View style={[styles.textAreaWrapper, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
              <TextInput
                style={[styles.textArea, { color: theme.colors.text }]}
                placeholder={t('newCase.descriptionPlaceholder')}
                placeholderTextColor={theme.dark ? '#98989D' : '#666'}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Submit Button */}
          <Pressable 
            style={[
              styles.submitButton,
              ((!caseTitle || !caseType || !description) || isLoading) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!caseTitle || !caseType || !description || isLoading}
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
  inputWrapper: {
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  input: {
    paddingVertical: 16,
    fontSize: 16,
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
  textAreaWrapper: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textArea: {
    fontSize: 16,
    minHeight: 120,
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
