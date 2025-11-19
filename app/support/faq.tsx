import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, FlatList, Pressable, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { type FAQItem } from '@/lib/services/faqService';
import { IconSymbol } from '@/components/IconSymbol';
import FormInput from '@/components/FormInput';
import { useAppTheme, useThemeColors } from '@/lib/hooks/useAppTheme';
import { withOpacity } from '@/styles/theme';
import { BackButton } from '@/components/BackButton';
import { useFaqStore } from '@/stores/faq/faqStore';
import { logger } from '@/lib/utils/logger';

export default function FAQScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const appTheme = useAppTheme();
  const colors = useThemeColors();
  const surfaceCard = appTheme.dark ? colors.surfaceElevated : colors.surface;
  const softSurface = appTheme.dark ? withOpacity(colors.surfaceAlt ?? colors.surface, 0.6) : withOpacity(colors.text, 0.04);
  const borderColor = appTheme.dark ? withOpacity(colors.onSurface ?? colors.text, 0.12) : withOpacity(colors.text, 0.08);
  const faqs = useFaqStore((state) => state.faqs);
  const isLoading = useFaqStore((state) => state.isLoading);
  const fetchFaqs = useFaqStore((state) => state.fetchFAQs);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchFaqs().catch((error) => { logger.error('\n\n Failed to fetch FAQs', error); });
  }, [fetchFaqs]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchFaqs({ force: true });
    } catch (error) {
      logger.error('\n\n Failed to refresh FAQs', error);
    // no-op, best-effort refresh
    } finally {
      setRefreshing(false);
    }
  }, [fetchFaqs]);

  const { grouped, filteredList } = useMemo(() => {
    const filtered = faqs.filter((f) =>
      `${f.question} ${f.answer}`.toLowerCase().includes(search.trim().toLowerCase())
    );
    const groupedMap = filtered.reduce((acc: Record<string, FAQItem[]>, item) => {
      acc[item.category] = acc[item.category] || [];
      acc[item.category].push(item);
      return acc;
    }, {});
    return { grouped: groupedMap, filteredList: filtered };
  }, [faqs, search]);

  const categories = useMemo(
    () => Object.keys(grouped).sort((a, b) => a.localeCompare(b)),
    [grouped]
  );
  const resultsCount = filteredList.length;

  const renderCategory = ({ item: category }: { item: string }) => {
    const items = grouped[category] || [];
    const pillBackground = withOpacity(colors.primary, appTheme.dark ? 0.35 : 0.12);
    const pillBorder = withOpacity(colors.primary, appTheme.dark ? 0.6 : 0.3);
    const showMutedState = items.every((faq) => faq.isActive === false);
    const cardBorderColor = showMutedState ? withOpacity(colors.text, appTheme.dark ? 0.08 : 0.12) : borderColor;

    return (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <View style={[styles.categoryPill, { backgroundColor: pillBackground, borderColor: pillBorder }]}>
            <Text style={[styles.categoryPillText, { color: colors.primary }]}>{category}</Text>
          </View>
          <Text style={[styles.categoryCount, { color: colors.muted }]}>
            {t('common.resultsCount', { defaultValue: '{{count}} articles', count: items.length })}
          </Text>
        </View>

        {items.map((faq) => {
          const isExpanded = expandedId === faq.id;
          return (
            <View
              key={faq.id}
              style={[
                styles.card,
                {
                  backgroundColor: surfaceCard,
                  borderColor: cardBorderColor,
                  shadowColor: appTheme.dark ? '#000' : colors.primary,
                },
                faq.isActive === false && styles.cardInactive,
              ]}
            >
              <Pressable
                onPress={() => setExpandedId(isExpanded ? null : faq.id)}
                style={styles.questionRow}
                accessibilityRole="button"
                accessibilityState={{ expanded: isExpanded }}
              >
                <View
                  style={[
                    styles.questionIconWrapper,
                    { backgroundColor: withOpacity(colors.primary, appTheme.dark ? 0.28 : 0.12) },
                  ]}
                >
                  <IconSymbol name={isExpanded ? 'chevron.down' : 'chevron.right'} size={16} color={colors.primary} />
                </View>
                <Text style={[styles.question, { color: colors.text }]}>{faq.question}</Text>
                <IconSymbol
                  name={isExpanded ? 'chevron.up' : 'chevron.down'}
                  size={18}
                  color={colors.muted}
                />
              </Pressable>
              {isExpanded && (
                <View style={[styles.answerBlock, { backgroundColor: softSurface }]}>
                  <Text style={[styles.answer, { color: colors.muted }]}>{faq.answer}</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? "#1f2937" : theme.colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={() => router.back()} />
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.faq')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <FlatList
          data={categories}
          keyExtractor={(c) => c}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <View
                style={[
                  styles.heroCard,
                  {
                    backgroundColor: withOpacity(colors.primary, appTheme.dark ? 0.22 : 0.1),
                    borderColor: withOpacity(colors.primary, appTheme.dark ? 0.45 : 0.25),
                    shadowColor: colors.primary,
                  },
                ]}
              >
                <View
                  style={[
                    styles.heroIcon,
                    { backgroundColor: withOpacity(colors.warning, appTheme.dark ? 0.3 : 0.12) },
                  ]}
                >
                  <IconSymbol name="headphones" size={28} color={colors.warning} />
                </View>
                <View style={styles.heroCopy}>
                  <Text style={[styles.heroTitle, { color: colors.text }]}>
                    {t('profile.faqHeroTitle', { defaultValue: 'How can we help today?' })}
                  </Text>
                  <Text style={[styles.heroSubtitle, { color: colors.muted }]}>
                    {t('profile.faqHeroSubtitle', { defaultValue: 'Browse our curated knowledge base or reach out to support if you need a hand.' })}
                  </Text>
                </View>
                <Pressable
                  style={[styles.heroButton, { backgroundColor: colors.primary }]}
                  onPress={() => router.push('/support/contact')}
                >
                  <IconSymbol name="message.fill" size={16} color={colors.onPrimary} />
                  <Text style={[styles.heroButtonText, { color: colors.onPrimary }]}>
                    {t('support.contactSupport', { defaultValue: 'Contact Support' })}
                  </Text>
                </Pressable>
              </View>
              <FormInput
                value={search}
                onChangeText={setSearch}
                placeholder={t('profile.faqSearchPlaceholder', { defaultValue: 'Search questions or keywords' })}
                containerStyle={styles.searchInputContainer}
                label={t('common.search')}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
              <View style={styles.resultsMeta}>
                <Text style={[styles.resultsText, { color: colors.muted }]}>
                  {t('profile.faqResultsSummary', {
                    defaultValue: 'Showing {{count}} result(s)',
                    count: resultsCount,
                  })}
                </Text>
              </View>
            </View>
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
          ListEmptyComponent={!(isLoading && !refreshing) ? (
            <View style={[styles.empty, { backgroundColor: withOpacity(colors.primary, appTheme.dark ? 0.12 : 0.05) }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={28} color={colors.warning} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>
                {t('common.noResults')}
              </Text>
              <Text style={[styles.emptySubtitle, { color: colors.muted }]}>
                {t('profile.faqEmptyDescription', { defaultValue: 'Try a different keyword or reach out to our support specialists.' })}
              </Text>
              <Pressable
                style={[styles.emptyButton, { backgroundColor: colors.primary }]}
                onPress={() => router.push('/support/contact')}
              >
                <Text style={[styles.emptyButtonText, { color: colors.onPrimary }]}>
                  {t('support.contactSupport', { defaultValue: 'Contact Support' })}
                </Text>
              </Pressable>
            </View>
          ) : null}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
  },
  listHeader: {
    gap: 20,
    paddingBottom: 8,
  },
  heroCard: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: 6,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  heroSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    marginLeft: 16,
    gap: 8,
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchInputContainer: {
    marginBottom: 8,
  },
  resultsMeta: {
    marginTop: 12,
  },
  resultsText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 24,
  },
  categorySection: {
    gap: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  categoryCount: {
    fontSize: 13,
    fontWeight: '500',
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 4,
  },
  cardInactive: {
    opacity: 0.7,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  questionIconWrapper: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  answerBlock: {
    marginTop: 14,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  answer: {
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
    borderRadius: 18,
    marginTop: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  emptyButton: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});


