import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { liveStreamsApi } from "@/lib/api";
import type { StreamListFilters, StreamBetsFilters } from "@/lib/api";
import { useStreamNotifications } from "./useStreamNotifications";
import {
  shouldRetry,
  showErrorToast as libShowErrorToast,
  showSuccessToast as libShowSuccessToast,
} from "@/lib/errorHandling";

// Enhanced live streams hook with error handling and notifications
export const useEnhancedLiveStreams = (filters?: StreamListFilters) => {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["liveStreams", filters],
    queryFn: () => liveStreamsApi.list(filters).then((res) => res.data),
    staleTime: 2 * 1000, // 2 seconds - allow frequent updates
    refetchInterval: 2 * 1000, // Auto-refetch every 2 seconds
    retry: (failureCount, error: any) => {
      return shouldRetry(error) && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  const { showSuccessToast, showErrorToast, showWarningToast } =
    useStreamNotifications(query.data?.streams);

  const refetch = () => {
    return queryClient.invalidateQueries({ queryKey: ["liveStreams"] });
  };

  return {
    ...query,
    refetch,
    showSuccessToast,
    showErrorToast,
    showWarningToast,
  };
};

// Enhanced stream detail hook with error handling
export const useEnhancedStreamDetail = (id: string) => {
  const query = useQuery({
    queryKey: ["liveStreams", id],
    queryFn: () => liveStreamsApi.get(id).then((res) => res.data),
    enabled: !!id,
    staleTime: 1 * 1000, // 1 second - allow very frequent updates
    refetchInterval: 2 * 1000, // Auto-refetch every 2 seconds
    retry: (failureCount, error: any) => {
      return shouldRetry(error) && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return query;
};

// Enhanced stream bets hook with error handling
export const useEnhancedStreamBets = (
  id: string,
  filters?: StreamBetsFilters
) => {
  const query = useQuery({
    queryKey: ["liveStreams", id, "bets", filters],
    queryFn: () => liveStreamsApi.getBets(id, filters).then((res) => res.data),
    enabled: !!id,
    staleTime: 1 * 1000, // 1 second - allow very frequent updates
    refetchInterval: 1 * 1000, // Auto-refetch every 1 second for bets
    retry: (failureCount, error: any) => {
      return shouldRetry(error) && failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return query;
};

// Enhanced delete stream mutation with notifications
export const useEnhancedDeleteStream = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => liveStreamsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["liveStreams"] });
      libShowSuccessToast("Stream deleted successfully");
    },
    onError: (error) => {
      libShowErrorToast(error, "Failed to delete stream");
    },
    retry: false, // Don't retry delete operations
  });
};

// Enhanced update stream mutation with notifications
export const useEnhancedUpdateStream = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { notes?: string } }) =>
      liveStreamsApi.update(id, data).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.setQueryData(["liveStreams", data.id], data);
      queryClient.invalidateQueries({ queryKey: ["liveStreams"] });
      libShowSuccessToast("Stream updated successfully");
    },
    onError: (error) => {
      libShowErrorToast(error, "Failed to update stream");
    },
    retry: (failureCount, error: any) => {
      return shouldRetry(error) && failureCount < 2;
    },
    retryDelay: 1000,
  });
};
