
import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform, ActivityIndicator, RefreshControl, GestureResponderEvent, NativeSyntheticEvent, NativeScrollEvent, Alert } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter, useLocalSearchParams } from "expo-router";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useAuthStore } from "@/stores/auth/authStore";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useTranslation } from "@/lib/hooks/useTranslation";
import { templatesService, type Template } from "@/lib/services/templatesService";
import { documentsService } from "@/lib/services/documentsService";
import { Linking } from "react-native";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { logger } from "@/lib/utils/logger";
import { downloadHistoryService, DownloadHistoryRecord } from "@/lib/services/downloadHistoryService";
import { BackButton } from "@/components/BackButton";
import { useAppTheme, useThemeColors } from "@/lib/hooks/useAppTheme";
import { withOpacity } from "@/styles/theme";
import { useScrollContext } from "@/contexts/ScrollContext";
import SearchField from "@/components/SearchField";
import { palette } from "@/styles/colors";
import { useTemplatesStore } from "@/stores/templates/templatesStore";
import { useToast } from "@/components/Toast";

type DocumentFilter = 'all' | 'pdf' | 'doc' | 'image';
type DocumentStatus = 'all' | 'pending' | 'approved' | 'rejected';
type ActiveTab = 'documents' | 'templates' | 'downloads';

type DownloadRecord = DownloadHistoryRecord & {
  url?: string;
  fileType?: string;
  mimeType?: string;
};

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

const deriveTemplateFileType = (template: Template) => {
  const explicit = template.fileType?.toLowerCase();
  if (explicit && explicit.length <= 12) {
    return explicit;
  }

  const mimeExtension = template.mimeType?.split('/').pop()?.toLowerCase();
  if (mimeExtension && mimeExtension.length <= 12) {
    return mimeExtension;
  }

  const nameExtension = template.fileName?.split('.').pop()?.toLowerCase();
  if (nameExtension && nameExtension.length <= 12) {
    return nameExtension;
  }

  const urlExtension = template.downloadUrl?.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (urlExtension && urlExtension.length <= 12) {
    return urlExtension;
  }

  const fallbackUrlExtension = template.fileUrl?.split('?')[0]?.split('.').pop()?.toLowerCase();
  if (fallbackUrlExtension && fallbackUrlExtension.length <= 12) {
    return fallbackUrlExtension;
  }

  return undefined;
};

const getTemplateIconName = (template: Template) => {
  const type = deriveTemplateFileType(template) || '';
  if (type.includes('pdf')) return 'file-pdf-box';
  if (type.includes('doc') || type.includes('word') || type.includes('rtf')) return 'file-word-box';
  if (type.includes('xls') || type.includes('csv') || type.includes('sheet')) return 'file-excel-box';
  if (type.includes('ppt') || type.includes('key')) return 'file-powerpoint-box';
  if (['txt', 'text', 'md', 'markdown', 'json', 'xml'].includes(type)) return 'file-document-outline';
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'heic', 'svg', 'webp', 'tif', 'tiff'].includes(type)) return 'file-image';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(type)) return 'archive-outline';
  return 'file-document-outline';
};

const getTemplateAccentColor = (template: Template, colors: ReturnType<typeof useThemeColors>) => {
  const type = deriveTemplateFileType(template) || '';
  if (type.includes('pdf')) return colors.danger;
  if (type.includes('doc')) return colors.primary;
  if (type.includes('xls') || type.includes('csv')) return colors.success;
  if (type.includes('ppt')) return colors.warning;
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'heic', 'svg', 'webp'].includes(type)) return colors.accent;
  return colors.accent;
};

