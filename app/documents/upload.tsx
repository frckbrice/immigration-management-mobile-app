
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ScrollView,
  Pressable,
  StyleSheet,
  View,
  Text,
  Platform,
  ActivityIndicator,
} from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { BackButton } from "@/components/BackButton";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "@/lib/hooks/useTranslation";
import * as DocumentPicker from "expo-document-picker";
import { useBottomSheetAlert } from "@/components/BottomSheetAlert";
import { useCasesStore } from "@/stores/cases/casesStore";
import { useDocumentsStore } from "@/stores/documents/documentsStore";
import { uploadFileToAPI } from "@/lib/services/fileUpload";
import type { Case } from "@/lib/types";

const DOCUMENT_TYPE_OPTIONS: Array<{
  value: string;
  icon: string;
  labelKey: string;
}> = [
  { value: "PASSPORT", icon: "globe", labelKey: "documents.types.passport" },
  { value: "ID_CARD", icon: "person.crop.rectangle", labelKey: "documents.types.id_card" },
  { value: "DIPLOMA", icon: "graduationcap.fill", labelKey: "documents.types.diploma" },
  { value: "BANK_STATEMENT", icon: "banknote.fill", labelKey: "documents.types.bank_statement" },
  { value: "PHOTO", icon: "photo.fill", labelKey: "documents.types.photo" },
  { value: "OTHER", icon: "doc.text.fill", labelKey: "documents.types.other" },
];

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const formatServiceType = (serviceType?: string) => {
  if (!serviceType) return "";
  return serviceType
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(^|\s)\w/g, (char) => char.toUpperCase());
};

