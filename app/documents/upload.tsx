
import React from "react";
import { ScrollView, Pressable, StyleSheet, View, Text, Platform } from "react-native";
import { IconSymbol } from "@/components/IconSymbol";
import { useTheme } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { useTranslation } from "@/lib/hooks/useTranslation";

export default function UploadDocumentScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const handleUpload = (type: string) => {
    console.log('Upload type:', type);
  };

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.dark ? '#2C2C2E' : '#E0E0E0' }]}>
          <Pressable 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <IconSymbol name="chevron.left" size={24} color={theme.colors.text} />
          </Pressable>
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
            {t('uploadDocument.chooseMethod')}
          </Text>

          {/* Upload Options */}
          <Pressable 
            style={[styles.uploadOption, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
            onPress={() => handleUpload('camera')}
          >
            <View style={[styles.uploadIcon, { backgroundColor: '#E3F2FD' }]}>
              <IconSymbol name="camera.fill" size={32} color="#2196F3" />
            </View>
            <View style={styles.uploadContent}>
              <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>
                {t('uploadDocument.takePhoto')}
              </Text>
              <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('uploadDocument.useCamera')}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </Pressable>

          <Pressable 
            style={[styles.uploadOption, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
            onPress={() => handleUpload('gallery')}
          >
            <View style={[styles.uploadIcon, { backgroundColor: '#E8F5E9' }]}>
              <IconSymbol name="photo.fill" size={32} color="#4CAF50" />
            </View>
            <View style={styles.uploadContent}>
              <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>
                {t('uploadDocument.chooseFromGallery')}
              </Text>
              <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('uploadDocument.selectExisting')}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </Pressable>

          <Pressable 
            style={[styles.uploadOption, { backgroundColor: theme.dark ? '#1C1C1E' : '#fff' }]}
            onPress={() => handleUpload('files')}
          >
            <View style={[styles.uploadIcon, { backgroundColor: '#FFF3E0' }]}>
              <IconSymbol name="folder.fill" size={32} color="#FF9800" />
            </View>
            <View style={styles.uploadContent}>
              <Text style={[styles.uploadTitle, { color: theme.colors.text }]}>
                {t('uploadDocument.browseFiles')}
              </Text>
              <Text style={[styles.uploadDescription, { color: theme.dark ? '#98989D' : '#666' }]}>
                {t('uploadDocument.chooseFromDevice')}
              </Text>
            </View>
            <IconSymbol name="chevron.right" size={20} color={theme.dark ? '#98989D' : '#666'} />
          </Pressable>

          {/* Info Card */}
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
  backButton: {
    padding: 8,
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
  },
  description: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
  },
  uploadOption: {
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
  infoCard: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
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
