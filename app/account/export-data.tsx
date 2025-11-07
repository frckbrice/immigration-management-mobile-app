import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { profileService } from '@/lib/services/profileService';

export default function ExportDataScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [exporting, setExporting] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const onExport = async () => {
    try {
      setExporting(true);
      const data = await profileService.exportData();
      setLastMessage('Export requested successfully');
      showAlert({ title: 'Success', message: 'Your data export has been initiated.', actions: [{ text: t('common.close'), variant: 'primary' }] });
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to export' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.exportMyData')}</Text>
        <Pressable style={[styles.button, { opacity: exporting ? 0.7 : 1 }]} onPress={onExport} disabled={exporting}>
          {exporting ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>{t('common.submit')}</Text>}
        </Pressable>
        {lastMessage && (
          <Text style={[styles.note, { color: theme.dark ? '#98989D' : '#666' }]}>{lastMessage}</Text>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  button: { backgroundColor: '#2196F3', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  note: { marginTop: 12, fontSize: 14 },
});


