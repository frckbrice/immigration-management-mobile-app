import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Platform } from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { useTheme } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSymbol } from '@/components/IconSymbol';
import { useCasesStore } from '@/stores/cases/casesStore';
import { useDocumentsStore } from '@/stores/documents/documentsStore';
import { useTranslation } from '@/lib/hooks/useTranslation';

export default function CaseDetailsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams();
  const caseId = (params.id || params.caseId) as string;

  const { selectedCase, isLoading, fetchCaseById } = useCasesStore();
  const { documents, fetchDocuments } = useDocumentsStore();

  useEffect(() => {
    if (caseId) {
      fetchCaseById(caseId);
      fetchDocuments(caseId);
    }
  }, [caseId]);

  const statusTimeline = useMemo(() => {
    // Simple ordered timeline based on status; replace with real history when available
    const order = ['submitted', 'under-review', 'documents-required', 'processing', 'approved', 'rejected'];
    const status = (selectedCase as any)?.status || 'submitted';
    const currentIdx = Math.max(0, order.indexOf(String(status)));
    return order.map((s, idx) => ({ key: s, completed: idx <= currentIdx }));
  }, [selectedCase]);

  const handleMessageAdvisor = () => {
    if (!caseId) return;
    router.push({ pathname: '/chat', params: { id: caseId, caseId } });
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <Pressable style={styles.headerBtn} onPress={() => router.back()}>
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('caseDetails.title')}</Text>
          <View style={styles.headerBtn} />
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
          </View>
        )}

        {!isLoading && (
          <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, Platform.OS !== 'ios' && styles.contentWithTabBar]}>
            {/* Case Summary */}
            <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.caseRef, { color: theme.colors.text }]}>
                {(selectedCase as any)?.caseNumber || caseId}
              </Text>
              <Text style={[styles.caseTitle, { color: theme.colors.text }]}>
                {(selectedCase as any)?.title || t('cases.title')}
              </Text>
              <View style={styles.metaRow}>
                <Text style={[styles.metaText, { color: theme.dark ? '#98989D' : '#666' }]}>{t('caseDetails.type')}: {(selectedCase as any)?.type || '—'}</Text>
                <Text style={[styles.metaDot, { color: theme.dark ? '#98989D' : '#666' }]}>•</Text>
                <Text style={[styles.metaText, { color: theme.dark ? '#98989D' : '#666' }]}>{t('caseDetails.status')}: {(selectedCase as any)?.status || '—'}</Text>
              </View>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${(selectedCase as any)?.progress || 0}%` }]} />
              </View>
            </View>

            {/* Agent Info */}
            <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('caseDetails.assignedAdvisor')}</Text>
              {(selectedCase as any)?.assignedAgent ? (
                <View style={styles.agentRow}>
                  <View style={styles.agentAvatar}><IconSymbol name="person.fill" size={20} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.agentName, { color: theme.colors.text }]}>
                      {`${(selectedCase as any).assignedAgent.firstName || ''} ${(selectedCase as any).assignedAgent.lastName || ''}`.trim() || '—'}
                    </Text>
                    <Text style={[styles.agentMeta, { color: theme.dark ? '#98989D' : '#666' }]}>{t('caseDetails.immigrationAdvisor')}</Text>
                  </View>
                  <Pressable style={styles.primaryBtn} onPress={handleMessageAdvisor}>
                    <Text style={styles.primaryBtnText}>{t('caseDetails.messageAdvisor')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyBox}>
                  <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>{t('caseDetails.noAdvisorAssigned')}</Text>
                </View>
              )}
            </View>

            {/* Status Timeline */}
            <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('caseDetails.timeline')}</Text>
              <View style={styles.timelineRow}>
                {statusTimeline.map(step => (
                  <View key={step.key} style={styles.timelineStep}>
                    <View style={[styles.timelineDot, step.completed ? styles.timelineDotDone : styles.timelineDotPending]} />
                    <Text style={[styles.timelineLabel, { color: theme.dark ? '#98989D' : '#666' }]}>{step.key.replace(/-/g, ' ')}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Required Documents (basic) */}
            <View style={[styles.card, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('caseDetails.documents')}</Text>
              {documents.length === 0 ? (
                <View style={styles.emptyBox}><Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>{t('caseDetails.noDocuments')}</Text></View>
              ) : (
                documents.map(doc => (
                  <View key={doc.id} style={styles.docRow}>
                    <View style={styles.docIcon}><IconSymbol name="doc.fill" size={18} color="#2196F3" /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.docName, { color: theme.colors.text }]} numberOfLines={1}>{doc.name}</Text>
                      <Text style={[styles.docMeta, { color: theme.dark ? '#98989D' : '#666' }]}>{doc.size} • {doc.date}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  headerBtn: { padding: 8, width: 32 },
  headerTitle: { fontSize: 18, fontWeight: '700' },
  loadingContainer: { paddingVertical: 40, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 12 },
  contentWithTabBar: { paddingBottom: 100 },
  card: { borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  caseRef: { fontSize: 12, fontWeight: '600', opacity: 0.8 },
  caseTitle: { fontSize: 20, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  metaText: { fontSize: 13 },
  metaDot: { fontSize: 13 },
  progressBarBg: { height: 8, borderRadius: 4, backgroundColor: '#E0E0E0', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#2196F3' },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  agentRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  agentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#2196F3', justifyContent: 'center', alignItems: 'center' },
  agentName: { fontSize: 16, fontWeight: '700' },
  agentMeta: { fontSize: 12 },
  primaryBtn: { backgroundColor: '#2196F3', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  primaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyBox: { paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14 },
  timelineRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  timelineStep: { alignItems: 'center', width: '30%' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginBottom: 6 },
  timelineDotDone: { backgroundColor: '#4CAF50' },
  timelineDotPending: { backgroundColor: '#BDBDBD' },
  timelineLabel: { fontSize: 12, textTransform: 'capitalize', textAlign: 'center' },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  docIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E3F2FD', justifyContent: 'center', alignItems: 'center' },
  docName: { fontSize: 15, fontWeight: '600' },
  docMeta: { fontSize: 12 },
});


