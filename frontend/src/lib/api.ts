import axios from "axios";
import {
  validateRunDetail,
  validateHit,
  formatValidationErrors,
  formatValidationWarnings,
  ValidationResult,
} from "./validation";

// Extend axios config to include metadata for debugging
declare module 'axios' {
  interface AxiosRequestConfig {
    metadata?: {
      debugInfo: Partial<DebugInfo>;
    };
  }
}

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

// Debug logging utility
const isDevelopment = import.meta.env.DEV;

interface APIError {
  message: string;
  status?: number;
  details?: any;
  timestamp: string;
  type: 'network' | 'http' | 'timeout' | 'unknown';
}

interface DebugInfo {
  apiUrl: string;
  method: string;
  requestTime: number;
  responseTime?: number;
  responseStatus?: number;
  responseData?: any;
  requestData?: any;
  errors?: string[];
}

// Enhanced API client with debugging and timeout configuration
export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    const debugInfo: Partial<DebugInfo> = {
      apiUrl: `${config.baseURL}${config.url}`,
      method: config.method?.toUpperCase() || 'GET',
      requestTime: Date.now(),
      requestData: config.data,
    };

    // Store debug info in request config for later use
    config.metadata = { debugInfo };

    if (isDevelopment) {
      console.group(`🚀 API Request: ${debugInfo.method} ${debugInfo.apiUrl}`);
      console.log('Request Config:', {
        url: config.url,
        method: config.method,
        params: config.params,
        data: config.data,
        headers: config.headers,
        timeout: config.timeout,
      });
      console.log('Timestamp:', new Date().toISOString());
      console.groupEnd();
    }

    return config;
  },
  (error) => {
    if (isDevelopment) {
      console.error('❌ Request Setup Error:', error);
    }
    return Promise.reject(error);
  }
);

// Enhanced response interceptor with comprehensive error handling and logging
apiClient.interceptors.response.use(
  (response) => {
    const debugInfo = response.config.metadata?.debugInfo;
    const responseTime = Date.now();
    const duration = debugInfo?.requestTime
      ? responseTime - debugInfo.requestTime
      : 0;

    // Validate response data based on endpoint
    if (isDevelopment && response.data) {
      const url = response.config.url || "";

      // Validate RunDetail responses
      if (url.match(/\/runs\/[^\/]+$/) && !url.includes("/hits")) {
        const validation = validateRunDetail(response.data);
        if (!validation.isValid) {
          console.error(
            "❌ RunDetail validation failed:",
            formatValidationErrors(validation.errors)
          );
        }
        if (validation.warnings.length > 0) {
          console.warn(
            "⚠️ RunDetail validation warnings:",
            formatValidationWarnings(validation.warnings)
          );
        }
      }

      // Validate hits responses
      if (url.includes("/hits") && response.data.rows) {
        response.data.rows.forEach((hit: unknown, index: number) => {
          const validation = validateHit(hit);
          if (!validation.isValid) {
            console.error(
              `❌ Hit[${index}] validation failed:`,
              formatValidationErrors(validation.errors)
            );
          }
          if (validation.warnings.length > 0) {
            console.warn(
              `⚠️ Hit[${index}] validation warnings:`,
              formatValidationWarnings(validation.warnings)
            );
          }
        });
      }
    }

    if (isDevelopment) {
      console.group(
        `✅ API Response: ${response.status} ${debugInfo?.method || "GET"} ${
          debugInfo?.apiUrl || response.config.url
        }`
      );
      console.log("Response Status:", response.status);
      console.log("Response Headers:", response.headers);
      console.log("Response Data:", response.data);
      console.log("Duration:", `${duration}ms`);
      console.log("Timestamp:", new Date().toISOString());
      console.groupEnd();
    }

    return response;
  },
  (error) => {
    const debugInfo = error.config?.metadata?.debugInfo;
    const responseTime = Date.now();
    const duration = debugInfo?.requestTime
      ? responseTime - debugInfo.requestTime
      : 0;

    // Categorize error types
    let errorType: APIError["type"] = "unknown";
    let userMessage = "An unexpected error occurred";

    if (error.code === "ECONNABORTED" || error.code === "TIMEOUT") {
      errorType = "timeout";
      userMessage =
        "Request timed out. Please check your connection and try again.";
    } else if (error.code === "NETWORK_ERROR" || error.code === "ERR_NETWORK") {
      errorType = "network";
      userMessage =
        "Network connection failed. Please check your internet connection.";
    } else if (error.response) {
      errorType = "http";

      // Handle specific HTTP status codes
      switch (error.response.status) {
        case 404:
          userMessage =
            "Resource not found. The requested item may have been deleted.";
          break;
        case 400:
          userMessage =
            error.response.data?.error?.message ||
            "Invalid request. Please check your input.";
          break;
        case 401:
          userMessage = "Authentication required. Please log in again.";
          break;
        case 403:
          userMessage =
            "Access denied. You do not have permission to perform this action.";
          break;
        case 429:
          userMessage =
            "Too many requests. Please wait a moment and try again.";
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          userMessage = "Server error. Please try again later.";
          break;
        default:
          userMessage =
            error.response.data?.error?.message ||
            `Server returned error ${error.response.status}`;
      }
    }

    // Create structured error object
    const apiError: APIError = {
      message: userMessage,
      status: error.response?.status,
      details: {
        originalError: error.message,
        code: error.code,
        response: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          params: error.config?.params,
        },
      },
      timestamp: new Date().toISOString(),
      type: errorType,
    };

    if (isDevelopment) {
      console.group(
        `❌ API Error: ${error.response?.status || error.code} ${
          debugInfo?.method || "GET"
        } ${debugInfo?.apiUrl || error.config?.url}`
      );
      console.error("Error Type:", errorType);
      console.error("Status:", error.response?.status);
      console.error("Message:", userMessage);
      console.error("Original Error:", error.message);
      console.error("Response Data:", error.response?.data);
      console.error("Request Config:", {
        url: error.config?.url,
        method: error.config?.method,
        params: error.config?.params,
        data: error.config?.data,
      });
      console.error("Duration:", `${duration}ms`);
      console.error("Timestamp:", apiError.timestamp);
      console.groupEnd();
    }

    // Throw user-friendly error
    const enhancedError = new Error(userMessage);
    (enhancedError as any).apiError = apiError;
    throw enhancedError;
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
  distance_prev?: number | null;
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
  include_distance?: "per_multiplier" | "filtered";
  tol?: number;
}

