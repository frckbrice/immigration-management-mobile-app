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
      const errorMessage = response.data.error || "Upload failed: No URL returned";
      logger.error("File upload failed: No URL returned", {
        fileName,
        response: response.data,
        status: response.status,
      });
      throw new Error(errorMessage);
    }

    // Validate URL is absolute
    if (!uploadedUrl.startsWith("http://") && !uploadedUrl.startsWith("https://")) {
      logger.error("File upload returned invalid URL (not absolute)", {
        fileName,
        url: uploadedUrl,
      });
      throw new Error("Upload failed: Invalid URL returned from server");
    }

    logger.info("File uploaded successfully", {
      fileName,
      url: uploadedUrl,
      urlLength: uploadedUrl.length,
    });

    return {
      success: true,
      url: uploadedUrl,
    };
  } catch (error: any) {
    const errorStatus = error.response?.status;
    const errorMessage = error.response?.data?.error || error.message || "Upload failed";
    
    logger.error("File upload error", {
      fileName,
      status: errorStatus,
      message: errorMessage,
      error: error.response?.data || error.message,
      url: error.config?.url,
    });

    // Provide user-friendly error message based on status code
    let userMessage = errorMessage;
    if (errorStatus === 404) {
      userMessage = "Upload endpoint not found. Please contact support.";
    } else if (errorStatus === 413) {
      userMessage = "File too large. Please choose a smaller image.";
    } else if (errorStatus === 415) {
      userMessage = "Unsupported file type. Please use a valid image format.";
    } else if (errorStatus >= 500) {
      userMessage = "Server error during upload. Please try again later.";
    }

    return {
      success: false,
      error: userMessage,
    };
  }
}
