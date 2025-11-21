import { apiClient } from "../api/axios";
import { auth } from "../firebase/config";
import { logger } from "../utils/logger";

interface UploadFileOptions {
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Upload a file to the backend storage endpoint and return the hosted URL.
 * The backend is responsible for persisting the file (e.g. Cloudinary, S3).
 */
export async function uploadFileToAPI(
  fileUri: string,
  fileName: string,
  mimeType: string,
  options?: UploadFileOptions,
): Promise<UploadResult> {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return {
        success: false,
        error: "User not authenticated",
      };
    }

    const formData = new FormData();
    formData.append("file", {
      uri: fileUri,
      name: fileName,
      type: mimeType,
    } as any);

    const response = await apiClient.post<{
      success: boolean;
      data?: { url: string };
      error?: string;
    }>("/cloudinary/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: options?.onProgress
        ? (event) => {
            const total = event.total || 1;
            const percent = Math.round((event.loaded * 100) / total);
            options.onProgress?.(percent);
          }
        : undefined,
    });

    const uploadedUrl = response.data.data?.url;
    if (!uploadedUrl) {
      throw new Error(response.data.error || "Upload failed: No URL returned");
    }

    logger.info("File uploaded successfully", {
      fileName,
      url: uploadedUrl,
    });

    return {
      success: true,
      url: uploadedUrl,
    };
  } catch (error: any) {
    logger.error("File upload error", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || "Upload failed",
    };
  }
}
