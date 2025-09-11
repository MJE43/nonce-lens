/**
 * Analytics Library - Main Export File
 *
 * Exports all analytics calculators, types, and utilities for the live dashboard.
 */

// Core Calculators
export { WelfordCalculator } from './WelfordCalculator';
export type { WelfordStats } from './WelfordCalculator';

export { HistogramQuantileEstimator } from './HistogramQuantileEstimator';

export { EMACalculator } from './EMACalculator';

export { RingBuffer } from './RingBuffer';

export { DensityBucketManager } from './DensityBucketManager';
export type { DensityData } from './DensityBucketManager';

export { AlertEngine } from './AlertEngine';
export type {
  AlertRule,
  AlertEvent,
  GapAlertConfig,
  ClusterAlertConfig,
  ThresholdAlertConfig,
  MultiplierStatsCalculator
} from './AlertEngine';

export { RollingWindowCalculator } from './RollingWindowCalculator';
export type { RollingStats } from './RollingWindowCalculator';

// Persistence utilities
export {
  savePinnedMultipliers,
  loadPinnedMultipliers,
  clearPinnedMultipliers,
  getStreamsWithPinnedMultipliers,
  saveAnalyticsSettings,
  loadAnalyticsSettings,
  clearAnalyticsSettings,
  clearAllAnalyticsData,
  exportAnalyticsData,
  importAnalyticsData
} from './persistence';

export type {
  PinnedMultiplierData,
  AnalyticsSettings
} from './persistence';

// Re-export important types from API
export type { BetRecord } from '@/lib/api';
