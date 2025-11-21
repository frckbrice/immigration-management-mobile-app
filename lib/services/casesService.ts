import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { Case, CaseStatus, CreateCaseRequest } from "../types";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CASE_REFERENCE_REGEX = /^[A-Z]{2,}-[A-Z0-9-]+$/i;

const caseIdCache = new Map<string, string>();
const pendingCaseIdResolutions = new Map<string, Promise<string>>();

const sanitizeCaseIdentifier = (identifier?: string | null) =>
  (identifier ?? "").trim();
const isUuid = (identifier: string) => UUID_REGEX.test(identifier);
const isLikelyCaseReference = (identifier: string) =>
  CASE_REFERENCE_REGEX.test(identifier);

const CASE_STATUS_PROGRESS_MAP: Record<CaseStatus, number> = {
  SUBMITTED: 10,
  UNDER_REVIEW: 30,
  DOCUMENTS_REQUIRED: 45,
  PROCESSING: 70,
  APPROVED: 100,
  REJECTED: 100,
  CLOSED: 100,
};

const formatServiceType = (serviceType: string) =>
  serviceType
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase());

const mapCase = (apiCase: any): Case => {
  const status = (apiCase.status || "SUBMITTED") as CaseStatus;
  const client = apiCase.client
    ? {
        id: apiCase.client.id,
        email: apiCase.client.email,
        firstName: apiCase.client.firstName,
        lastName: apiCase.client.lastName,
        phone: apiCase.client.phone,
      }
    : undefined;

  const assignedAgent = apiCase.assignedAgent
    ? {
        id: apiCase.assignedAgent.id,
        email: apiCase.assignedAgent.email,
        firstName: apiCase.assignedAgent.firstName,
        lastName: apiCase.assignedAgent.lastName,
      }
    : undefined;

  return {
    id: apiCase.id,
    referenceNumber: apiCase.referenceNumber,
    serviceType: apiCase.serviceType,
    status,
    priority: apiCase.priority,
    submissionDate: apiCase.submissionDate,
    lastUpdated: apiCase.lastUpdated,
    estimatedCompletion: apiCase.estimatedCompletion ?? null,
    completedAt: apiCase.completedAt ?? null,
    approvedAt: apiCase.approvedAt ?? null,
    destinationId: apiCase.destinationId ?? null,
    client,
    assignedAgent: assignedAgent ?? null,
    displayName: formatServiceType(apiCase.serviceType),
    progress: CASE_STATUS_PROGRESS_MAP[status] ?? 0,
  };
};

const resolveCaseIdInternal = async (
  caseIdentifier: string,
): Promise<string> => {
  const normalized = sanitizeCaseIdentifier(caseIdentifier);

  if (!normalized) {
    throw new Error("Case identifier is required");
  }

  const cached = caseIdCache.get(normalized);
  if (cached) {
    return cached;
  }

  if (isUuid(normalized)) {
    caseIdCache.set(normalized, normalized);
    return normalized;
  }

  if (!isLikelyCaseReference(normalized)) {
    throw new Error("Invalid case identifier format");
  }

  const pending = pendingCaseIdResolutions.get(normalized);
  if (pending) {
    return pending;
  }

  const resolutionPromise = (async () => {
    try {
      const params = new URLSearchParams();
      params.set("search", normalized);
      params.set("limit", "5");
      params.set("page", "1");

      const response = await apiClient.get<
        ApiResponse<{ cases: any[]; pagination: any }>
      >(`/cases?${params.toString()}`);
      const apiCases = response.data.data?.cases || [];
      const mappedCases = apiCases.map(mapCase);
      const matchedCase = mappedCases.find(
        (caseItem) =>
          caseItem.referenceNumber === normalized || caseItem.id === normalized,
      );

      if (matchedCase && isUuid(matchedCase.id)) {
        caseIdCache.set(normalized, matchedCase.id);
        caseIdCache.set(matchedCase.id, matchedCase.id);
        return matchedCase.id;
      }

      throw new Error("Unable to resolve case identifier");
    } catch (error: any) {
      logger.error("Failed to resolve case identifier", {
        caseIdentifier: normalized,
        error: error?.response?.data?.error || error.message || error,
      });
      throw error;
    } finally {
      pendingCaseIdResolutions.delete(normalized);
    }
  })();

  pendingCaseIdResolutions.set(normalized, resolutionPromise);
  try {
    return await resolutionPromise;
  } catch (error) {
    caseIdCache.delete(normalized);
    throw error;
  }
};

