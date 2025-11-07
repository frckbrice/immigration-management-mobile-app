import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { supportService } from '@/lib/services/supportService';
import FormInput from '@/components/FormInput';

export default function ContactSupportScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async () => {
    if (!subject.trim() || !message.trim()) {
      showAlert({ title: 'Validation', message: 'Please provide subject and message' });
      return;
    }
    try {
      setSubmitting(true);
      await supportService.sendContact(subject.trim(), message.trim());
      setSubject('');
      setMessage('');
      showAlert({ title: 'Success', message: 'Your message has been sent', actions: [{ text: t('common.close'), variant: 'primary' }] });
    } catch (e: any) {
      showAlert({ title: 'Error', message: e?.message || 'Failed to send' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen options={{ headerShown: false }} />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.contactUs')}</Text>
        <FormInput
          label={t('support.subject', { defaultValue: 'Subject' })}
          placeholder={t('support.subjectPlaceholder', { defaultValue: 'Briefly describe your request' })}
          value={subject}
          onChangeText={setSubject}
          autoCapitalize="sentences"
        />
        <FormInput
          label={t('support.message', { defaultValue: 'Message' })}
          placeholder={t('support.messagePlaceholder', { defaultValue: 'Share details so we can assist you faster' })}
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={5}
          style={{ height: Platform.OS === 'ios' ? 120 : 140, textAlignVertical: 'top' }}
          helperText={t('support.responseTime', { defaultValue: 'We typically respond within 1 business day.' })}
        />
        <Pressable style={[styles.button, { opacity: submitting ? 0.7 : 1 }]} onPress={onSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Send</Text>
          )}
        </Pressable>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 12 },
  button: { backgroundColor: '#2196F3', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});


