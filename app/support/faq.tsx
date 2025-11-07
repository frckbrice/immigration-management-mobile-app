import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Platform, FlatList, Pressable, TextInput, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { faqService, FAQItem } from '@/lib/services/faqService';

export default function FAQScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [faqs, setFaqs] = useState<FAQItem[]>([]);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchFAQs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await faqService.getAllFAQs();
      setFaqs(data);
    } catch (e) {
      // Best-effort: keep UI usable even if fetch fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFAQs();
  }, [fetchFAQs]);

  const grouped = useMemo(() => {
    const filtered = faqs.filter((f) =>
      `${f.question} ${f.answer}`.toLowerCase().includes(search.toLowerCase())
    );
    return filtered.reduce((acc: Record<string, FAQItem[]>, item) => {
      acc[item.category] = acc[item.category] || [];
      acc[item.category].push(item);
      return acc;
    }, {});
  }, [faqs, search]);

  const categories = useMemo(() => Object.keys(grouped), [grouped]);

  const renderCategory = ({ item: category }: { item: string }) => (
    <View style={styles.categoryBlock}>
      <Text style={[styles.categoryTitle, { color: theme.colors.text }]}>{category}</Text>
      {grouped[category].map((faq) => (
        <View key={faq.id} style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
          <Pressable onPress={() => setExpandedId(expandedId === faq.id ? null : faq.id)} style={styles.questionRow}>
            <Text style={[styles.question, { color: theme.colors.text }]}>{faq.question}</Text>
            <Text style={[styles.chevron, { color: theme.dark ? '#98989D' : '#666' }]}>
              {expandedId === faq.id ? '−' : '+'}
            </Text>
          </Pressable>
          {expandedId === faq.id && (
            <View style={styles.answerBlock}>
              <Text style={[styles.answer, { color: theme.dark ? '#98989D' : '#444' }]}>{faq.answer}</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.faq')}</Text>
        </View>
        <View style={[styles.search, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('documents.searchPlaceholder')}
            placeholderTextColor={theme.dark ? '#98989D' : '#666'}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
        </View>
        <FlatList
          data={categories}
          keyExtractor={(c) => c}
          renderItem={renderCategory}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchFAQs} />}
          ListEmptyComponent={!loading ? (
            <View style={styles.empty}>
              <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>{t('common.noResults')}</Text>
            </View>
          ) : null}
        />
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  search: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  searchInput: { fontSize: 16 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  categoryBlock: { marginTop: 12 },
  categoryTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  card: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  questionRow: { flexDirection: 'row', alignItems: 'center' },
  question: { flex: 1, fontSize: 16, fontWeight: '600' },
  chevron: { marginLeft: 12, fontSize: 22, fontWeight: '700' },
  answerBlock: { marginTop: 8 },
  answer: { fontSize: 14, lineHeight: 20 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16 },
});