export const casesService = {
  async resolveCaseId(caseIdentifier: string): Promise<string> {
    return resolveCaseIdInternal(caseIdentifier);
  },

  /**
   * Get all cases for the current user
   */
  async getCases(filters?: {
    status?: string;
    serviceType?: string;
    priority?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Case[]> {
    try {
      const params = new URLSearchParams();
      const page = filters?.page || 1;
      const limit = filters?.limit || 20;

      params.set("page", String(page));
      params.set("limit", String(limit));

      if (filters?.status && filters.status !== "all") {
        params.set("status", filters.status);
      }

      if (filters?.serviceType) {
        params.set("serviceType", filters.serviceType);
      }

      if (filters?.priority) {
        params.set("priority", filters.priority);
      }

      if (filters?.search) {
        params.set("search", filters.search.trim());
      }

      const query = params.toString();
      const response = await apiClient.get<
        ApiResponse<{ cases: any[]; pagination: any }>
      >(query ? `/cases?${query}` : "/cases");

      const cases = response.data.data?.cases || [];
      const mapped = cases.map(mapCase);
      logger.info("Cases fetched successfully", { count: mapped.length });
      return mapped;
    } catch (error: any) {
      logger.error("Error fetching cases", error);
      throw error;
    }
  },

  /**
   * Get a single case by ID
   */
  async getCaseById(caseIdentifier: string): Promise<Case> {
    const caseId = await resolveCaseIdInternal(caseIdentifier);
    try {
      const response = await apiClient.get<ApiResponse<any>>(
        `/cases/${caseId}`,
      );

      // Handle both { success, data: Case } and { success, data: { case: Case } }
      let caseData: any | undefined;
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        if ("case" in data && typeof data === "object") {
          caseData = (data as any).case;
        } else {
          caseData = data as Case;
        }
      }

      if (!caseData) {
        throw new Error("Case not found");
      }

      const mapped = mapCase(caseData);
      logger.info("Case fetched successfully", { caseId });
      return mapped;
    } catch (error: any) {
      logger.error("Error fetching case", { caseIdentifier, error });
      throw error;
    }
  },

  /**
   * Create a new case
   * Note: Backend will verify subscription status before allowing case creation
   * If subscription is not active, backend returns 403 with SUBSCRIPTION_REQUIRED or SUBSCRIPTION_EXPIRED
   */
  async createCase(data: CreateCaseRequest): Promise<Case> {
    try {
      logger.info("Sending createCase request to API", {
        endpoint: "/cases",
        data: {
          serviceType: data.serviceType,
          destinationId: data.destinationId,
          priority: data.priority,
        },
      });

      const response = await apiClient.post<ApiResponse<{ case: any }>>(
        "/cases",
        data,
      );

      logger.info("CreateCase API response received", {
        success: response.data.success,
        hasData: !!response.data.data,
        error: response.data.error,
      });

      const caseData = response.data.data?.case;
      if (!caseData) {
        logger.error("CreateCase API response missing case data", {
          response: response.data,
        });
        throw new Error(response.data.error || "Failed to create case");
      }

      const mapped = mapCase(caseData);
      logger.info("Case created successfully", { caseId: mapped.id });
      return mapped;
    } catch (error: any) {
      logger.error("Error creating case", {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
      });

      // Provide user-friendly error messages for subscription errors
      const errorCode = error?.response?.data?.code;
      const errorMessage = error?.response?.data?.error || error.message;

      if (
        errorCode === "SUBSCRIPTION_REQUIRED" ||
        errorMessage?.includes("subscription")
      ) {
        throw new Error(
          "Active subscription required to create cases. Please subscribe first to continue.",
        );
      }

      if (
        errorCode === "SUBSCRIPTION_EXPIRED" ||
        errorMessage?.includes("expired")
      ) {
        throw new Error(
          "Your subscription has expired. Please renew your subscription to create cases.",
        );
      }

      throw error;
    }
  },

  /**
   * Update an existing case
   */
  async updateCase(caseIdentifier: string, data: Partial<Case>): Promise<Case> {
    const caseId = await resolveCaseIdInternal(caseIdentifier);
    try {
      const response = await apiClient.put<ApiResponse<any>>(
        `/cases/${caseId}`,
        data,
      );

      const caseData = response.data.data;
      if (!caseData) {
        throw new Error(response.data.error || "Failed to update case");
      }

      const mapped = mapCase(caseData);
      logger.info("Case updated successfully", { caseId });
      return mapped;
    } catch (error: any) {
      logger.error("Error updating case", { caseIdentifier, error });
      throw error;
    }
  },

  /**
   * Delete a case
   */
  async deleteCase(caseIdentifier: string): Promise<void> {
    const caseId = await resolveCaseIdInternal(caseIdentifier);
    try {
      await apiClient.delete(`/cases/${caseId}`);
      logger.info("Case deleted successfully", { caseId });
    } catch (error: any) {
      logger.error("Error deleting case", { caseIdentifier, error });
      throw error;
    }
  },
};
