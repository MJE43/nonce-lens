import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  liveStreamsApi,
  type BetRecord,
  type TailResponse,
  type StreamBetsFilters,
} from "@/lib/api";

export interface UseStreamTailUpdaterOptions {
  streamId: string;
  enabled?: boolean;
  intervalMs?: number;
  includeDistance?: boolean;
  filters?: StreamBetsFilters; // Should align with useStreamBetsQuery filters
  onNewBets?: (newBets: BetRecord[]) => void;
  refetchInBackground?: boolean; // new: allow background polling
}

export interface UseStreamTailUpdaterResult {
  isFetching: boolean;
  isError: boolean;
  error: Error | null;
}

/**
 * Polls /tail for a stream and merges new bets into the bets cache.
 * - Does NOT include lastId in the queryKey (prevents re-render loops)
 * - Computes lastId from the current cached bets (['streamBets', streamId, mergedFilters])
 * - Dedupes incoming bets by id, prepends them, keeps overall ordering per filters.order, and trims to filters.limit
 */
export function useStreamTailUpdater(
  options: UseStreamTailUpdaterOptions
): UseStreamTailUpdaterResult {
  const {
    streamId,
    enabled = true,
    intervalMs = 2000,
    includeDistance = false,
    filters,
    onNewBets,
    refetchInBackground = false,
  } = options;

  const queryClient = useQueryClient();

  // Use the same defaulting strategy as useStreamBetsQuery
  const mergedFilters: StreamBetsFilters = useMemo(
    () => ({ order: "id_desc", limit: 1000, ...(filters ?? {}) }),
    [filters]
  );

  // Helper to get the last id from cache for this stream and filter set
  const getLastIdFromCache = () => {
    const cacheData = queryClient.getQueryData<{
      bets: BetRecord[];
      total: number;
    }>(["streamBets", streamId, mergedFilters]);

    const bets = cacheData?.bets ?? [];
    if (bets.length === 0) return 0;
    // Use max id as lastId (consistent with id_desc ordering)
    let maxId = 0;
    for (let i = 0; i < bets.length; i += 1) {
      const id = bets[i].id;
      if (id > maxId) maxId = id;
    }
    return maxId;
  };

  // Merge and trim bets into cache
  const mergeDedupTrim = (oldData: { bets: BetRecord[]; total: number } | undefined, incoming: BetRecord[]) => {
    const existing = oldData?.bets ?? [];

    // Deduplicate
    const seen = new Set<number>();
    for (let i = 0; i < existing.length; i += 1) seen.add(existing[i].id);
    const uniqueIncoming = incoming.filter((b) => !seen.has(b.id));

    if (uniqueIncoming.length === 0)
      return oldData ?? { bets: existing, total: oldData?.total ?? existing.length };

    // Prepend new then existing for id_desc default
    let merged = [...uniqueIncoming, ...existing];

    // Respect ordering specified in filters
    if (mergedFilters.order === "id_desc") {
      merged.sort((a, b) => b.id - a.id);
    } else if (mergedFilters.order === "nonce_asc") {
      merged.sort((a, b) => a.nonce - b.nonce);
    }

    const limit = mergedFilters.limit ?? 1000;
    if (merged.length > limit) merged = merged.slice(0, limit);

    return {
      bets: merged,
      total: (oldData?.total ?? merged.length) + uniqueIncoming.length,
    };
  };

  const query = useQuery<TailResponse>({
    queryKey: ["stream-tail", streamId],
    enabled: enabled && !!streamId,
    refetchInterval: intervalMs,
    refetchIntervalInBackground: refetchInBackground,
    staleTime: 0,
    gcTime: 30 * 1000,
    retry: false,
    queryFn: async () => {
      const lastId = getLastIdFromCache();
      const response = await liveStreamsApi.tail(
        streamId,
        lastId,
        includeDistance
      );
      return response.data;
    },
    onSuccess: (data) => {
      const incoming = data?.bets ?? [];
      if (incoming.length === 0) return;

      // Merge into the bets cache for this stream
      queryClient.setQueryData(["streamBets", streamId, mergedFilters], (old: any) =>
        mergeDedupTrim(old, incoming)
      );

      // Proactively notify observers to avoid any missed updates
      queryClient.invalidateQueries({ queryKey: ["streamBets", streamId] });

      // Notify consumer with only the genuinely new bets (deduped)
      if (onNewBets) {
        onNewBets(incoming);
      }
    },
  });

  return {
    isFetching: query.isFetching,
    isError: query.isError,
    error: (query.error as Error) ?? null,
  };
}
