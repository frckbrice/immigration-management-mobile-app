import React, { useState } from 'react';
import { View, Text, StyleSheet, Platform, Pressable, ActivityIndicator, ScrollView, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from '@/lib/hooks/useTranslation';
import { useBottomSheetAlert } from '@/components/BottomSheetAlert';
import { supportService } from '@/lib/services/supportService';
import FormInput from '@/components/FormInput';
import { IconSymbol } from '@/components/IconSymbol';
import { useToast } from '@/components/Toast';
import { useAppTheme } from '@/lib/hooks/useAppTheme';
import { withOpacity } from '@/styles/theme';
import { BackButton } from '@/components/BackButton';

export default function ContactSupportScreen() {
  const theme = useAppTheme();
  const colors = theme.colors;
  const cardBackground = theme.dark ? colors.surfaceElevated : colors.surface;
  const subtleBackground = theme.dark ? colors.surfaceAlt : colors.surfaceAlt;
  const { t } = useTranslation();
  const router = useRouter();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
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
      showToast({
        type: 'success',
        title: t('common.success'),
        message: t('support.messageSent', { defaultValue: 'Your message has been sent. We will get back to you shortly.' }),
      });
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
      <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 64 : 0}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 140 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.headerRow}>
              <BackButton onPress={() => router.back()} />
              <View style={styles.headerCopy}>
                <Text style={[styles.title, { color: theme.colors.text }]}>{t('profile.contactUs')}</Text>
                <Text style={[styles.subtitle, { color: colors.muted }]}>
                  {t('support.contactSubtitle', { defaultValue: 'We usually respond within one business day.' })}
                </Text>
              </View>
              <View style={styles.headerSpacer} />
            </View>

            <View style={[styles.card, { backgroundColor: cardBackground, borderColor: colors.border, shadowColor: colors.backdrop }]}
            >
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
                numberOfLines={6}
                style={{ height: Platform.OS === 'ios' ? 140 : 160, textAlignVertical: 'top' }}
                helperText={t('support.responseTime', { defaultValue: 'We typically respond within 1 business day.' })}
              />

              <View style={styles.metaRow}>
                <IconSymbol name="envelope.open.fill" size={18} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]}>
                  {t('support.contactHint', { defaultValue: 'Attach order numbers or case IDs when relevant to speed things up.' })}
                </Text>
              </View>
            </View>

            <View style={[styles.quickLinks, { backgroundColor: subtleBackground, borderColor: colors.border }]}>
              <IconSymbol name="questionmark.circle" size={20} color={colors.accent} />
              <Text style={[styles.quickLinkText, { color: colors.text }]}>
                {t('support.faqPrompt', { defaultValue: 'Need quick answers? Visit the FAQ before sending a message.' })}
              </Text>
              <Pressable onPress={() => router.push('/support/faq')}>
                <Text style={[styles.quickLinkAction, { color: colors.primary }]}>{t('support.openFaq', { defaultValue: 'Open FAQ' })}</Text>
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>

        <View
          style={[
            styles.footerBar,
            {
              backgroundColor: cardBackground,
              borderTopColor: colors.border,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => router.back()} disabled={submitting}>
            <Text style={[styles.secondaryText, { color: colors.text }]}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: submitting ? 0.7 : 1 }]} onPress={onSubmit} disabled={submitting}>
            {submitting ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{t('support.send', { defaultValue: 'Send Message' })}</Text>}
          </Pressable>
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32, gap: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerSpacer: { width: 40, height: 40 },
  headerCopy: { flex: 1, gap: 4 },
  title: { fontSize: 26, fontWeight: '700', letterSpacing: -0.2 },
  subtitle: { fontSize: 14 },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 18,
    elevation: 3,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  metaText: { fontSize: 13, lineHeight: 18, flex: 1 },
  quickLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  quickLinkText: { fontSize: 14, flex: 1, lineHeight: 20 },
  quickLinkAction: { fontSize: 14, fontWeight: '700' },
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondaryButton: {
    flex: 1,
    marginRight: 12,
    borderWidth: 1,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryText: { fontSize: 15, fontWeight: '600' },
  primaryButton: { flex: 1, borderRadius: 14, alignItems: 'center', paddingVertical: 12 },
  primaryText: { fontSize: 15, fontWeight: '700' },
});


