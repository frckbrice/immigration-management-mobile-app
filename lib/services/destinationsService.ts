import { apiClient } from "../api/axios";
import { logger } from "../utils/logger";
import type { Destination } from "../types";

interface DestinationsResponse {
  success: boolean;
  data?: Destination[];
  error?: string;
}

class DestinationsService {
  private cache: Destination[] | null = null;
  private lastFetched: number | null = null;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async getDestinations(forceRefresh: boolean = false): Promise<Destination[]> {
    if (
      !forceRefresh &&
      this.cache &&
      this.lastFetched &&
      Date.now() - this.lastFetched < this.CACHE_TTL
    ) {
      return this.cache;
    }

    try {
      logger.info("Fetching destinations");
      const response =
        await apiClient.get<DestinationsResponse>("/destinations");

      if (response.data.success && Array.isArray(response.data.data)) {
        this.cache = response.data.data.sort(
          (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
        );
        this.lastFetched = Date.now();
        return this.cache;
      }

      throw new Error(response.data.error || "Failed to fetch destinations");
    } catch (error) {
      logger.error("Error fetching destinations", error);
      throw error;
    }
  }
}

export const destinationsService = new DestinationsService();
