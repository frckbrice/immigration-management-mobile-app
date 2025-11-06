
import React, { useState, useEffect } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, TextInput, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useCasesStore } from "@/stores/cases/casesStore";
import type { Case } from "@/lib/types";
import { useTranslation } from "@/lib/hooks/useTranslation";

type CaseStatus = 'all' | 'active' | 'action-required' | 'complete';

export default function CasesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const [selectedFilter, setSelectedFilter] = useState<CaseStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { cases, isLoading, error, fetchCases, clearError } = useCasesStore();

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (error) {
      // Clear error after 5 seconds
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const getFilteredCases = () => {
    let filtered = cases;

    // Apply status filter
    if (selectedFilter !== 'all') {
      filtered = filtered.filter((c) => {
        if (selectedFilter === 'active') {
          return c.status === 'pending' || c.status === 'in-review';
        }
        if (selectedFilter === 'action-required') {
          return c.status === 'action-required';
        }
        return c.status === selectedFilter;
      });
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          c.caseNumber.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'action-required':
        return '#FFA726';
      case 'approved':
        return '#66BB6A';
      case 'pending':
        return '#42A5F5';
      default:
        return '#999';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'action-required':
        return t('cases.filterActionRequired');
      case 'approved':
        return t('cases.approved');
      case 'pending':
        return t('cases.submitted');
      default:
        return status;
    }
  };

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('cases.title')}</Text>
          <Pressable onPress={() => console.log('Notifications pressed')}>
            <IconSymbol name="bell.fill" size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchCases} />
          }
        >
          {/* Search Bar */}
          <View style={[styles.searchContainer, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
            <IconSymbol name="magnifyingglass" size={20} color={theme.dark ? '#98989D' : '#666'} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder={t('cases.searchPlaceholder')}
              placeholderTextColor={theme.dark ? '#98989D' : '#666'}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterContainer}>
            <Pressable
              style={[
                styles.filterTab,
                selectedFilter === 'all' && { backgroundColor: '#2196F3' },
                selectedFilter !== 'all' && { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' },
              ]}
              onPress={() => setSelectedFilter('all')}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === 'all' ? { color: '#fff' } : { color: theme.colors.text },
                ]}
              >
                {t('cases.filterAll')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterTab,
                selectedFilter === 'active' && { backgroundColor: '#2196F3' },
                selectedFilter !== 'active' && { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' },
              ]}
              onPress={() => setSelectedFilter('active')}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === 'active' ? { color: '#fff' } : { color: theme.colors.text },
                ]}
              >
                {t('cases.filterActive')}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterTab,
                selectedFilter === 'action-required' && { backgroundColor: '#2196F3' },
                selectedFilter !== 'action-required' && { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' },
              ]}
              onPress={() => setSelectedFilter('action-required')}
            >
              <Text
                style={[
                  styles.filterText,
                  selectedFilter === 'action-required' ? { color: '#fff' } : { color: theme.colors.text },
                ]}
              >
                {t('cases.filterActionRequired')}
              </Text>
            </Pressable>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Pressable 
              style={[styles.actionButton, { backgroundColor: theme.dark ? '#1C1C1E' : '#E3F2FD' }]}
              onPress={() => router.push('/documents/upload')}
            >
              <IconSymbol name="doc.fill" size={24} color="#2196F3" />
              <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>{t('documents.upload')}</Text>
            </Pressable>
            <Pressable 
              style={[styles.actionButton, { backgroundColor: theme.dark ? '#1C1C1E' : '#E3F2FD' }]}
              onPress={() => console.log('Templates pressed')}
            >
              <IconSymbol name="arrow.down.doc.fill" size={24} color="#2196F3" />
              <Text style={[styles.actionButtonText, { color: '#2196F3' }]}>{t('documents.downloadTemplates')}</Text>
            </Pressable>
          </View>

          {/* Loading State */}
          {isLoading && cases.length === 0 && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#2196F3" />
            </View>
          )}

          {/* Error State */}
          {error && (
            <View style={styles.errorContainer}>
              <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
            </View>
          )}

          {/* Cases List */}
          {getFilteredCases().length === 0 && !isLoading && (
            <View style={styles.emptyContainer}>
              <IconSymbol name="folder.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
              <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('cases.noCases')}
              </Text>
            </View>
          )}

          {getFilteredCases().map((caseItem) => (
            <Pressable
              key={caseItem.id}
              style={[styles.caseCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => router.push({
                pathname: '/chat',
                params: { id: caseItem.id, caseId: caseItem.id }
              })}
              onLongPress={() => router.push({ pathname: '/case/[id]', params: { id: caseItem.id } })}
            >
              <View style={styles.caseHeader}>
                <View style={styles.caseHeaderLeft}>
                  <Text style={[styles.caseTitle, { color: theme.colors.text }]}>
                    {caseItem.title}
                  </Text>
                  <Text style={[styles.caseNumber, { color: theme.dark ? '#98989D' : '#666' }]}>
                    {caseItem.caseNumber}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: getStatusColor(caseItem.status) + '20' },
                  ]}
                >
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: getStatusColor(caseItem.status) },
                    ]}
                  />
                  <Text
                    style={[
                      styles.statusText,
                      { color: getStatusColor(caseItem.status) },
                    ]}
                  >
                    {getStatusLabel(caseItem.status)}
                  </Text>
                </View>
              </View>

              <View style={styles.progressContainer}>
                <View style={styles.progressHeader}>
                  <Text style={[styles.progressLabel, { color: theme.dark ? '#98989D' : '#666' }]}>
                    Case Progress
                  </Text>
                  <Text style={[styles.progressPercentage, { color: theme.colors.text }]}>
                    {caseItem.progress}%
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${caseItem.progress}%`,
                        backgroundColor: getStatusColor(caseItem.status),
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.lastUpdated, { color: theme.dark ? '#98989D' : '#666' }]}>
                  Last updated: {caseItem.lastUpdated}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>

        {/* Floating Action Button */}
        <Pressable 
          style={styles.fab}
          onPress={() => router.push('/cases/new')}
        >
          <IconSymbol name="plus" size={28} color="#fff" />
        </Pressable>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  scrollContentWithTabBar: {
    paddingBottom: 100,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  caseCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  caseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  caseHeaderLeft: {
    flex: 1,
  },
  caseTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  caseNumber: {
    fontSize: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressContainer: {
    gap: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 14,
  },
  progressPercentage: {
    fontSize: 14,
    fontWeight: '700',
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  lastUpdated: {
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 120,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorContainer: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 12,
    backgroundColor: '#FFEBEE',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    paddingVertical: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
  },
});
