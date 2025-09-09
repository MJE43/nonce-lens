import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { runsApi, verifyApi, liveStreamsApi } from "./api";
import type { RunListFilters, HitsFilters, RunCreateRequest, StreamListFilters, StreamBetsFilters } from "./api";

// List runs with filters
export const useRuns = (filters?: RunListFilters) => {
  return useQuery({
    queryKey: ["runs", filters],
    queryFn: () => runsApi.list(filters).then((res) => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// Run details
export const useRun = (id: string) => {
  return useQuery({
    queryKey: ["runs", id],
    queryFn: () => runsApi.get(id).then((res) => res.data),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Run hits with pagination
export const useRunHits = (id: string, filters?: HitsFilters) => {
  return useQuery({
    queryKey: ["runs", id, "hits", filters],
    queryFn: () => runsApi.getHits(id, filters).then((res) => res.data),
    enabled: !!id,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Create run mutation
export const useCreateRun = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: RunCreateRequest) =>
      // Use a long timeout for potentially long-running create runs
      runsApi.create(data, { timeout: 300000 }).then((res) => res.data),
    onSuccess: () => {
      // Invalidate runs list to show new run
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });
};

// Verify single calculation
export const useVerify = () => {
  return useMutation({
    mutationFn: (params: {
      server_seed: string;
      client_seed: string;
      nonce: number;
      difficulty: string;
    }) => verifyApi.verify(params).then((res) => res.data),
  });
};

// Live Streams hooks

// List live streams with filters
export const useLiveStreams = (filters?: StreamListFilters) => {
  return useQuery({
    queryKey: ["liveStreams", filters],
    queryFn: () => liveStreamsApi.list(filters).then((res) => res.data),
    staleTime: 30 * 1000, // 30 seconds - shorter for live data
    refetchInterval: 5 * 1000, // Auto-refetch every 5 seconds
  });
};

// Stream details
export const useStreamDetail = (id: string) => {
  return useQuery({
    queryKey: ["liveStreams", id],
    queryFn: () => liveStreamsApi.get(id).then((res) => res.data),
    enabled: !!id,
    staleTime: 30 * 1000, // 30 seconds
  });
};

// Stream bets with pagination
export const useStreamBets = (id: string, filters?: StreamBetsFilters) => {
  return useQuery({
    queryKey: ["liveStreams", id, "bets", filters],
    queryFn: () => liveStreamsApi.getBets(id, filters).then((res) => res.data),
    enabled: !!id,
    staleTime: 10 * 1000, // 10 seconds
  });
};

// Delete stream mutation
export const useDeleteStream = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => liveStreamsApi.delete(id),
    onSuccess: () => {
      // Invalidate streams list to remove deleted stream
      queryClient.invalidateQueries({ queryKey: ["liveStreams"] });
    },
  });
};

// Update stream mutation
export const useUpdateStream = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { notes?: string } }) =>
      liveStreamsApi.update(id, data).then((res) => res.data),
    onSuccess: (data) => {
      // Update specific stream in cache
      queryClient.setQueryData(["liveStreams", data.id], data);
      // Invalidate streams list to update summary
      queryClient.invalidateQueries({ queryKey: ["liveStreams"] });
    },
  });
};
