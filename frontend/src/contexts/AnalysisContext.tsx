/**
 * Analysis Context Provider
 * 
 * Provides unified state management for hit-centric analysis pipeline
 * Requirements: 7.4, 7.5, 8.1, 8.2, 8.5
 */

import React, { createContext, useContext, useReducer, useMemo, useCallback } from 'react';
import { HitRecord, BucketStats, calculateBucketStats, computeDistancesForHits, bucketMultiplier } from '@/lib/analysisMath';

// Analysis mode types
export type AnalysisMode = 'live' | 'analysis';

// Analysis state interface
export interface AnalysisState {
  mode: AnalysisMode;
  streamId: string;
  focusedBucket: number | null;
  pinnedBuckets: number[];
  
  // Data
  hits: HitRecord[];
  distanceById: Map<number, number | null>;
  statsByBucket: Record<string, BucketStats>;
  statsByPinnedBuckets: Record<string, BucketStats>; // Pre-computed for all pinned buckets
  scopeLabel: string; // Current scope description
}

// Action types for state management
type AnalysisAction =
  | { type: 'SET_MODE'; payload: AnalysisMode }
  | { type: 'SET_STREAM_ID'; payload: string }
  | { type: 'SET_FOCUSED_BUCKET'; payload: number | null }
  | { type: 'SET_PINNED_BUCKETS'; payload: number[] }
  | { type: 'ADD_PINNED_BUCKET'; payload: number }
  | { type: 'REMOVE_PINNED_BUCKET'; payload: number }
  | { type: 'SET_HITS'; payload: HitRecord[] }
  | { type: 'UPDATE_STATS'; payload: { bucket: string; stats: BucketStats } }
  | { type: 'RESET_ANALYSIS_DATA' };

// Context value interface
export interface AnalysisContextValue extends AnalysisState {
  // Actions
  setMode: (mode: AnalysisMode) => void;
  setStreamId: (streamId: string) => void;
  setFocusedBucket: (bucket: number | null) => void;
  setPinnedBuckets: (buckets: number[]) => void;
  addPinnedBucket: (bucket: number) => void;
  removePinnedBucket: (bucket: number) => void;
  setHits: (hits: HitRecord[]) => void;
  updateStats: (bucket: string, stats: BucketStats) => void;
  resetAnalysisData: () => void;
}

// Default pinned multipliers - the exact values you use most
const DEFAULT_PINNED_BUCKETS = [1066.73, 3200.18, 11200.65, 48536.13];

// Create initial state with proper scope label
const createInitialState = (streamId: string): AnalysisState => {
  const state: AnalysisState = {
    mode: 'live',
    streamId,
    focusedBucket: null,
    pinnedBuckets: [...DEFAULT_PINNED_BUCKETS], // Pin default multipliers
    hits: [],
    distanceById: new Map(),
    statsByBucket: {},
    statsByPinnedBuckets: {},
    scopeLabel: '',
  };
  
  // Generate the initial scope label
  state.scopeLabel = generateScopeLabel(state);
  return state;
};

// Generate scope label based on current state
function generateScopeLabel(state: AnalysisState): string {
  if (state.mode === 'live') {
    return 'Live Mode';
  }

  const { focusedBucket, hits } = state;
  
  if (focusedBucket) {
    const bucketLabel = `${(focusedBucket / 1000).toFixed(1)}kx`;
    const hitCount = hits.length;
    return `${hitCount} hits • Full Stream • ${bucketLabel}`;
  }
  
  return 'Full Stream Analysis';
}

// Compute pre-computed stats for all pinned buckets
function computeStatsByPinnedBuckets(
  pinnedBuckets: number[],
  hits: HitRecord[],
  distanceById: Map<number, number | null>
): Record<string, BucketStats> {
  const statsByPinnedBuckets: Record<string, BucketStats> = {};
  
  for (const bucket of pinnedBuckets) {
    const bucketKey = bucket.toString();
    const normalizedBucket = bucketMultiplier(bucket);
    
    // Filter hits for this bucket
    const bucketHits = hits.filter(hit => bucketMultiplier(hit.bucket) === normalizedBucket);
    
    // Calculate stats for this bucket
    const stats = calculateBucketStats(bucketHits, distanceById);
    statsByPinnedBuckets[bucketKey] = stats;
  }
  
  return statsByPinnedBuckets;
}

