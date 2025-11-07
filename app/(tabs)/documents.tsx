
import React, { useEffect, useState, useMemo, useCallback } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, RefreshControl, TextInput } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { templatesService, Template } from "@/lib/services/templatesService";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Linking } from "react-native";
import { logger } from "@/lib/utils/logger";

type DocumentFilter = 'all' | 'pdf' | 'doc' | 'image';
type DocumentStatus = 'all' | 'pending' | 'approved' | 'rejected';
type ActiveTab = 'documents' | 'templates' | 'downloads';

interface DownloadRecord {
  id: string;
  name: string;
  url: string;
  downloadedAt: string;
}

const DOWNLOADS_STORAGE_KEY = 'pt_download_history';

const formatDocumentType = (docType?: string) => (docType ? docType.toLowerCase() : 'other');
const formatFileSize = (size?: number) => {
  if (!size || size <= 0) {
    return '—';
  }
  if (size < 1024) {
    return `${size} B`;
  }
  const kb = size / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

const formatDisplayDate = (date?: string) => {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString();
};

const formatDownloadDate = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString();
};

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

const withOpacity = (hex: string, opacity: number) => {
  const sanitized = hex.replace('#', '');
  if (sanitized.length !== 6) {
    return hex;
  }
  const r = parseInt(sanitized.substring(0, 2), 16);
  const g = parseInt(sanitized.substring(2, 4), 16);
  const b = parseInt(sanitized.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export default function DocumentsScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { documents, isLoading, error, fetchDocuments, clearError } = useDocumentsStore();
  const { cases } = useCasesStore();

  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<DocumentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('all');
  const [showFilters, setShowFilters] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    if (activeTab !== 'documents') {
      setDebouncedSearch('');
      return;
    }
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  const buildFilters = useCallback(() => {
    const filters: { caseId?: string; type?: string; status?: string; search?: string } = {};
    if (selectedCase !== 'all') {
      filters.caseId = selectedCase;
    }
    if (typeFilter !== 'all') {
      filters.type = typeFilter.toUpperCase();
    }
    if (statusFilter !== 'all') {
      filters.status = statusFilter.toUpperCase();
    }
    if (debouncedSearch) {
      filters.search = debouncedSearch;
    }
    return filters;
  }, [selectedCase, typeFilter, statusFilter, debouncedSearch]);

  useEffect(() => {
    if (activeTab === 'documents') {
      fetchDocuments(buildFilters());
    }
  }, [fetchDocuments, buildFilters, activeTab]);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true);
      const data = await templatesService.getTemplates();
      setTemplates(data);
    } catch (e: any) {
      logger.error('Failed to load templates', e);
      showAlert({
        title: t('documents.templatesErrorTitle', { defaultValue: 'Unable to load templates' }),
        message: e?.message || t('documents.templatesErrorMessage', { defaultValue: 'Please try again later.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    } finally {
      setTemplatesLoading(false);
    }
  }, [showAlert, t]);

  const persistDownloads = useCallback(async (items: DownloadRecord[]) => {
    try {
      await AsyncStorage.setItem(DOWNLOADS_STORAGE_KEY, JSON.stringify(items));
    } catch (persistError) {
      logger.warn('Failed to persist downloads', persistError);
    }
  }, []);

  const loadDownloads = useCallback(async () => {
    try {
      setDownloadsLoading(true);
      const stored = await AsyncStorage.getItem(DOWNLOADS_STORAGE_KEY);
      if (stored) {
        setDownloads(JSON.parse(stored));
      } else {
        setDownloads([]);
      }
    } catch (storageError) {
      logger.warn('Unable to load downloads from storage', storageError);
      setDownloads([]);
    } finally {
      setDownloadsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'templates' && !templatesLoading && templates.length === 0) {
      loadTemplates();
    }
  }, [activeTab, loadTemplates, templates.length, templatesLoading]);

  useEffect(() => {
    if (activeTab === 'downloads') {
      loadDownloads();
    }
  }, [activeTab, loadDownloads]);

  const handleTemplateDownload = useCallback(async (template: Template) => {
    try {
      await templatesService.downloadTemplate(template);
      const record: DownloadRecord = {
        id: template.id,
        name: template.name,
        url: template.downloadUrl,
        downloadedAt: new Date().toISOString(),
      };
      setDownloads((prev) => {
        const updated = [record, ...prev.filter((item) => item.id !== record.id)];
        persistDownloads(updated);
        return updated;
      });
    } catch (e: any) {
      showAlert({
        title: t('documents.downloadFailedTitle', { defaultValue: 'Download failed' }),
        message: e?.message || t('documents.downloadFailedMessage', { defaultValue: 'Unable to download this template.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    }
  }, [persistDownloads, showAlert, t]);

  const handleDownloadOpen = useCallback(async (item: DownloadRecord) => {
    try {
      const canOpen = await Linking.canOpenURL(item.url);
      if (canOpen) {
        await Linking.openURL(item.url);
      } else {
        showAlert({
          title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
          message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This download cannot be opened on your device.' }),
          actions: [{ text: t('common.close'), variant: 'primary' }],
        });
      }
    } catch (error) {
      logger.error('Failed to open downloaded file', error);
      showAlert({
        title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
        message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This download cannot be opened on your device.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    }
  }, [showAlert, t]);

  const filteredTemplates = useMemo(() => {
    const query = templateSearch.trim().toLowerCase();
    if (!query) {
      return templates;
    }
    return templates.filter((template) => {
      const haystacks = [
        template.name,
        template.description || '',
        template.category || '',
        template.fileType || '',
      ].map((value) => value.toLowerCase());
      return haystacks.some((value) => value.includes(query));
    });
  }, [templates, templateSearch]);

  const sortedDownloads = useMemo(() => {
    return [...downloads].sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
  }, [downloads]);

  const handleRefresh = useCallback(() => {
    if (activeTab === 'documents') {
      return fetchDocuments(buildFilters());
    }
    if (activeTab === 'templates') {
      return loadTemplates();
    }
    return loadDownloads();
  }, [activeTab, fetchDocuments, buildFilters, loadTemplates, loadDownloads]);

  const handleUploadNavigation = useCallback(() => {
    if (!cases || cases.length === 0) {
      showAlert({
        title: t('documents.noCaseTitle', { defaultValue: 'No case available' }),
        message: t('documents.noCaseMessage', { defaultValue: 'Create a case before uploading documents.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
      return;
    }
    router.push('/documents/upload');
  }, [cases, router, showAlert, t]);

  const handleTemplateNavigation = useCallback(() => {
    setActiveTab('templates');
  }, []);

  const activeSearchValue = activeTab === 'documents' ? searchQuery : templateSearch;
  const onSearchChange = activeTab === 'documents' ? setSearchQuery : setTemplateSearch;
  const showSearch = activeTab !== 'downloads';

  const refreshing = activeTab === 'documents' ? isLoading : activeTab === 'templates' ? templatesLoading : downloadsLoading;

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
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>{t('documents.title')}</Text>
          <Pressable onPress={() => setShowFilters(!showFilters)}>
            <IconSymbol name={showFilters ? 'xmark' : 'slider.horizontal.3'} size={24} color={theme.colors.text} />
          </Pressable>
        </View>

        <View style={[styles.tabBar, { backgroundColor: theme.dark ? '#1C1C1E' : '#F1F3F5' }]}>
          {(['documents', 'templates', 'downloads'] as ActiveTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>
                {tab === 'documents' && t('documents.tabs.documents', { defaultValue: 'Documents' })}
                {tab === 'templates' && t('documents.tabs.templates', { defaultValue: 'Templates' })}
                {tab === 'downloads' && t('documents.tabs.downloads', { defaultValue: 'Downloads' })}
              </Text>
            </Pressable>
          ))}
        </View>

        {showSearch && (
          <View style={[styles.searchContainer, { backgroundColor: theme.dark ? '#1C1C1E' : '#F5F5F5' }]}> 
            <IconSymbol name="magnifyingglass" size={20} color={theme.dark ? '#98989D' : '#666'} />
            <TextInput
              style={[styles.searchInput, { color: theme.colors.text }]}
              placeholder={activeTab === 'documents' ? t('documents.searchPlaceholder') : t('documents.searchTemplates', { defaultValue: 'Search templates...' })}
              placeholderTextColor={theme.dark ? '#98989D' : '#666'}
              value={activeSearchValue}
              onChangeText={onSearchChange}
            />
            {activeSearchValue.length > 0 && (
              <Pressable onPress={() => onSearchChange('')}>
                <IconSymbol name="xmark.circle.fill" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>
            )}
          </View>
        )}

        {activeTab === 'documents' && showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}> 
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>{t('documents.filterByCase')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <Pressable
                  style={[styles.filterChip, selectedCase === 'all' && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                  onPress={() => setSelectedCase('all')}
                >
                  <Text style={[styles.filterChipText, selectedCase === 'all' && styles.filterChipTextActive]}>{t('documents.allCases')}</Text>
                </Pressable>
                {cases.map((caseItem) => (
                  <Pressable
                    key={caseItem.id}
                    style={[styles.filterChip, selectedCase === caseItem.id && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                    onPress={() => setSelectedCase(caseItem.id)}
                  >
                    <Text style={[styles.filterChipText, selectedCase === caseItem.id && styles.filterChipTextActive]} numberOfLines={1}>
                      {caseItem.referenceNumber}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>{t('documents.filterByType')}</Text>
              <View style={styles.filterRow}>
                {(['all', 'pdf', 'doc', 'image'] as DocumentFilter[]).map((type) => (
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

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: theme.colors.text }]}>{t('documents.filterByStatus')}</Text>
              <View style={styles.filterRow}>
                {(['all', 'pending', 'approved', 'rejected'] as DocumentStatus[]).map((status) => (
                  <Pressable
                    key={status}
                    style={[styles.filterChip, statusFilter === status && styles.filterChipActive, { backgroundColor: theme.dark ? '#2C2C2E' : '#F5F5F5' }]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterChipText, statusFilter === status && styles.filterChipTextActive]}>
                      {t(`documents.status.${status}`, { defaultValue: status.toUpperCase() })}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, Platform.OS !== 'ios' && styles.scrollContentWithTabBar]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {activeTab === 'documents' && (
            <>
              <Pressable
                style={[styles.uploadCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#E3F2FD' }]}
                onPress={handleUploadNavigation}
              >
                <View style={[styles.uploadIcon, { backgroundColor: '#2196F3' }]}> 
                  <IconSymbol name="arrow.up.doc.fill" size={32} color="#fff" />
                </View>
                <View style={styles.uploadContent}>
                  <Text style={[styles.uploadTitle, { color: theme.colors.text }]}> {t('documents.uploadNewDocument')} </Text>
                  <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}> {t('documents.addFilesToCase')} </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              <Pressable
                style={[styles.uploadCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#FFF3E0' }]}
                onPress={handleTemplateNavigation}
              >
                <View style={[styles.uploadIcon, { backgroundColor: '#FF9800' }]}> 
                  <IconSymbol name="arrow.down.doc.fill" size={32} color="#fff" />
                </View>
                <View style={styles.uploadContent}>
                  <Text style={[styles.uploadTitle, { color: theme.colors.text }]}> {t('documents.downloadTemplates')} </Text>
                  <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}> {t('documents.getRequiredTemplates')} </Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
              </Pressable>

              {isLoading && documents.length === 0 && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorText, { color: '#F44336' }]}>{error}</Text>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t('documents.myDocuments')}</Text>
                <Text style={[styles.documentCount, { color: theme.dark ? '#98989D' : '#666' }]}> 
                  {documents.length} {documents.length === 1 ? t('documents.file') : t('documents.files')}
                </Text>
              </View>

              {documents.length === 0 && !isLoading && (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="doc.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
                  <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}> 
                    {searchQuery || selectedCase !== 'all' || typeFilter !== 'all' ? t('documents.noDocumentsMatch') : t('documents.noDocuments')}
                  </Text>
                </View>
              )}

              {documents.map((document) => {
                const documentType = formatDocumentType(document.documentType);
                const documentSize = formatFileSize(document.fileSize);
                const documentDate = formatDisplayDate(document.uploadDate);

                return (
                  <Pressable
                    key={document.id}
                    style={[styles.documentCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
                    onPress={async () => {
                      const targetUrl = document.filePath || document.url;
                      if (!targetUrl) {
                        return;
                      }
                      try {
                        const canOpen = await Linking.canOpenURL(targetUrl);
                        if (canOpen) {
                          await Linking.openURL(targetUrl);
                        } else {
                          showAlert({
                            title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
                            message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This document cannot be opened on your device.' }),
                            actions: [{ text: t('common.close'), variant: 'primary' }],
                          });
                        }
                      } catch (linkError) {
                        logger.error('Failed to open document', linkError);
                        showAlert({
                          title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
                          message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This document cannot be opened on your device.' }),
                          actions: [{ text: t('common.close'), variant: 'primary' }],
                        });
                      }
                    }}
                  >
                    <View style={[styles.documentIcon, { backgroundColor: withOpacity(getDocumentColor(documentType), 0.15) }]}> 
                      <IconSymbol
                        name={getDocumentIcon(documentType)}
                        size={24}
                        color={getDocumentColor(documentType)}
                      />
                    </View>

                    <View style={styles.documentContent}>
                      <Text style={[styles.documentName, { color: theme.colors.text }]} numberOfLines={1}>
                        {document.originalName}
                      </Text>
                      <View style={styles.documentMeta}>
                        <Text style={[styles.documentSize, { color: theme.dark ? '#98989D' : '#666' }]}> 
                          {documentSize}
                        </Text>
                        <Text style={[styles.documentDot, { color: theme.dark ? '#98989D' : '#666' }]}>•</Text>
                        <Text style={[styles.documentDate, { color: theme.dark ? '#98989D' : '#666' }]}>
                          {documentDate}
                        </Text>
                      </View>
                      {document.case?.referenceNumber ? (
                        <Text style={[styles.documentCaseRef, { color: theme.dark ? '#98989D' : '#666' }]}> 
                          {document.case.referenceNumber}
                        </Text>
                      ) : null}
                    </View>

                    <Pressable
                      style={styles.moreButton}
                      onPress={() => logger.info('Document options pressed', { documentId: document.id })}
                    >
                      <IconSymbol name="ellipsis" size={20} color={theme.dark ? '#98989D' : '#666'} />
                    </Pressable>
                  </Pressable>
                );
              })}
            </>
          )}

          {activeTab === 'templates' && (
            <>
              {templatesLoading && templates.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : filteredTemplates.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="doc.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
                  <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                    {t('documents.noTemplates', { defaultValue: 'No templates available right now.' })}
                  </Text>
                </View>
              ) : (
                filteredTemplates.map((template) => (
                  <Pressable
                    key={template.id}
                    style={[styles.templateCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
                    onPress={() => handleTemplateDownload(template)}
                    disabled={templatesLoading}
                  >
                    <View style={[styles.templateIcon, { backgroundColor: withOpacity('#2196F3', 0.15) }]}> 
                      <IconSymbol name="doc.fill" size={24} color="#2196F3" />
                    </View>
                    <View style={styles.templateContent}>
                      <Text style={[styles.templateName, { color: theme.colors.text }]}>{template.name}</Text>
                      {template.description ? (
                        <Text style={[styles.templateDescription, { color: theme.dark ? '#98989D' : '#666' }]}> 
                          {template.description}
                        </Text>
                      ) : null}
                    </View>
                    <IconSymbol name="arrow.down.circle.fill" size={24} color="#2196F3" />
                  </Pressable>
                ))
              )}
            </>
          )}

          {activeTab === 'downloads' && (
            <>
              {downloadsLoading && sortedDownloads.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#2196F3" />
                </View>
              ) : sortedDownloads.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="tray.and.arrow.down.fill" size={64} color={theme.dark ? '#98989D' : '#666'} />
                  <Text style={[styles.emptyText, { color: theme.dark ? '#98989D' : '#666' }]}>
                    {t('documents.noDownloads', { defaultValue: 'No downloads yet.' })}
                  </Text>
                </View>
              ) : (
                sortedDownloads.map((item) => (
                  <Pressable
                    key={`${item.id}-${item.downloadedAt}`}
                    style={[styles.downloadCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
                    onPress={() => handleDownloadOpen(item)}
                  >
                    <View style={[styles.downloadIcon, { backgroundColor: withOpacity('#4CAF50', 0.15) }]}> 
                      <IconSymbol name="arrow.down.circle.fill" size={20} color="#4CAF50" />
                    </View>
                    <View style={styles.downloadContent}>
                      <Text style={[styles.downloadName, { color: theme.colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={[styles.downloadMeta, { color: theme.dark ? '#98989D' : '#666' }]}> 
                        {t('documents.downloadedAt', { defaultValue: 'Downloaded at {{date}}', date: formatDownloadDate(item.downloadedAt) })}
                      </Text>
                    </View>
                    <IconSymbol name="chevron.right" size={18} color={theme.dark ? '#98989D' : '#666'} />
                  </Pressable>
                ))
              )}
            </>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#2196F3',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabButtonTextActive: {
    color: '#fff',
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
  documentCaseRef: {
    fontSize: 12,
    marginTop: 4,
  },
  moreButton: {
    padding: 8,
  },
  templateCard: {
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
  templateIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
  },
  downloadCard: {
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
  downloadIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  downloadContent: {
    flex: 1,
  },
  downloadName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  downloadMeta: {
    fontSize: 13,
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
    textAlign: 'center',
  },
});
