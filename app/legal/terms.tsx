import React, { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, ActivityIndicator, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { IconSymbol } from '@/components/IconSymbol';
import { useAppTheme, useThemeColors } from '@/lib/hooks/useAppTheme';
import { withOpacity } from '@/styles/theme';
import { useLegalStore } from '@/stores/legal/legalStore';
import { BackButton } from '@/components/BackButton';

export default function TermsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const appTheme = useAppTheme();
  const colors = useThemeColors();
  const { t, currentLanguage } = useTranslation();

  const fetchDocument = useLegalStore((state) => state.fetchDocument);
  const loading = useLegalStore((state) => state.loading.terms);
  const error = useLegalStore((state) => state.error.terms);
  const getDocument = useLegalStore((state) => state.getDocument);
  const cacheEntry = useMemo(
    () => getDocument('terms', currentLanguage),
    [getDocument, currentLanguage]
  );

  const content = cacheEntry?.content ?? '';
  const fetchedAt = cacheEntry?.fetchedAt ?? null;
  const hasContent = content.trim().length > 0;
  const isInitialLoading = !hasContent && loading;
  const isRefreshing = hasContent && loading;

  useEffect(() => {
    fetchDocument('terms', currentLanguage).catch(() => {
      // handled via store error state
    });
  }, [currentLanguage, fetchDocument]);

  const handleRefresh = useCallback(() => {
    fetchDocument('terms', currentLanguage, { force: true }).catch(() => {
      // handled via store error state
    });
  }, [currentLanguage, fetchDocument]);

  const lastSyncedLabel = useMemo(() => {
    if (!fetchedAt) return null;
    return new Date(fetchedAt).toLocaleString();
  }, [fetchedAt]);

  const paragraphs = useMemo(() => {
    if (!hasContent) {
      return [];
    }
    return content
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }, [content, hasContent]);

  const metaTint = withOpacity(colors.primary, appTheme.dark ? 0.28 : 0.12);
  const errorBackground = withOpacity(colors.danger ?? '#EF4444', appTheme.dark ? 0.24 : 0.12);
  const errorBorder = withOpacity(colors.danger ?? '#EF4444', appTheme.dark ? 0.45 : 0.28);

  return (
    <>
      {Platform.OS === 'ios' && <Stack.Screen options={{ headerShown: false }} />}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? "#1f2937" : theme.colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.terms')}</Text>
          <View style={styles.headerAccessory} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(40, insets.bottom + 32) },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
              progressViewOffset={16}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.metaRow, { backgroundColor: metaTint }]}>
            <IconSymbol name="clock" size={16} color={colors.primary} />
            <Text style={[styles.metaText, { color: colors.muted }]}>
              {lastSyncedLabel
                ? t('legal.lastUpdated', { defaultValue: 'Last synced {{date}}', date: lastSyncedLabel })
                : t('legal.lastUpdatedUnknown', { defaultValue: 'Last updated recently' })}
            </Text>
            <Pressable style={styles.metaRefresh} onPress={handleRefresh}>
              <IconSymbol name="arrow.clockwise" size={16} color={colors.primary} />
              <Text style={[styles.metaRefreshText, { color: colors.primary }]}>
                {t('common.refresh', { defaultValue: 'Refresh' })}
              </Text>
            </Pressable>
          </View>

          {isInitialLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.muted }]}> 
                {t('common.loading', { defaultValue: 'Loading...' })}
              </Text>
            </View>
          ) : !hasContent && error ? (
            <View style={[styles.feedbackCard, { backgroundColor: errorBackground, borderColor: errorBorder }]}> 
              <IconSymbol name="exclamationmark.triangle.fill" size={24} color={colors.danger ?? '#EF4444'} />
              <View style={styles.feedbackTextGroup}>
                <Text style={[styles.feedbackTitle, { color: colors.danger ?? '#EF4444' }]}> 
                  {t('common.error', { defaultValue: 'Error' })}
                </Text>
                <Text style={[styles.feedbackMessage, { color: colors.muted }]}>{error}</Text>
              </View>
              <Pressable style={[styles.retryButton, { borderColor: colors.primary }]} onPress={handleRefresh}>
                <Text style={[styles.retryText, { color: colors.primary }]}> 
                  {t('common.retry', { defaultValue: 'Retry' })}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={[styles.contentCard, { backgroundColor: colors.surface, borderColor: withOpacity(colors.text, appTheme.dark ? 0.12 : 0.08), shadowColor: withOpacity(colors.text, appTheme.dark ? 0.45 : 0.2) }]}> 
              {paragraphs.map((paragraph, index) => (
                <Text key={index} style={[styles.contentParagraph, { color: colors.text }]}> 
                  {paragraph}
                </Text>
              ))}
              {!paragraphs.length && (
                <Text style={[styles.contentParagraph, { color: colors.muted }]}>—</Text>
              )}
            </View>
          )}

          {hasContent && error && (
            <View style={[styles.noticeCard, { backgroundColor: errorBackground, borderColor: errorBorder }]}> 
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color={colors.danger ?? '#EF4444'} />
              <Text style={[styles.noticeText, { color: colors.muted }]}> 
                {t('legal.refreshFailed', { defaultValue: 'Unable to refresh right now. Showing the last saved version.' })}
              </Text>
            </View>
          )}
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerAccessory: {
    width: 36,
    height: 36,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  scrollContent: {
    gap: 20,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  metaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '500',
  },
  metaRefresh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaRefreshText: {
    fontSize: 13,
    fontWeight: '600',
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    borderRadius: 20,
    gap: 12,
    backgroundColor: withOpacity('#000000', 0.04),
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  contentCard: {
    borderRadius: 22,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 22,
    shadowOpacity: 0.12,
    gap: 16,
  },
  contentParagraph: {
    fontSize: 15,
    lineHeight: 22,
  },
  feedbackCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  feedbackTextGroup: {
    flex: 1,
    gap: 4,
  },
  feedbackTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  feedbackMessage: {
    fontSize: 14,
    lineHeight: 20,
  },
  retryButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  noticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