const getTemplateCategoryIcon = (category?: string) => {
  if (!category) return 'tag-outline';
  const normalized = category.toLowerCase();
  if (normalized.includes('tax')) return 'file-chart';
  if (normalized.includes('finance')) return 'chart-line';
  if (normalized.includes('legal')) return 'scale-balance';
  if (normalized.includes('identity')) return 'card-account-details-outline';
  if (normalized.includes('medical') || normalized.includes('health')) return 'medical-bag';
  if (normalized.includes('employment')) return 'briefcase-outline';
  return 'tag-outline';
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

export default function DocumentsScreen() {
  const theme = useAppTheme();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const { showToast } = useToast();
  const { documents, isLoading, error, fetchDocuments, clearError, clearCache } = useDocumentsStore();
  const { cases } = useCasesStore();
  const { user } = useAuthStore();
  const { setScrollDirection, setAtBottom } = useScrollContext();

  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');
  const [searchQuery, setSearchQuery] = useState('');
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedCase, setSelectedCase] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<DocumentFilter>('all');
  const [statusFilter, setStatusFilter] = useState<DocumentStatus>('all');
  const [showFilters, setShowFilters] = useState(false);

  const templates = useTemplatesStore((state) => state.templates);
  const templatesLoading = useTemplatesStore((state) => state.isLoading);
  const fetchTemplateList = useTemplatesStore((state) => state.fetchTemplates);
  const templatesError = useTemplatesStore((state) => state.error);
  const clearTemplatesError = useTemplatesStore((state) => state.clearError);
  const [isTemplatesRefreshing, setIsTemplatesRefreshing] = useState(false);
  const [activeTemplateDownloadId, setActiveTemplateDownloadId] = useState<string | null>(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);

  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [isRefreshingDocuments, setIsRefreshingDocuments] = useState(false);
  const lastScrollYRef = useRef(0);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        clearError();
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, clearError]);

  useEffect(() => {
    const tabParam = (params.tab || '').toString().toLowerCase();
    if (tabParam === 'templates') {
      setActiveTab('templates');
    } else if (tabParam === 'downloads') {
      setActiveTab('downloads');
    }
  }, [params.tab]);

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

  const loadDownloads = useCallback(async () => {
    try {
      setDownloadsLoading(true);
      const stored = await downloadHistoryService.getDownloads(user?.uid);
      setDownloads(stored);
    } catch (storageError) {
      logger.warn('Unable to load downloads from storage', storageError);
      setDownloads([]);
    } finally {
      setDownloadsLoading(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (activeTab !== 'templates') {
      if (templatesError) {
        clearTemplatesError();
      }
      return;
    }

    let cancelled = false;

    const ensureTemplates = async () => {
      try {
        await fetchTemplateList();
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        logger.error('Failed to fetch templates', error);

        if (!templates.length) {
          showAlert({
            title: t('documents.templatesErrorTitle', { defaultValue: 'Unable to load templates' }),
            message: error?.message || t('documents.templatesErrorMessage', { defaultValue: 'Please try again later.' }),
            actions: [{ text: t('common.close'), variant: 'primary' }],
          });
        }
      }
    };

    ensureTemplates();

    return () => {
      cancelled = true;
    };
  }, [activeTab, fetchTemplateList, templates.length, clearTemplatesError, templatesError, showAlert, t]);

  useEffect(() => {
    if (activeTab === 'downloads') {
      loadDownloads();
    }
  }, [activeTab, loadDownloads]);

  useEffect(() => {
    if (!user?.uid) {
      setDownloads([]);
      clearCache();
    }
  }, [user?.uid, clearCache]);

  const handleTemplatePreview = useCallback(async (template: Template) => {
    try {
      const remoteUrl = templatesService.getTemplateDownloadUrl(template);
      const canOpen = await Linking.canOpenURL(remoteUrl);

      if (!canOpen) {
        showAlert({
          title: t('documents.previewUnavailableTitle', { defaultValue: 'Preview unavailable' }),
          message: t('documents.previewUnavailableMessage', { defaultValue: 'We could not open this template. Please download it instead.' }),
          actions: [{ text: t('common.close'), variant: 'primary' }],
        });
        return;
      }

      await Linking.openURL(remoteUrl);
    } catch (error: any) {
      logger.error('Failed to open template preview', error);
      showAlert({
        title: t('documents.previewUnavailableTitle', { defaultValue: 'Preview unavailable' }),
        message: error?.message || t('documents.previewUnavailableMessage', { defaultValue: 'We could not open this template. Please download it instead.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    }
  }, [showAlert, t]);

  const sanitizeDownloadName = useCallback((name: string, extension?: string) => {
    const base = name.trim().replace(/[^\w.-]+/g, '_').replace(/_{2,}/g, '_') || 'template';
    if (!extension) {
      return base;
    }
    const cleanedExtension = extension.replace(/^\./, '');
    return cleanedExtension ? `${base}.${cleanedExtension}` : base;
  }, []);

  const triggerWebDownload = useCallback(async (uri: string | null | undefined, fileName: string) => {
    if (Platform.OS !== 'web' || !uri || typeof window === 'undefined') {
      return;
    }

    try {
      const response = await fetch(uri);
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = blobUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      logger.warn('Web template download failed', { uri, error });
    }
  }, []);

  const handleTemplateDownload = useCallback(async (template: Template) => {
    setActiveTemplateDownloadId(template.id);
    try {
      const download = await templatesService.downloadTemplate(template);
      const stored = await downloadHistoryService.addDownload({
        name: template.name,
        url: download.remoteUrl,
        localUri: download.localUri,
        fileSize: download.fileSize,
        fileType: template.fileType,
        mimeType: download.mimeType,
        source: 'template',
        sourceId: template.id,
      }, user?.uid);
      setDownloads((prev) => [stored, ...prev.filter((item) => item.id !== stored.id)]);

      const inferredExtension =
        template.fileType && !template.fileType.includes('/')
          ? template.fileType
          : download.mimeType?.split('/').pop();
      const preferredFileName =
        download.fileName ||
        template.fileName ||
        sanitizeDownloadName(template.name, inferredExtension || 'pdf');

      if (Platform.OS === 'web') {
        await triggerWebDownload(download.remoteUrl || download.localUri, preferredFileName);
      }

      showToast({
        title: t('documents.downloadSuccessTitle', { defaultValue: 'Template downloaded' }),
        message: t('documents.downloadSuccessMessage', {
          defaultValue: 'You can find this template in the Downloads section.',
        }),
        type: 'success',
      });
    } catch (e: any) {
      showAlert({
        title: t('documents.downloadFailedTitle', { defaultValue: 'Download failed' }),
        message: e?.message || t('documents.downloadFailedMessage', { defaultValue: 'Unable to download this template.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    } finally {
      setActiveTemplateDownloadId(null);
    }
  }, [sanitizeDownloadName, showAlert, showToast, t, triggerWebDownload]);

  const handleDownloadOpen = useCallback(async (item: DownloadRecord) => {
    try {
      const candidateUris: string[] = [];

      if (item.localUri) {
        if (Platform.OS === 'android') {
          try {
            const contentUri = await FileSystem.getContentUriAsync(item.localUri);
            candidateUris.push(contentUri);
          } catch (uriError) {
            logger.warn('Failed to resolve content URI for download', { downloadId: item.id, error: uriError });
            candidateUris.push(item.localUri);
          }
        } else {
          candidateUris.push(item.localUri);
        }
      }

      const remoteUrl = item.url;
      if (remoteUrl) {
        candidateUris.push(remoteUrl);
      }

      for (const uri of candidateUris) {
        if (!uri) continue;
        const canOpen = await Linking.canOpenURL(uri);
        if (canOpen) {
          await Linking.openURL(uri);
          return;
        }
      }

      showAlert({
        title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
        message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This download cannot be opened on your device.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    } catch (error) {
      logger.error('Failed to open downloaded file', error);
      showAlert({
        title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
        message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This download cannot be opened on your device.' }),
        actions: [{ text: t('common.close'), variant: 'primary' }],
      });
    }
  }, [showAlert, t]);

  const handleDownloadShare = useCallback(async (item: DownloadRecord) => {
    try {
      if (!item.localUri) {
        showAlert({
          title: t('documents.shareUnavailableTitle', { defaultValue: 'Share unavailable' }),
          message: t('documents.shareUnavailableMessage', { defaultValue: 'We could not access the downloaded file on this device. Try downloading again.' }),
          actions: [{ text: t('common.close'), variant: 'primary' }],
        });
        return;
      }

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showAlert({
          title: t('documents.shareUnavailableTitle', { defaultValue: 'Share unavailable' }),
          message: t('documents.shareUnsupportedMessage', { defaultValue: 'Sharing is not supported on this device.' }),
          actions: [{ text: t('common.close'), variant: 'primary' }],
        });
        return;
      }

      await Sharing.shareAsync(item.localUri, {
        mimeType: item.mimeType,
        dialogTitle: item.name,
      });
    } catch (error: any) {
      logger.error('Failed to share downloaded file', error);
      showAlert({
        title: t('documents.shareFailedTitle', { defaultValue: 'Share failed' }),
        message: error?.message || t('documents.shareFailedMessage', { defaultValue: 'Unable to share this file right now.' }),
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

  const handleDownloadDelete = useCallback(
    async (item: DownloadRecord) => {
      try {
        await downloadHistoryService.removeDownload(item.id, user?.uid);
        setDownloads((prev) => prev.filter((entry) => entry.id !== item.id));
        showToast({
          message: t('documents.downloadRemovedMessage', { defaultValue: 'Removed from Downloads.' }),
          type: 'success',
        });
      } catch (error: any) {
        logger.error('Failed to remove download', { id: item.id, error });
        showAlert({
          title: t('documents.downloadRemoveFailedTitle', { defaultValue: 'Delete failed' }),
          message:
            error?.message ||
            t('documents.downloadRemoveFailedMessage', { defaultValue: 'Unable to remove this download.' }),
          actions: [{ text: t('common.close'), variant: 'primary' }],
        });
      }
    },
    [showAlert, showToast, t],
  );

  const handleRefresh = useCallback(() => {
    if (activeTab === 'documents') {
      setIsRefreshingDocuments(true);
      return fetchDocuments(buildFilters(), { force: true }).finally(() => {
        setIsRefreshingDocuments(false);
      });
    }
    if (activeTab === 'templates') {
      setIsTemplatesRefreshing(true);
      return fetchTemplateList({ force: true })
        .catch((error: any) => {
          logger.error('Template refresh failed', error);
          showAlert({
            title: t('documents.templatesErrorTitle', { defaultValue: 'Unable to load templates' }),
            message: error?.message || t('documents.templatesErrorMessage', { defaultValue: 'Please try again later.' }),
            actions: [{ text: t('common.close'), variant: 'primary' }],
          });
        })
        .finally(() => {
          setIsTemplatesRefreshing(false);
        });
    }
    return loadDownloads();
  }, [activeTab, fetchDocuments, buildFilters, fetchTemplateList, loadDownloads, showAlert, t]);

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

  useEffect(() => {
    if (activeTab !== 'documents' && isRefreshingDocuments) {
      setIsRefreshingDocuments(false);
    }
  }, [activeTab, isRefreshingDocuments]);

  const refreshing =
    activeTab === 'documents'
      ? isRefreshingDocuments
      : activeTab === 'templates'
        ? isTemplatesRefreshing
        : downloadsLoading;
  const surfaceCard = theme.dark ? "#111827" : colors.surface;
  const chipBackground = theme.dark ? colors.surfaceAlt : colors.surfaceAlt;
  const chipActiveBackground = withOpacity(colors.primary, theme.dark ? 0.55 : 0.2);
  const documentTypeColors = useMemo(
    () => ({
      pdf: colors.danger,
      doc: colors.primary,
      image: colors.success,
      default: colors.accent,
    }),
    [colors.accent, colors.danger, colors.primary, colors.success],
  );
  const headerSubtitleText = t('documents.subtitle', {
    defaultValue: 'Manage, upload, and download the files tied to your cases.',
  });
  const showDocumentsLoader = isLoading && documents.length === 0 && !isRefreshingDocuments;

  const handleBackPress = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.push('/(tabs)/(home)');
  }, [router]);

  useEffect(() => {
    setAtBottom(true);
    setScrollDirection(false);
  }, [setAtBottom, setScrollDirection]);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {Platform.OS === 'ios' && (
        <Stack.Screen
          options={{
            headerShown: false,
          }}
        />
      )}
      <SafeAreaView style={[styles.container, { backgroundColor: theme.dark ? "#1f2937" : colors.background }]} edges={['top']}>
        <View style={styles.header}>
          <BackButton onPress={handleBackPress} />
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('documents.title')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.muted }]} numberOfLines={2}>
              {headerSubtitleText}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowFilters(!showFilters)}
            style={[
              styles.headerAction,
              {
                backgroundColor: withOpacity(colors.primary, theme.dark ? 0.22 : 0.12),
              },
            ]}
          >
            <IconSymbol name={showFilters ? 'xmark' : 'slider.horizontal.3'} size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={[styles.tabBar, { backgroundColor: surfaceCard }]}>
          {(['documents', 'templates', 'downloads'] as ActiveTab[]).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.tabButton,
                activeTab === tab
                  ? {
                    backgroundColor: colors.primary,
                    shadowColor: withOpacity(colors.primary, theme.dark ? 0.45 : 0.25),
                  }
                  : {
                    backgroundColor: withOpacity(colors.text, theme.dark ? 0.12 : 0.05),
                  },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabButtonText,
                  { color: colors.muted },
                  activeTab === tab && { color: colors.onPrimary },
                ]}
              >
                {tab === 'documents' && t('documents.tabs.documents', { defaultValue: 'Documents' })}
                {tab === 'templates' && t('documents.tabs.templates', { defaultValue: 'Templates' })}
                {tab === 'downloads' && t('documents.tabs.downloads', { defaultValue: 'Downloads' })}
              </Text>
            </Pressable>
          ))}
        </View>

        {showSearch && (
          <SearchField
              value={activeSearchValue}
              onChangeText={onSearchChange}
            onClear={() => onSearchChange('')}
            placeholder={
              activeTab === 'documents'
                ? t('documents.searchPlaceholder')
                : t('documents.searchTemplates', { defaultValue: 'Search templates...' })
            }
            containerStyle={styles.searchField}
            returnKeyType="search"
          />
        )}

        {activeTab === 'documents' && showFilters && (
          <View style={[styles.filtersContainer, { backgroundColor: surfaceCard }]}>
            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>{t('documents.filterByCase')}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
                <Pressable
                  style={[
                    styles.filterChip,
                    { backgroundColor: chipBackground },
                    selectedCase === 'all' && { backgroundColor: chipActiveBackground },
                  ]}
                  onPress={() => setSelectedCase('all')}
                >
                  <Text
                    style={[
                      styles.filterChipText,
                      { color: colors.muted },
                      selectedCase === 'all' && { color: colors.primary },
                    ]}
                  >
                    {t('documents.allCases')}
                  </Text>
                </Pressable>
                {cases.map((caseItem) => (
                  <Pressable
                    key={caseItem.id}
                    style={[
                      styles.filterChip,
                      { backgroundColor: chipBackground },
                      selectedCase === caseItem.id && { backgroundColor: chipActiveBackground },
                    ]}
                    onPress={() => setSelectedCase(caseItem.id)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: colors.muted },
                        selectedCase === caseItem.id && { color: colors.primary },
                      ]}
                      numberOfLines={1}
                    >
                      {caseItem.referenceNumber}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>{t('documents.filterByType')}</Text>
              <View style={styles.filterRow}>
                {(['all', 'pdf', 'doc', 'image'] as DocumentFilter[]).map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.filterChip,
                      { backgroundColor: chipBackground },
                      typeFilter === type && { backgroundColor: chipActiveBackground },
                    ]}
                    onPress={() => setTypeFilter(type)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: colors.muted },
                        typeFilter === type && { color: colors.primary },
                      ]}
                    >
                      {type === 'all' ? t('documents.allTypes') : t(`documents.${type}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text style={[styles.filterLabel, { color: colors.text }]}>{t('documents.filterByStatus')}</Text>
              <View style={styles.filterRow}>
                {(['all', 'pending', 'approved', 'rejected'] as DocumentStatus[]).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.filterChip,
                      { backgroundColor: chipBackground },
                      statusFilter === status && { backgroundColor: chipActiveBackground },
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text
                      style={[
                        styles.filterChipText,
                        { color: colors.muted },
                        statusFilter === status && { color: colors.primary },
                      ]}
                    >
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
          contentContainerStyle={[
            styles.scrollContent,
            Platform.OS !== 'ios' && styles.scrollContentWithTabBar,
            { paddingBottom: insets.bottom + 160 },
          ]}
          showsVerticalScrollIndicator={false}
          onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
            if (scrollTimeoutRef.current) {
              clearTimeout(scrollTimeoutRef.current);
            }
            scrollTimeoutRef.current = setTimeout(() => {
              const currentY = contentOffset.y;
              const isAtBottom = currentY + layoutMeasurement.height >= contentSize.height - 50;
              setAtBottom(isAtBottom);
              const diff = currentY - lastScrollYRef.current;
              if (Math.abs(diff) > 5) {
                setScrollDirection(diff > 0);
                lastScrollYRef.current = currentY;
              }
            }, 50);
          }}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {activeTab === 'documents' && (
            <>
              <Pressable
                style={[
                  styles.uploadCard,
                  { backgroundColor: surfaceCard },
                ]}
                onPress={handleUploadNavigation}
              >
                <View style={[styles.uploadIcon, { backgroundColor: withOpacity(colors.primary, theme.dark ? 0.55 : 0.9) }]}>
                  <IconSymbol name="arrow.up.doc.fill" size={32} color={colors.onPrimary} />
                </View>
                <View style={styles.uploadContent}>
                  <Text style={[styles.uploadTitle, { color: colors.text }]}>{t('documents.uploadNewDocument')}</Text>
                  <Text style={[styles.uploadDescription, { color: colors.muted }]}>{t('documents.addFilesToCase')}</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </Pressable>

              <Pressable
                style={[
                  styles.uploadCard,
                  { backgroundColor: surfaceCard },
                ]}
                onPress={handleTemplateNavigation}
              >
                <View style={[styles.uploadIcon, { backgroundColor: withOpacity(colors.warning, theme.dark ? 0.55 : 0.9) }]}>
                  <IconSymbol name="arrow.down.doc.fill" size={32} color={colors.onPrimary} />
                </View>
                <View style={styles.uploadContent}>
                  <Text style={[styles.uploadTitle, { color: colors.text }]}>{t('documents.downloadTemplates')}</Text>
                  <Text style={[styles.uploadDescription, { color: colors.muted }]}>{t('documents.getRequiredTemplates')}</Text>
                </View>
                <IconSymbol name="chevron.right" size={20} color={colors.muted} />
              </Pressable>

              {showDocumentsLoader && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              )}

              {error && (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text>
                </View>
              )}

              <View style={styles.sectionHeader}>
                <Text style={[styles.sectionTitle, { color: colors.primary }]}>{t('documents.myDocuments')}</Text>
                <Text style={[styles.documentCount, { color: colors.muted }]}>
                  {documents.length} {documents.length === 1 ? t('documents.file') : t('documents.files')}
                </Text>
              </View>

              {documents.length === 0 && !isLoading && (
                <View style={styles.emptyContainer}>
                  <IconSymbol name="doc.fill" size={64} color={colors.muted} />
                  <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {searchQuery || selectedCase !== 'all' || typeFilter !== 'all' ? t('documents.noDocumentsMatch') : t('documents.noDocuments')}
                  </Text>
                </View>
              )}

              {documents.map((document) => {
                const documentType = formatDocumentType(document.documentType);
                const documentSize = formatFileSize(document.fileSize);
                const documentDate = formatDisplayDate(document.uploadDate);
                const typeColor = documentTypeColors[documentType as keyof typeof documentTypeColors] ?? documentTypeColors.default;
                const isDeleting = deletingDocumentId === document.id;

                return (
                  <Pressable
                    key={document.id}
                    style={[
                      styles.documentCard,
                      { backgroundColor: surfaceCard },
                      isDeleting && { opacity: 0.5 },
                    ]}
                    disabled={isDeleting}
                    onPress={async () => {
                      try {
                        let targetUrl: string | null = document.filePath || null;
                        if (!targetUrl) {
                          const downloaded = await documentsService.downloadDocument(document.id);
                          targetUrl = downloaded ?? null;
                        }

                        if (!targetUrl) {
                          showAlert({
                            title: t('documents.downloadOpenErrorTitle', { defaultValue: 'Unable to open file' }),
                            message: t('documents.downloadOpenErrorMessage', { defaultValue: 'This document cannot be opened on your device.' }),
                            actions: [{ text: t('common.close'), variant: 'primary' }],
                          });
                          return;
                        }

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
                    <View
                      style={[
                        styles.documentIcon,
                        {
                          backgroundColor: withOpacity(colors.surfaceAlt, theme.dark ? 0.3 : 1),
                          borderColor: withOpacity(typeColor, theme.dark ? 0.7 : 0.25),
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={
                          documentType === 'pdf'
                            ? 'file-pdf-box'
                            : documentType === 'doc'
                              ? 'file-word-box'
                              : documentType === 'image'
                                ? 'file-image'
                                : 'file-document'
                        }
                        size={26}
                        color={typeColor}
                      />
                    </View>

                    <View style={styles.documentContent}>
                      <Text style={[styles.documentName, { color: colors.text }]} numberOfLines={1}>
                        {document.originalName}
                      </Text>
                      <View style={styles.documentMeta}>
                        <Text style={[styles.documentSize, { color: colors.muted }]}>
                          {documentSize}
                        </Text>
                        <Text style={[styles.documentDot, { color: colors.muted }]}>•</Text>
                        <Text style={[styles.documentDate, { color: colors.muted }]}>
                          {documentDate}
                        </Text>
                      </View>
                      {document.case?.referenceNumber ? (
                        <Text style={[styles.documentCaseRef, { color: colors.muted }]}>
                          {document.case.referenceNumber}
                        </Text>
                      ) : null}
                    </View>

                    <View style={styles.documentActions}>
                      <Pressable
                        style={styles.downloadActionButton}
                        disabled={isDeleting}
                        onPress={async () => {
                          try {
                            const downloaded = await documentsService.downloadDocument(document.id);
                            if (downloaded) {
                              await Linking.openURL(downloaded);
                            }
                          } catch (downloadError) {
                            logger.error('Document download failed', downloadError);
                            showAlert({
                              title: t('documents.downloadFailedTitle', { defaultValue: 'Download failed' }),
                              message: t('documents.downloadFailedMessage', { defaultValue: 'Unable to download this document.' }),
                              actions: [{ text: t('common.close'), variant: 'primary' }],
                            });
                          }
                        }}
                      >
                        <MaterialCommunityIcons name="tray-arrow-down" size={20} color={colors.primary} />
                      </Pressable>
                      <Pressable
                        style={styles.downloadActionButton}
                        disabled={isDeleting}
                        onPress={async () => {
                          Alert.alert(
                            t('documents.deleteTitle', { defaultValue: 'Delete document?' }),
                            t('documents.deleteMessage', { defaultValue: 'Are you sure you want to delete this document?' }),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('common.delete'),
                                style: 'destructive',
                                onPress: async () => {
                                  if (deletingDocumentId) {
                                    return;
                                  }
                                  setDeletingDocumentId(document.id);
                                  try {
                                    await documentsService.deleteDocument(document.id);
                                    await fetchDocuments(buildFilters(), { force: true });
                                    showToast({
                                      title: t('common.success'),
                                      message: t('documents.deleteSuccess', { defaultValue: 'Document deleted successfully.' }),
                                      type: 'success',
                                    });
                                  } catch (deleteError: any) {
                                    logger.error('Delete document error', deleteError);
                                    showAlert({
                                      title: t('common.error'),
                                      message:
                                        deleteError?.message ||
                                        t('documents.deleteFailed', { defaultValue: 'Unable to delete this document.' }),
                                      actions: [{ text: t('common.close'), variant: 'primary' }],
                                    });
                                    showToast({
                                      title: t('common.error'),
                                      message:
                                        deleteError?.message ||
                                        t('documents.deleteFailed', { defaultValue: 'Unable to delete this document.' }),
                                      type: 'error',
                                    });
                                  } finally {
                                    setDeletingDocumentId(null);
                                  }
                                },
                              },
                            ],
                          );
                        }}
                      >
                        {isDeleting ? (
                          <ActivityIndicator size="small" color={colors.danger} />
                        ) : (
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
                        )}
                      </Pressable>
                    </View>
                  </Pressable>
                );
              })}
            </>
          )}

          {activeTab === 'templates' && (
            <>
              {templatesLoading && !isTemplatesRefreshing && templates.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : (
                <>
                  {templatesError && !templatesLoading && !isTemplatesRefreshing && (
                    <View style={styles.errorContainer}>
                      <Text style={[styles.errorText, { color: colors.danger }]}>{templatesError}</Text>
                    </View>
                  )}

                  {filteredTemplates.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <IconSymbol name="doc.fill" size={64} color={colors.muted} />
                        <Text style={[styles.emptyText, { color: colors.muted }]}>
                          {t('documents.noTemplates', { defaultValue: 'No templates available right now.' })}
                        </Text>
                      </View>
                    ) : (
                      filteredTemplates.map((template) => {
                        const isDownloadingTemplate = activeTemplateDownloadId === template.id;
                        const accentColor = getTemplateAccentColor(template, colors);
                        const iconName = getTemplateIconName(template);

                        return (
                          <Pressable
                            key={template.id}
                            onPress={() => handleTemplateDownload(template)}
                            disabled={isDownloadingTemplate}
                            style={[
                              styles.templateCard,
                              {
                                backgroundColor: surfaceCard,
                                borderColor: withOpacity(colors.borderStrong, theme.dark ? 0.35 : 0.16),
                                shadowColor: withOpacity(colors.text, theme.dark ? 0.7 : 0.8),
                                shadowOffset: { width: 0, height: theme.dark ? 14 : 8 },
                                shadowOpacity: theme.dark ? 0.45 : 0.18,
                                shadowRadius: 24,
                                elevation: 7,
                                opacity: isDownloadingTemplate ? 0.85 : 1,
                              },
                            ]}
                            android_ripple={{ color: withOpacity(colors.primary, 0.08) }}
                            accessibilityRole="button"
                            accessibilityHint={t('documents.tapToDownload', { defaultValue: 'Download template' })}
                          >
                            <View style={styles.templateHeader}>
                              <View
                                style={[
                                  styles.templateIconCircle,
                                  { backgroundColor: withOpacity(accentColor, theme.dark ? 0.32 : 0.12) },
                                ]}
                              >
                                <MaterialCommunityIcons name={iconName} size={26} color={accentColor} />
                              </View>

                              <View style={styles.templateHeaderContent}>
                                <Text style={[styles.templateName, { color: colors.text }]} numberOfLines={2}>
                                  {template.name}
                                </Text>
                                {template.description ? (
                                  <Text style={[styles.templateDescription, { color: colors.muted }]} numberOfLines={3}>
                                    {template.description}
                                  </Text>
                                ) : null}

                                <View style={styles.templateMetaRow}>
                                  {template.category ? (
                                    <View style={styles.templateMetaItem}>
                                      <MaterialCommunityIcons
                                        name={getTemplateCategoryIcon(template.category) as any}
                                        size={15}
                                        color={accentColor}
                                      />
                                      <Text style={[styles.templateMetaText, { color: colors.muted }]} numberOfLines={1}>
                                        {template.category}
                                      </Text>
                                    </View>
                                  ) : null}
                                  <View style={styles.templateMetaItem}>
                                    <MaterialCommunityIcons name="file-outline" size={15} color={accentColor} />
                                    <Text style={[styles.templateMetaText, { color: colors.muted }]} numberOfLines={1}>
                                      {(template.fileType || deriveTemplateFileType(template) || t('documents.types.other', { defaultValue: 'OTHER' })).toUpperCase()}
                                    </Text>
                                  </View>
                                  {template.fileSize ? (
                                    <View style={styles.templateMetaItem}>
                                      <MaterialCommunityIcons name="database-outline" size={15} color={accentColor} />
                                      <Text style={[styles.templateMetaText, { color: colors.muted }]} numberOfLines={1}>
                                        {formatFileSize(template.fileSize)}
                                      </Text>
                                    </View>
                                  ) : null}
                                </View>
                              </View>

                              <View style={styles.templateHeaderAside}>
                                {template.isRequired ? (
                                  <View
                                    style={[
                                      styles.templateRequiredBadge,
                                      { backgroundColor: withOpacity(colors.danger, theme.dark ? 0.32 : 0.18) },
                                    ]}
                                  >
                                    <Text style={[styles.templateRequiredText, { color: colors.danger }]}>
                                      {t('documents.requiredTemplate', { defaultValue: 'Required' })}
                                    </Text>
                                  </View>
                                ) : null}

                                {template.updatedAt ? (
                                  <Text style={[styles.templateUpdatedAt, { color: colors.muted }]}>
                                    {t('documents.updatedAt', {
                                      defaultValue: 'Updated {{date}}',
                                      date: formatDisplayDate(template.updatedAt),
                                    })}
                                  </Text>
                                ) : null}
                              </View>
                            </View>

                            <View style={styles.templateActionsRow}>
                              <Pressable
                                style={[styles.templatePrimaryButton, { backgroundColor: colors.primary }]}
                                onPress={(event) => {
                                  event.stopPropagation?.();
                                  handleTemplateDownload(template);
                                }}
                                disabled={isDownloadingTemplate}
                                accessibilityRole="button"
                                accessibilityHint={t('documents.tapToDownload', { defaultValue: 'Download template' })}
                              >
                                {isDownloadingTemplate ? (
                                  <ActivityIndicator size="small" color={colors.onPrimary} />
                                ) : (
                                  <MaterialCommunityIcons name="arrow-down-circle" size={20} color={colors.onPrimary} />
                                )}
                                <Text style={[styles.templatePrimaryButtonText, { color: colors.onPrimary }]}>
                                  {t('documents.downloadTemplate', { defaultValue: 'Download' })}
                                </Text>
                              </Pressable>

                              <Pressable
                                style={[
                                  styles.templateSecondaryButton,
                                  {
                                    borderColor: withOpacity(colors.primary, theme.dark ? 0.55 : 0.3),
                                    backgroundColor: withOpacity(colors.primary, theme.dark ? 0.15 : 0.08),
                                  },
                                ]}
                                onPress={(event) => {
                                  event.stopPropagation?.();
                                  handleTemplatePreview(template);
                                }}
                                accessibilityRole="button"
                                accessibilityHint={t('documents.previewTemplateHint', { defaultValue: 'Open template preview' })}
                              >
                                <MaterialCommunityIcons name="eye-outline" size={20} color={colors.primary} />
                                <Text style={[styles.templateSecondaryButtonText, { color: colors.primary }]}>
                                  {t('documents.previewTemplate', { defaultValue: 'Preview' })}
                                </Text>
                              </Pressable>
                            </View>
                          </Pressable>
                        );
                      })
                    )}
                  </>
              )}
            </>
          )}

          {activeTab === 'downloads' && (
            <>
              {downloadsLoading && sortedDownloads.length === 0 ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : sortedDownloads.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <IconSymbol name="tray.and.arrow.down.fill" size={64} color={colors.muted} />
                    <Text style={[styles.emptyText, { color: colors.muted }]}>
                    {t('documents.noDownloads', { defaultValue: 'No downloads yet.' })}
                  </Text>
                </View>
              ) : (
                sortedDownloads.map((item) => {
                  const typeLabel =
                    item.fileType?.toUpperCase() ||
                    (item.mimeType ? item.mimeType.split('/').pop()?.toUpperCase() : undefined);
                  const sizeLabel =
                    typeof item.fileSize === 'number'
                      ? formatFileSize(item.fileSize)
                      : undefined;
                  const metaPrimaryParts = [typeLabel, sizeLabel].filter(Boolean).join(' • ');

                  return (
                    <Pressable
                      key={`${item.id}-${item.downloadedAt}`}
                      style={[styles.downloadCard, { backgroundColor: surfaceCard }]}
                      onPress={() => handleDownloadOpen(item)}
                    >
                      <View style={[styles.downloadIcon, { backgroundColor: withOpacity(colors.success, theme.dark ? 0.25 : 0.12) }]}>
                        <IconSymbol name="arrow.down.circle.fill" size={20} color={colors.success} />
                      </View>
                      <View style={styles.downloadContent}>
                        <Text style={[styles.downloadName, { color: colors.text }]} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {metaPrimaryParts ? (
                          <Text style={[styles.downloadMeta, { color: colors.muted }]}>
                            {metaPrimaryParts}
                          </Text>
                        ) : null}
                        <Text style={[styles.downloadMeta, { color: colors.muted }]}>
                          {t('documents.downloadedAt', { defaultValue: 'Downloaded at {{date}}', date: formatDownloadDate(item.downloadedAt) })}
                        </Text>
                      </View>
                      <View style={styles.downloadActions}>
                        <Pressable
                          style={styles.downloadActionButton}
                          onPress={(event: GestureResponderEvent) => {
                            event.stopPropagation?.();
                            handleDownloadShare(item);
                          }}
                        >
                          <IconSymbol name="square.and.arrow.up" size={18} color={colors.primary} />
                        </Pressable>
                        <Pressable
                          style={styles.downloadActionButton}
                          onPress={(event: GestureResponderEvent) => {
                            event.stopPropagation?.();
                            handleDownloadDelete(item);
                          }}
                        >
                          <IconSymbol name="trash" size={18} color={colors.danger} />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchField: {
    marginHorizontal: 16,
    marginBottom: 12,
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
  filterChipText: {
    fontSize: 14,
    fontWeight: '600',
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
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  uploadIcon: {
    width: 56,
    height: 56,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  uploadIconPrimary: {
    backgroundColor: withOpacity(palette.primary, 0.12),
  },
  uploadIconAccent: {
    backgroundColor: withOpacity(palette.accent, 0.12),
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
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: StyleSheet.hairlineWidth,
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
  documentActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 12,
  },
  templateCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 18,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 4,
    gap: 18,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  templateIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  templateHeaderContent: {
    flex: 1,
    gap: 8,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '700',
  },
  templateDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  templateMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 10,
  },
  templateMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  templateMetaText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  templateHeaderAside: {
    alignItems: 'flex-end',
    gap: 10,
  },
  templateRequiredBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  templateRequiredText: {
    fontSize: 12,
    fontWeight: '700',
  },
  templateUpdatedAt: {
    fontSize: 12,
    textAlign: 'right',
  },
  templateActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  templatePrimaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
  },
  templatePrimaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  templateSecondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  templateSecondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  downloadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
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
  downloadActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadActionButton: {
    padding: 6,
    borderRadius: 12,
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
