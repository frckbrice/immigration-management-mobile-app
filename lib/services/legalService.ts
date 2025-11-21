import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";

interface LegalDocument {
  id?: string;
  title?: string;
  version?: string | null;
  content?: string | null;
  language?: string;
  isActive?: boolean;
  publishedAt?: string | null;
  updatedAt?: string;
}

interface LegalResponse {
  success: boolean;
  data?:
    | {
        document?: LegalDocument | null;
        documents?: LegalDocument[];
        content?: string;
      }
    | LegalDocument
    | string
    | null;
  error?: string;
}

function extractContent(payload: LegalResponse["data"]): string {
  if (!payload) {
    return "";
  }

  if (typeof payload === "string") {
    return payload;
  }

  if ("content" in payload && typeof payload.content === "string") {
    return payload.content;
  }

  if ("document" in payload && payload.document) {
    return payload.document?.content ?? "";
  }

  if ("documents" in payload && Array.isArray(payload.documents)) {
    const [first] = payload.documents;
    return first?.content ?? "";
  }

  return "";
}

async function fetchLegalContent(
  endpoint: string,
  language: string = "en",
): Promise<string> {
  try {
    const res = await apiClient.get<LegalResponse>(endpoint, {
      params: {
        latest: true,
        language,
      },
    });
    return extractContent(res.data?.data);
  } catch (error: any) {
    logger.error(`Failed to load legal content from ${endpoint}`, error);
    throw new Error(
      error?.response?.data?.error || "Unable to load legal content",
    );
  }
}

export const legalService = {
  async getPrivacy(language?: string): Promise<string> {
    return fetchLegalContent("/legal/privacy", language);
  },
  async getTerms(language?: string): Promise<string> {
    return fetchLegalContent("/legal/terms", language);
  },
};