export default function UploadDocumentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();
  const { showAlert } = useBottomSheetAlert();
  const insets = useSafeAreaInsets();
  const cases = useCasesStore((state) => state.cases);
  const casesLoading = useCasesStore((state) => state.isLoading);
  const fetchCases = useCasesStore((state) => state.fetchCases);
  const uploadDocument = useDocumentsStore((state) => state.uploadDocument);
  const uploading = useDocumentsStore((state) => state.uploading);

  const [selectedCaseId, setSelectedCaseId] = useState<string>("");
  const [documentType, setDocumentType] = useState<string>(DOCUMENT_TYPE_OPTIONS[0].value);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const hasRequestedCasesRef = useRef(false);

  useEffect(() => {
    if (hasRequestedCasesRef.current) return;
    hasRequestedCasesRef.current = true;

    fetchCases()
      .catch((error) => {
        console.warn("Failed to fetch cases", error);
        showAlert({
          title: t("common.error"),
          message: t("documents.casesLoadError", { defaultValue: "Unable to load cases. Please try again." }),
        });
      });
  }, [fetchCases, showAlert, t]);

  const activeCases = useMemo<Case[]>(
    () =>
      cases.filter(
        (item) => item.status !== "CLOSED" && item.status !== "REJECTED" && item.status !== "APPROVED",
      ),
    [cases],
  );

  useEffect(() => {
    if (selectedCaseId) {
      const exists = activeCases.some((caseItem) => caseItem.id === selectedCaseId);
      if (!exists) {
        setSelectedCaseId(activeCases[0]?.id ?? "");
      }
    } else if (activeCases.length > 0) {
      setSelectedCaseId(activeCases[0].id);
    }
  }, [activeCases, selectedCaseId]);

  const selectedCase = useMemo(
    () => activeCases.find((caseItem) => caseItem.id === selectedCaseId) ?? null,
    [activeCases, selectedCaseId],
  );

  const canContinue = useMemo(
    () => Boolean(selectedCaseId && documentType) && !uploading && !isPicking,
    [documentType, isPicking, selectedCaseId, uploading],
  );

  const documentTypeRows = useMemo(() => {
    const chunkSize = 3;
    const rows: typeof DOCUMENT_TYPE_OPTIONS[] = [];
    for (let i = 0; i < DOCUMENT_TYPE_OPTIONS.length; i += chunkSize) {
      rows.push(DOCUMENT_TYPE_OPTIONS.slice(i, i + chunkSize));
    }
    return rows;
  }, []);

  const handleCreateCaseNavigation = useCallback(() => {
    router.push("/cases/new");
  }, [router]);

  const handleRetry = useCallback(() => {
    fetchCases().catch((error) => {
      console.warn("Failed to refetch cases", error);
    });
  }, [fetchCases]);

  const handleContinue = useCallback(async () => {
    if (!selectedCaseId) {
      showAlert({
        title: t("common.error"),
        message: t("documents.selectCaseFirst", { defaultValue: "Select a case before continuing." }),
      });
      return;
    }

    setIsPicking(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      const asset = result.assets?.[0];
      if (!asset) {
        return;
      }

      if (asset.size && asset.size > MAX_FILE_SIZE_BYTES) {
        showAlert({
          title: t("common.error"),
          message: t("uploadDocument.fileTooLarge", { defaultValue: "File exceeds the 10MB limit." }),
        });
        return;
      }

      setSelectedFileName(asset.name || t("uploadDocument.unknownFile", { defaultValue: "document" }));
      setUploadProgress(0);

      const uploadResult = await uploadFileToAPI(
        asset.uri,
        asset.name || "document",
        asset.mimeType || "application/octet-stream",
        {
          onProgress: (progress) => setUploadProgress(progress),
        },
      );

      if (!uploadResult.success || !uploadResult.url) {
        throw new Error(uploadResult.error || t("errors.generic"));
      }

      const document = await uploadDocument({
        caseId: selectedCaseId,
        documentType,
        fileName: asset.name || "document",
        originalName: asset.name || undefined,
        filePath: uploadResult.url,
        fileSize: asset.size,
        mimeType: asset.mimeType || "application/octet-stream",
      });

      if (document) {
        showAlert({
          title: t("common.success"),
          message: t("uploadDocument.uploadSuccessMessage", { defaultValue: "Your document has been uploaded." }),
          actions: [
            {
              text: t("common.close"),
              variant: "primary",
              onPress: () => router.back(),
            },
          ],
        });
      }
    } catch (error: any) {
      console.warn("Upload failed", error);
      showAlert({
        title: t("common.error"),
        message: error?.message || t("errors.generic"),
      });
    } finally {
      setUploadProgress(null);
      setIsPicking(false);
    }
  }, [documentType, router, selectedCaseId, showAlert, t, uploadDocument]);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, paddingBottom: insets.bottom ?? 0 }]} edges={['top']}>
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <BackButton onPress={() => router.back()} iconSize={24} />
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
            {t('uploadDocument.title')}
          </Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.description, { color: theme.dark ? '#98989D' : '#666' }]}>
            {t('uploadDocument.chooseCaseDescription')}
          </Text>

          {casesLoading && activeCases.length === 0 ? (
            <View style={styles.loadingBlock}>
              <ActivityIndicator size="large" color="#2196F3" />
              <Text style={[styles.loadingText, { color: theme.colors.text }]}>
                {t('uploadDocument.loadingCases', { defaultValue: 'Loading your cases...' })}
              </Text>
            </View>
          ) : activeCases.length === 0 ? (
            <View style={[styles.emptyState, { borderColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
              <IconSymbol name="questionmark.circle.fill" size={32} color="#F59E0B" />
              <Text style={[styles.emptyStateTitle, { color: theme.colors.text }]}>
                {t('documents.noCasesAvailable', { defaultValue: 'No active cases available' })}
              </Text>
              <Text style={[styles.emptyStateSubtitle, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('documents.createCaseFirst', { defaultValue: 'Create a case to upload documents.' })}
              </Text>
              <Pressable style={styles.outlineButton} onPress={handleCreateCaseNavigation}>
                <Text style={[styles.outlineButtonText, { color: theme.colors.text }]}>
                  {t('documents.startNewCase', { defaultValue: 'Create a case' })}
                </Text>
              </Pressable>
              <Pressable style={styles.secondaryLinkButton} onPress={handleRetry}>
                <Text style={[styles.secondaryLinkText, { color: theme.dark ? '#98989D' : '#666' }]}>
                  {t('common.refresh')}
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={[styles.sectionCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff', borderColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}> 
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                    {t('uploadDocument.caseSelectionTitle')}
                  </Text>
                  {selectedCase ? (
                    <Text style={[styles.sectionSubtitle, { color: theme.dark ? '#98989D' : '#666' }]}> 
                      {formatServiceType(selectedCase.serviceType)}
                    </Text>
                  ) : null}
                </View>

                    <View style={styles.caseListContainer}>
                      <ScrollView
                        style={styles.caseScroll}
                        contentContainerStyle={styles.caseScrollContent}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled
                        keyboardShouldPersistTaps="handled"
                      >
                        {activeCases.map((caseItem) => {
                          const isActive = caseItem.id === selectedCaseId;
                          return (
                            <Pressable
                              key={caseItem.id}
                              style={[
                                styles.caseCard,
                                isActive && styles.caseCardActive,
                                { borderColor: isActive ? '#2196F3' : (theme.dark ? '#2C2C2E' : '#E0E0E0') },
                              ]}
                              onPress={() => setSelectedCaseId(caseItem.id)}
                            >
                              <View>
                                <Text style={[styles.caseTitle, { color: theme.colors.text }]} numberOfLines={1}>
                                  {caseItem.referenceNumber}
                                </Text>
                                <Text style={[styles.caseSubtitle, { color: theme.dark ? '#98989D' : '#666' }]} numberOfLines={1}>
                                  {formatServiceType(caseItem.serviceType)}
                                </Text>
                              </View>
                              {isActive ? <IconSymbol name="checkmark.circle.fill" size={22} color="#2196F3" /> : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                </View>
              </View>

              <View style={[styles.sectionCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff', borderColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}> 
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                  {t('uploadDocument.documentTypeTitle')}
                </Text>
                <View style={styles.typeGrid}>
                      {documentTypeRows.map((row, rowIndex) => (
                        <View key={rowIndex} style={styles.typeRow}>
                          {row.map((option) => {
                            const isActive = option.value === documentType;
                            return (
                              <Pressable
                                key={option.value}
                                style={[
                                  styles.typeChip,
                                  isActive && styles.typeChipActive,
                                  { borderColor: isActive ? '#2196F3' : (theme.dark ? '#2C2C2E' : '#E0E0E0') },
                                ]}
                                onPress={() => setDocumentType(option.value)}
                              >
                                <IconSymbol name={option.icon} size={18} color={isActive ? '#2196F3' : (theme.dark ? '#98989D' : '#666')} />
                                <Text style={[styles.typeChipText, { color: isActive ? '#2196F3' : theme.colors.text }]}>
                                  {t(option.labelKey, { defaultValue: option.value.replace(/_/g, ' ') })}
                                </Text>
                              </Pressable>
                            );
                          })}
                          {row.length < 3
                            ? Array.from({ length: 3 - row.length }).map((_, idx) => <View key={`spacer-${idx}`} style={styles.typeSpacer} />)
                            : null}
                        </View>
                      ))}
                </View>

                {selectedFileName ? (
                  <View style={[styles.fileSummary, { borderColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
                    <IconSymbol name="doc.fill" size={20} color="#2196F3" />
                    <Text style={[styles.fileName, { color: theme.colors.text }]} numberOfLines={1}>
                      {selectedFileName}
                    </Text>
                  </View>
                ) : null}

                {uploadProgress !== null ? (
                  <View style={styles.progressRow}>
                    <ActivityIndicator size="small" color="#2196F3" />
                    <Text style={[styles.progressText, { color: theme.colors.text }]}>
                      {t('uploadDocument.uploadingLabel', { defaultValue: 'Uploading...' })} {uploadProgress}%
                    </Text>
                  </View>
                ) : null}

                <Pressable
                  style={[styles.primaryButton, (!canContinue) && styles.primaryButtonDisabled]}
                  onPress={handleContinue}
                  disabled={!canContinue}
                >
                  {uploading || isPicking ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <IconSymbol name="arrow.up.doc.fill" size={20} color="#fff" />
                      <Text style={styles.primaryButtonText}>{t('uploadDocument.continueButton')}</Text>
                    </>
                  )}
                </Pressable>

                <Text style={[styles.helperText, { color: theme.dark ? '#98989D' : '#666' }]}>
                  {t('uploadDocument.helperText')}
                </Text>
              </View>
            </>
          )}

          <View style={[styles.infoCard, { backgroundColor: theme.dark ? '#1C1C1E' : '#E3F2FD' }]}>
            <IconSymbol name="info.circle.fill" size={24} color="#2196F3" />
            <View style={styles.infoContent}>
              <Text style={[styles.infoTitle, { color: theme.colors.text }]}> 
                {t('uploadDocument.supportedFormats')}
              </Text>
              <Text style={[styles.infoText, { color: theme.dark ? '#98989D' : '#666' }]}> 
                {t('uploadDocument.formatsInfo')}
              </Text>
            </View>
          </View>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  placeholder: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
  },
  loadingBlock: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 16,
    shadowColor: '#00000010',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: Platform.OS === 'android' ? 4 : 0,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 14,
  },
  caseListContainer: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  caseScroll: {
    maxHeight: 260,
  },
  caseScrollContent: {
    gap: 12,
    paddingVertical: 4,
  },
  caseCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  caseCardActive: {
    backgroundColor: '#2196F308',
  },
  caseTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  caseSubtitle: {
    fontSize: 13,
  },
  typeGrid: {
    gap: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeSpacer: {
    flex: 1,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  typeChipActive: {
    backgroundColor: '#2196F315',
  },
  typeChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fileSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressText: {
    fontSize: 14,
  },
  primaryButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#2196F3',
    borderRadius: 14,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    textAlign: 'center',
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  outlineButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryLinkButton: {
    paddingVertical: 6,
  },
  secondaryLinkText: {
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  infoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
  },
});
