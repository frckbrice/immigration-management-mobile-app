import React, { useEffect, useState } from 'react';
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { IconSymbol } from '@/components/IconSymbol';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { templatesService, Template } from '@/lib/services/templatesService';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';

export default function TemplatesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const data = await templatesService.getTemplates();
      setTemplates(data);
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to load templates' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleDownload = async (template: Template) => {
    try {
      setDownloading(template.id);
      await templatesService.downloadTemplate(template);
    } catch (e: any) {
      // Show error alert
      showAlert({ title: 'Download Failed', message: e?.message || 'Unable to download template' });
    } finally {
      setDownloading(null);
    }
  };

  const groupedTemplates = templates.reduce((acc: Record<string, Template[]>, template) => {
    const category = template.category || 'Other';
    acc[category] = acc[category] || [];
    acc[category].push(template);
    return acc;
  }, {});

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('documents.downloadTemplates')}</Text>
          <View style={styles.backButton} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTemplates} />}
        >
          {loading && templates.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          ) : Object.keys(groupedTemplates).length === 0 ? (
            <View style={styles.emptyContainer}>
              <IconSymbol name="doc.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
              <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                No templates available
              </Text>
            </View>
          ) : (
            Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
              <View key={category} style={styles.categorySection}>
                <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>{category}</Text>
                {categoryTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[styles.templateCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
                    onPress={() => handleDownload(template)}
                    disabled={downloading === template.id}
                    accessibilityRole="button"
                    accessibilityHint={t('documents.tapToDownload', { defaultValue: 'Tap to download' })}
                    android_ripple={{ color: 'rgba(33, 150, 243, 0.12)' }}
                  >
                    <View style={[styles.templateIcon, { backgroundColor: 'rgba(33, 150, 243, 0.15)' }]}>
                      <IconSymbol name="doc.fill" size={24} color="#2196F3" />
                    </View>
                    <View style={styles.templateContent}>
                      <Text style={[styles.templateName, { color: theme.colors.text }]}>{template.name}</Text>
                      {template.description && (
                        <Text style={[styles.templateDescription, { color: theme.dark ? '#98989D' : '#666' }]}>
                          {template.description}
                        </Text>
                      )}
                      <Text style={[styles.templateHint, { color: theme.dark ? '#98989D' : '#666' }]}>
                        {t('documents.tapToDownload', { defaultValue: 'Tap to download' })}
                      </Text>
                    </View>
                    {downloading === template.id ? (
                      <ActivityIndicator color="#2196F3" />
                    ) : (
                      <IconSymbol name="arrow.down.circle.fill" size={24} color="#2196F3" />
                    )}
                  </Pressable>
                ))}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: { padding: 4, width: 32 },
  title: { fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 24 },
  loadingContainer: { paddingVertical: 40, alignItems: 'center' },
  emptyContainer: { paddingVertical: 64, alignItems: 'center' },
  emptyText: { fontSize: 16, marginTop: 16 },
  categorySection: { marginBottom: 24 },
  categoryTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateContent: { flex: 1 },
  templateName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  templateDescription: { fontSize: 14 },
  templateHint: { fontSize: 13, marginTop: 8 },
});

