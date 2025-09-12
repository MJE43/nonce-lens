/**
 * Analysis Engine Interface Definition
 * Requirement 7.1: Single analysisMath.ts engine for all calculations
 * 
 * This file provides the formal interface definition for the analysis engine
 * and re-exports all functions for consistent usage across the application.
 */

import {
  bucketMultiplier,
  computeDistancesNonceAsc,
  computeDistancesForHits,
  calculateBucketStats,
  filterHitsByRange,
  validateDistanceConsistency,
  type HitRecord,
  type BucketStats,
  type Bet
} from './analysisMath';

/**
 * Analysis Engine Interface
 * Defines the contract for consistent calculations across all UI components
 */
export interface AnalysisEngine {
  // Core calculations
  computeDistancesNonceAsc(hits: HitRecord[]): Map<number, number | null>;
  bucketMultiplier(multiplier: number): number;
  
  // Statistics
  calculateBucketStats(
    hits: HitRecord[], 
    distanceById: Map<number, number | null>
  ): BucketStats;
  
  // Range operations
  filterHitsByRange(
    hits: HitRecord[], 
    range: [number, number]
  ): HitRecord[];
  
  // Validation
  validateDistanceConsistency(
    hits: HitRecord[], 
    distanceById: Map<number, number | null>
  ): boolean;
}

/**
 * Default implementation of the Analysis Engine
 * Requirement 7.1: Single analysisMath.ts engine for all calculations
 */
export const analysisEngine: AnalysisEngine = {
  computeDistancesNonceAsc: computeDistancesForHits,
  bucketMultiplier,
  calculateBucketStats,
  filterHitsByRange,
  validateDistanceConsistency,
};

// Re-export all analysis functions for direct usage
export {
  bucketMultiplier,
  computeDistancesNonceAsc,
  computeDistancesForHits,
  calculateBucketStats,
  filterHitsByRange,
  validateDistanceConsistency,
  type HitRecord,
  type BucketStats,
  type Bet
} from './analysisMath';

// Re-export additional utility functions
export {
  medianInt,
  getDistancesForMultiplier,
  getMultiplierStats
} from './analysisMath';