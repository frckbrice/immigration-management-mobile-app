
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, RefreshControl, TextInput, FlatList } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { useCasesStore } from "@/stores/cases/casesStore";
import { Linking } from "react-native";
import { useTranslation } from "@/lib/hooks/useTranslation";

type DocumentFilter = 'all' | 'pdf' | 'doc' | 'image';
type DocumentStatus = 'all' | 'pending' | 'approved' | 'rejected';
type SortOrder = 'newest' | 'oldest';

export default function DocumentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { documents, isLoading, error, fetchDocuments, clearError } = useDocumentsStore();
  const { cases } = useCasesStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<DocumentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Filter and sort documents
  const filteredDocuments = useMemo(() => {
    let filtered = [...documents];

    // Search filter
    if (debouncedSearch.trim()) {
      const query = debouncedSearch.toLowerCase();
      filtered = filtered.filter(doc => doc.name.toLowerCase().includes(query));
    }

    // Case filter
    if (selectedCase !== 'all') {
      filtered = filtered.filter(doc => doc.caseId === selectedCase);
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(doc => doc.type === typeFilter);
    }

    // Status filter (if status field exists)
    if (statusFilter !== 'all') {
      // Note: Assuming documents have a status field - adjust based on your API
      filtered = filtered.filter(doc => (doc as any).status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    return filtered;
  }, [documents, debouncedSearch, selectedCase, typeFilter, statusFilter, sortOrder]);

  const handleDocumentPress = useCallback(async (document: any) => {
    if (document.url) {
      try {
        const canOpen = await Linking.canOpenURL(document.url);
        if (canOpen) {
          await Linking.openURL(document.url);
        } else {
          console.log('Cannot open document URL');
        }
      } catch (error) {
        console.error('Error opening document', error);
      }
    }
  }, []);

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return 'doc.fill';
      case 'doc':
        return 'doc.text.fill';
      case 'image':
        return 'photo.fill';
      default:
        return 'doc.fill';
    }
  };

  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'pdf':
        return '#F44336';
      case 'doc':
        return '#2196F3';
      case 'image':
        return '#4CAF50';
      default:
        return '#9E9E9E';
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
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('documents.title')}</Text>
          <Pressable onPress={() => setShowFilters(!showFilters)}>
            <IconSymbol name={showFilters ? "xmark" : "slider.horizontal.3"} size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={[styles.searchContainer, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}>
          <IconSymbol name="magnifyingglass" size={20} color={theme.dark ? '#98989D' : '#666'} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder={t('documents.searchPlaceholder')}
            placeholderTextColor={theme.dark ? '#98989D' : '#666'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <IconSymbol name="xmark.circle.fill" size={20} color={theme.dark ? '#98989D' : '#666'} />
            </Pressable>
          )}
        </View>

        {/* Filters */}
        {showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}>
            {/* Case Filter */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>{t('documents.filterByCase')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <Pressable
                  style={[styles.filterChip, selectedCase === 'all' && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                  onPress={() => setSelectedCase('all')}
                >
                  <Text style={[styles.filterChipText, selectedCase === 'all' && styles.filterChipTextActive]}>{t('documents.allCases')}</Text>
                </Pressable>
                {cases.map(caseItem => (
                  <Pressable
                    key={caseItem.id}
                    style={[styles.filterChip, selectedCase === caseItem.id && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                    onPress={() => setSelectedCase(caseItem.id)}
                  >
                    <Text style={[styles.filterChipText, selectedCase === caseItem.id && styles.filterChipTextActive]} numberOfLines={1}>
                      {caseItem.caseNumber}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Type Filter */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>{t('documents.filterByType')}</Text>
              <View style={styles.filterRow}>
                {(['all', 'pdf', 'doc', 'image'] as DocumentFilter[]).map(type => (
                  <Pressable
                    key={type}
                    style={[styles.filterChip, typeFilter === type && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                    onPress={() => setTypeFilter(type)}
                  >
                    <Text style={[styles.filterChipText, typeFilter === type && styles.filterChipTextActive]}>
                      {type === 'all' ? t('documents.allTypes') : t(`documents.${type}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Sort */}
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>{t('documents.sortBy')}</Text>
              <View style={styles.filterRow}>
                <Pressable
                  style={[styles.filterChip, sortOrder === 'newest' && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                  onPress={() => setSortOrder('newest')}
                >
                  <Text style={[styles.filterChipText, sortOrder === 'newest' && styles.filterChipTextActive]}>{t('documents.newest')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterChip, sortOrder === 'oldest' && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                  onPress={() => setSortOrder('oldest')}
                >
                  <Text style={[styles.filterChipText, sortOrder === 'oldest' && styles.filterChipTextActive]}>{t('documents.oldest')}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={fetchDocuments} />
          }
        >
          {/* Upload Section */}
          <Pressable
            style={[styles.uploadCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#E3F2FD' }]}
            onPress={() => router.push('/documents/upload')}
          >
            <View style={[styles.uploadIcon, { backgroundColor: '#2196F3' }]}>
              <IconSymbol name="arrow.up.doc.fill" size={32} color="#fff" />
            </View>
            <View style={styles.uploadContent}>
              <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>
                {t('documents.uploadNewDocument')}
              </Text>
              <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('documents.addFilesToCase')}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </Pressable>

          {/* Templates Section */}
          <Pressable
            style={[styles.uploadCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#FFF3E0' }]}
            onPress={() => console.log('Templates pressed')}
          >
            <View style={[styles.uploadIcon, { backgroundColor: '#FF9800' }]}>
              <IconSymbol name="arrow.down.doc.fill" size={32} color="#fff" />
            </View>
            <View style={styles.uploadContent}>
              <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>
                {t('documents.downloadTemplates')}
              </Text>
              <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('documents.getRequiredTemplates')}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </Pressable>

          {/* Loading State */}
          {isLoading && documents.length === 0 && (
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

          {/* Documents List */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              {t('documents.myDocuments')}
            </Text>
            <Text style={[styles.documentCount, { color: theme.dark ? '#98989D' : '#666' }]}>
              {filteredDocuments.length} {filteredDocuments.length === 1 ? t('documents.file') : t('documents.files')}
            </Text>
          </View>

          {filteredDocuments.length === 0 && !isLoading && (
            <View style={styles.emptyContainer}>
              <IconSymbol name="doc.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
              <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                {searchQuery || selectedCase !== 'all' || typeFilter !== 'all' ? t('documents.noDocumentsMatch') : t('documents.noDocuments')}
              </Text>
            </View>
          )}

          {filteredDocuments.map((document) => (
            <Pressable
              key={document.id}
              style={[styles.documentCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
              onPress={() => handleDocumentPress(document)}
            >
              <View style={[styles.documentIcon, { backgroundColor: getDocumentColor(document.type) + '20' }]}>
                <IconSymbol
                  name={getDocumentIcon(document.type)}
                  size={24}
                  color={getDocumentColor(document.type)}
                />
              </View>

              <View style={styles.documentContent}>
                <Text style={[styles.documentName, { color: theme.colors.text }]} numberOfLines={1}>
                  {document.name}
                </Text>
                <View style={styles.documentMeta}>
                  <Text style={[styles.documentSize, { color: theme.dark ? '#98989D' : '#666' }]}>
                    {document.size}
                  </Text>
                  <Text style={[styles.documentDot, { color: theme.dark ? '#98989D' : '#666' }]}>
                    •
                  </Text>
                  <Text style={[styles.documentDate, { color: theme.dark ? '#98989D' : '#666' }]}>
                    {document.date}
                  </Text>
                </View>
              </View>

              <Pressable
                style={styles.moreButton}
                onPress={() => console.log('More options pressed')}
              >
                <IconSymbol name="ellipsis" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>
            </Pressable>
          ))}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  filtersContainer: {
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterScroll: {
    flexDirection: 'row',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
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
  uploadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  uploadContent: {
    flex: 1,
  },
  uploadTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  uploadDescription: {
    fontSize: 14,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  documentCount: {
    fontSize: 14,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  documentContent: {
    flex: 1,
  },
  documentName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  documentMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  documentSize: {
    fontSize: 14,
  },
  documentDot: {
    fontSize: 14,
  },
  documentDate: {
    fontSize: 14,
  },
  moreButton: {
    padding: 8,
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