// Reducer function
function analysisReducer(state: AnalysisState, action: AnalysisAction): AnalysisState {
  switch (action.type) {
    case 'SET_MODE': {
      const newState = {
        ...state,
        mode: action.payload,
        // Reset analysis-specific data when switching to live mode
        ...(action.payload === 'live' && {
          focusedBucket: null,
          hits: [],
          distanceById: new Map(),
          statsByBucket: {},
          statsByPinnedBuckets: {},
        }),
      };
      return {
        ...newState,
        scopeLabel: generateScopeLabel(newState),
      };
    }

    case 'SET_STREAM_ID':
      return {
        ...state,
        streamId: action.payload,
      };

    case 'SET_FOCUSED_BUCKET': {
      const newState = {
        ...state,
        focusedBucket: action.payload,
      };
      return {
        ...newState,
        scopeLabel: generateScopeLabel(newState),
      };
    }





    case 'SET_PINNED_BUCKETS': {
      const newState = {
        ...state,
        pinnedBuckets: action.payload,
      };
      return {
        ...newState,
        statsByPinnedBuckets: computeStatsByPinnedBuckets(
          action.payload,
          state.hits,
          state.distanceById
        ),
      };
    }

    case 'ADD_PINNED_BUCKET': {
      const newPinnedBuckets = [...state.pinnedBuckets];
      if (!newPinnedBuckets.includes(action.payload)) {
        newPinnedBuckets.push(action.payload);
      }
      const newState = {
        ...state,
        pinnedBuckets: newPinnedBuckets,
      };
      return {
        ...newState,
        statsByPinnedBuckets: computeStatsByPinnedBuckets(
          newPinnedBuckets,
          state.hits,
          state.distanceById
        ),
      };
    }

    case 'REMOVE_PINNED_BUCKET': {
      const newPinnedBuckets = state.pinnedBuckets.filter(bucket => bucket !== action.payload);
      const newState = {
        ...state,
        pinnedBuckets: newPinnedBuckets,
      };
      return {
        ...newState,
        statsByPinnedBuckets: computeStatsByPinnedBuckets(
          newPinnedBuckets,
          state.hits,
          state.distanceById
        ),
      };
    }

    case 'SET_HITS': {
      // Compute distances for the new hits
      const distanceById = computeDistancesForHits(action.payload);
      
      // Update stats for focused bucket if exists
      let statsByBucket = { ...state.statsByBucket };
      if (state.focusedBucket) {
        const bucketKey = state.focusedBucket.toString();
        const normalizedBucket = bucketMultiplier(state.focusedBucket);
        const bucketHits = action.payload.filter(hit => 
          bucketMultiplier(hit.bucket) === normalizedBucket
        );
        statsByBucket[bucketKey] = calculateBucketStats(bucketHits, distanceById);
      }

      const newState = {
        ...state,
        hits: action.payload,
        distanceById,
        statsByBucket,
        statsByPinnedBuckets: computeStatsByPinnedBuckets(
          state.pinnedBuckets,
          action.payload,
          distanceById
        ),
      };
      
      return {
        ...newState,
        scopeLabel: generateScopeLabel(newState),
      };
    }

    case 'UPDATE_STATS':
      return {
        ...state,
        statsByBucket: {
          ...state.statsByBucket,
          [action.payload.bucket]: action.payload.stats,
        },
      };

    case 'RESET_ANALYSIS_DATA': {
      const newState = {
        ...state,
        hits: [],
        distanceById: new Map(),
        statsByBucket: {},
        statsByPinnedBuckets: {},
      };
      return {
        ...newState,
        scopeLabel: generateScopeLabel(newState),
      };
    }

    default:
      return state;
  }
}

// Create context
const AnalysisContext = createContext<AnalysisContextValue | null>(null);

// Provider component
export interface AnalysisProviderProps {
  streamId: string;
  children: React.ReactNode;
}

export const AnalysisProvider: React.FC<AnalysisProviderProps> = ({ 
  streamId, 
  children 
}) => {
  const [state, dispatch] = useReducer(analysisReducer, createInitialState(streamId));

  // Action creators
  const setMode = useCallback((mode: AnalysisMode) => {
    dispatch({ type: 'SET_MODE', payload: mode });
  }, []);

  const setStreamId = useCallback((newStreamId: string) => {
    dispatch({ type: 'SET_STREAM_ID', payload: newStreamId });
  }, []);

  const setFocusedBucket = useCallback((bucket: number | null) => {
    dispatch({ type: 'SET_FOCUSED_BUCKET', payload: bucket });
  }, []);





  const setPinnedBuckets = useCallback((buckets: number[]) => {
    dispatch({ type: 'SET_PINNED_BUCKETS', payload: buckets });
  }, []);

  const addPinnedBucket = useCallback((bucket: number) => {
    dispatch({ type: 'ADD_PINNED_BUCKET', payload: bucket });
  }, []);

  const removePinnedBucket = useCallback((bucket: number) => {
    dispatch({ type: 'REMOVE_PINNED_BUCKET', payload: bucket });
  }, []);



  const setHits = useCallback((hits: HitRecord[]) => {
    dispatch({ type: 'SET_HITS', payload: hits });
  }, []);

  const updateStats = useCallback((bucket: string, stats: BucketStats) => {
    dispatch({ type: 'UPDATE_STATS', payload: { bucket, stats } });
  }, []);

  const resetAnalysisData = useCallback(() => {
    dispatch({ type: 'RESET_ANALYSIS_DATA' });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<AnalysisContextValue>(() => ({
    ...state,
    setMode,
    setStreamId,
    setFocusedBucket,
    setPinnedBuckets,
    addPinnedBucket,
    removePinnedBucket,
    setHits,
    updateStats,
    resetAnalysisData,
  }), [
    state,
    setMode,
    setStreamId,
    setFocusedBucket,
    setPinnedBuckets,
    addPinnedBucket,
    removePinnedBucket,
    setHits,
    updateStats,
    resetAnalysisData,
  ]);

  return (
    <AnalysisContext.Provider value={contextValue}>
      {children}
    </AnalysisContext.Provider>
  );
};

// Hook to use the analysis context
export const useAnalysis = (): AnalysisContextValue => {
  const context = useContext(AnalysisContext);
  if (!context) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};

// Export types for external use (already exported above)
// export type { AnalysisMode, AnalysisState };