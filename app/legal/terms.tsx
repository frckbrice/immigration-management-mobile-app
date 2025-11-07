import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Platform, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { legalService } from '@/lib/services/legalService';

export default function TermsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const c = await legalService.getTerms();
        setContent(c);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.terms')}</Text>
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} />
        ) : (
          <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 24 }}>
            <Text style={[styles.contentText, { color: theme.colors.text }]}>{content || '—'}</Text>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  scroll: { flex: 1 },
  contentText: { fontSize: 16, lineHeight: 22 },
});


