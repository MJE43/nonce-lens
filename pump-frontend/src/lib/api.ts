import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    "Content-Type": "application/json",
  },
});

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Extract error message from API error format
    const message = error.response?.data?.error?.message || "An error occurred";
    throw new Error(message);
  }
);

// Types for API requests and responses
export interface RunCreateRequest {
  server_seed: string;
  client_seed: string;
  start: number;
  end: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  targets: number[];
}

export interface RunListItem {
  id: string;
  created_at: string;
  server_seed_sha256: string; // First 10 chars for display
  client_seed: string;
  difficulty: string;
  nonce_start: number;
  nonce_end: number;
  duration_ms: number;
  counts_by_target: Record<string, number>;
}

export interface RunDetail {
  id: string;
  server_seed: string; // Full seed shown in detail
  client_seed: string;
  nonce_start: number;
  nonce_end: number;
  difficulty: string;
  targets: number[];
  duration_ms: number;
  engine_version: string;
  summary: {
    count: number;
    max_multiplier: number;
    median_multiplier: number;
    counts_by_target: Record<string, number>;
  };
}

export interface Hit {
  nonce: number;
  max_multiplier: number;
}

export interface RunListFilters {
  limit?: number;
  offset?: number;
  search?: string;
  difficulty?: string;
}

export interface HitsFilters {
  min_multiplier?: number;
  limit?: number;
  offset?: number;
}

// API functions
export const runsApi = {
  // List runs with optional filters
  list: (params?: RunListFilters) =>
    apiClient.get<{ runs: RunListItem[]; total: number }>("/runs", { params }),

  // Create new run
  create: (data: RunCreateRequest) => apiClient.post<RunDetail>("/runs", data),

  // Get run details
  get: (id: string) => apiClient.get<RunDetail>(`/runs/${id}`),

  // Get paginated hits
  getHits: (id: string, params?: HitsFilters) =>
    apiClient.get<{ hits: Hit[]; total: number }>(`/runs/${id}/hits`, {
      params,
    }),

  // CSV export URLs (direct links, not API calls)
  getHitsCsvUrl: (id: string) => `${API_BASE}/runs/${id}/export/hits.csv`,
  getFullCsvUrl: (id: string) => `${API_BASE}/runs/${id}/export/full.csv`,
};

export const verifyApi = {
  verify: (params: {
    server_seed: string;
    client_seed: string;
    nonce: number;
    difficulty: string;
  }) => apiClient.get("/verify", { params }),
};
