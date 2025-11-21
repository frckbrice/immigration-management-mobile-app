import { create } from "zustand";
import { destinationsService } from "../../lib/services/destinationsService";
import { logger } from "../../lib/utils/logger";
import type { Destination } from "../../lib/types";

interface DestinationsState {
  destinations: Destination[];
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchDestinations: (options?: { force?: boolean }) => Promise<Destination[]>;
  getDestinationById: (id: string) => Destination | undefined;
}

export const useDestinationsStore = create<DestinationsState>((set, get) => ({
  destinations: [],
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchDestinations: async (options) => {
    const { force } = options || {};
    const { lastFetched, destinations, isLoading } = get();
    const ttl = 5 * 60 * 1000; // 5 minutes

    if (
      !force &&
      !isLoading &&
      destinations.length > 0 &&
      lastFetched &&
      Date.now() - lastFetched < ttl
    ) {
      return destinations;
    }

    set({ isLoading: true, error: null });
    try {
      const data = await destinationsService.getDestinations(force);
      set({ destinations: data, isLoading: false, lastFetched: Date.now() });
      return data;
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error ||
        error?.message ||
        "Failed to load destinations";
      logger.error("Error loading destinations", error);
      set({ error: errorMessage, isLoading: false });
      return get().destinations;
    }
  },

  getDestinationById: (id) => {
    return get().destinations.find((destination) => destination.id === id);
  },
}));
