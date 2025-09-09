import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { runsApi, verifyApi } from "./api";
import type { RunListFilters, HitsFilters, RunCreateRequest } from "./api";

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