// Export types for use in components
export type { APIError, DebugInfo };

// Utility function to test API connectivity
export const testApiConnection = async (): Promise<{
  success: boolean;
  error?: string;
  responseTime?: number;
}> => {
  const startTime = Date.now();

  try {
    // Test with a simple endpoint - using runs list with limit 1
    await apiClient.get("/runs", { params: { limit: 1 } });
    const responseTime = Date.now() - startTime;

    return {
      success: true,
      responseTime,
    };
  } catch (error: unknown) {
    const responseTime = Date.now() - startTime;

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      responseTime,
    };
  }
};

// Utility function to get detailed error information
export const getErrorDetails = (error: unknown): APIError | null => {
  return (error as Error & { apiError?: APIError })?.apiError || null;
};

// Data validation utilities
export const validateApiResponse = {
  runDetail: (data: unknown): ValidationResult => validateRunDetail(data),
  hit: (data: unknown): ValidationResult => validateHit(data),

  // Validate and log results
  runDetailWithLogging: (
    data: unknown,
    context = "API Response"
  ): ValidationResult => {
    const validation = validateRunDetail(data);

    if (!validation.isValid) {
      console.error(
        `${context} - RunDetail validation failed:`,
        formatValidationErrors(validation.errors)
      );
    }

    if (validation.warnings.length > 0) {
      console.warn(
        `${context} - RunDetail validation warnings:`,
        formatValidationWarnings(validation.warnings)
      );
    }

    return validation;
  },

  hitWithLogging: (
    data: unknown,
    context = "API Response"
  ): ValidationResult => {
    const validation = validateHit(data);

    if (!validation.isValid) {
      console.error(
        `${context} - Hit validation failed:`,
        formatValidationErrors(validation.errors)
      );
    }

    if (validation.warnings.length > 0) {
      console.warn(
        `${context} - Hit validation warnings:`,
        formatValidationWarnings(validation.warnings)
      );
    }

    return validation;
  },
};

// API functions
export const runsApi = {
  // List runs with optional filters
  list: (params?: RunListFilters) =>
    apiClient.get<{ runs: RunListItem[]; total: number }>("/runs", { params }),

  // Create new run
  create: (
    data: RunCreateRequest,
    config?: import("axios").AxiosRequestConfig
  ) => apiClient.post<RunDetail>("/runs", data, config),

  // Get run details
  get: (id: string) => apiClient.get<RunDetail>(`/runs/${id}`),

  // Get paginated hits
  getHits: (id: string, params?: HitsFilters) =>
    apiClient.get<{ total: number; rows: Hit[] }>(`/runs/${id}/hits`, {
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

// Distances API
export interface DistanceStatsResponse {
  multiplier: number;
  tol: number;
  count: number;
  nonces: number[];
  distances: number[];
  stats:
    | {
        mean: number;
        median: number;
        min: number;
        max: number;
        p90: number;
        p99: number;
        stddev: number;
        cv: number;
      }
    | {};
}

export const distancesApi = {
  get: (id: string, params: { multiplier: number; tol?: number }) =>
    apiClient.get<DistanceStatsResponse>(`/runs/${id}/distances`, { params }),
  getCsvUrl: (id: string, multiplier: number, tol?: number) => {
    const url = new URL(`${API_BASE}/runs/${id}/distances.csv`);
    url.searchParams.set("multiplier", String(multiplier));
    if (tol !== undefined) url.searchParams.set("tol", String(tol));
    return url.toString();
  },
};

// Live Streams API Types (matching backend snake_case format)
export interface StreamSummary {
  id: string;
  server_seed_hashed: string;
  client_seed: string;
  created_at: string;
  last_seen_at: string;
  total_bets: number;
  highest_multiplier: number;
  notes?: string;
}

export interface StreamDetail {
  id: string;
  server_seed_hashed: string;
  client_seed: string;
  created_at: string;
  last_seen_at: string;
  total_bets: number;
  highest_multiplier: number;
  lowest_multiplier?: number;
  average_multiplier?: number;
  notes?: string;
  recent_bets: BetRecord[];
}

export interface BetRecord {
  id: number;
  antebot_bet_id: string;
  received_at: string;
  date_time?: string;
  nonce: number;
  amount: number;
  payout_multiplier: number;
  payout: number;
  difficulty: "easy" | "medium" | "hard" | "expert";
  round_target?: number;
  round_result?: number;
  distance_prev_opt?: number | null;
}

export interface TailResponse {
  bets: BetRecord[];
  lastId: number;
}

export interface StreamListFilters {
  limit?: number;
  offset?: number;
}

export interface StreamBetsFilters {
  min_multiplier?: number;
  limit?: number;
  offset?: number;
  order?: "nonce_asc" | "id_desc";
  include_distance?: boolean;
}

// Hit-Centric Analysis API Types
export interface HitRecord {
  nonce: number;
  bucket: number;
  distance_prev: number | null;
  id: number;
  date_time: string | null;
}

export interface BucketStats {
  count: number;
  median: number | null;
  mean: number | null;
  min: number | null;
  max: number | null;
  method: 'exact' | 'approximate';
}

export interface RangeStats {
  range: string;
  stats: BucketStats;
}

export interface HitQueryResponse {
  hits: HitRecord[];
  prev_nonce_before_range: number | null;
  total_in_range: number;
  has_more: boolean;
}

export interface HitStatsResponse {
  stats_by_range: RangeStats[];
}

export interface GlobalHitStatsResponse {
  global_stats: BucketStats;
  theoretical_eta: number | null;
  confidence_interval: [number, number] | null;
}

export interface BatchHitQueryResponse {
  hits_by_bucket: Record<string, HitRecord[]>;
  stats_by_bucket: Record<string, BucketStats>;
}

export interface HitQueryFilters {
  bucket: number;
  after_nonce?: number;
  before_nonce?: number;
  limit?: number;
  order?: 'nonce_asc' | 'nonce_desc';
  include_distance?: boolean;
}

export interface HitStatsFilters {
  bucket: number;
  ranges?: string;
}

export interface BatchHitFilters {
  buckets: string; // comma-separated bucket values
  after_nonce?: number;
  before_nonce?: number;
  limit_per_bucket?: number;
}

// Live Streams API
export const liveStreamsApi = {
  // List all streams
  list: (params?: StreamListFilters) =>
    apiClient.get<{ streams: StreamSummary[]; total: number }>("/live/streams", { params }),

  // Get stream details
  get: (id: string) => apiClient.get<StreamDetail>(`/live/streams/${id}`),

  // Get stream bets with pagination
  getBets: (id: string, params?: StreamBetsFilters) =>
    apiClient.get<{ total: number; bets: BetRecord[] }>(`/live/streams/${id}/bets`, { params }),

  // Get incremental updates
  tail: (id: string, sinceId: number, includeDistance?: boolean) =>
    apiClient.get<TailResponse>(`/live/streams/${id}/tail`, { 
      params: { 
        since_id: sinceId,
        ...(includeDistance && { include_distance: includeDistance })
      } 
    }),

  // Delete stream
  delete: (id: string) => apiClient.delete(`/live/streams/${id}`),

  // Update stream
  update: (id: string, data: { notes?: string }) =>
    apiClient.put<StreamDetail>(`/live/streams/${id}`, data),

  // Export CSV
  getExportCsvUrl: (id: string) => `${API_BASE}/live/streams/${id}/export.csv`,

  // Hit-centric analysis endpoints
  getHits: (id: string, params: HitQueryFilters) =>
    apiClient.get<HitQueryResponse>(`/live/streams/${id}/hits`, { params }),

  getHitStats: (id: string, params: HitStatsFilters) =>
    apiClient.get<HitStatsResponse>(`/live/streams/${id}/hits/stats`, { params }),

  getGlobalHitStats: (id: string, params: { bucket: number }) =>
    apiClient.get<GlobalHitStatsResponse>(`/live/streams/${id}/hits/stats/global`, { params }),

  getBatchHits: (id: string, params: BatchHitFilters) =>
    apiClient.get<BatchHitQueryResponse>(`/live/streams/${id}/hits/batch`, { params }),
};
