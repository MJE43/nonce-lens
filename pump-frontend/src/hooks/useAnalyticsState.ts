/**
 * Analytics state hook for managing all incremental calculations.
 * Integrates multiplier tracking, distance calculations, alerts, and rolling statistics.
 *
 * Requirements: 1.1, 1.2, 2.1, 2.2, 7.1, 7.2, 16.1, 16.2
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  WelfordCalculator,
  HistogramQuantileEstimator,
  EMACalculator,
  RingBuffer,
  DensityBucketManager,
  AlertEngine,
  savePinnedMultipliers,
  loadPinnedMultipliers,
  clearPinnedMultipliers,
  type BetRecord,
  type AlertRule,
  type AlertEvent
} from '../lib/analytics';
import { RollingWindowCalculator } from '../lib/analytics/RollingWindowCalculator';

// Types for the analytics state
export interface LiveKPIs {
  highestMultiplier: number;
  hitsCount: number;
  hitRate: number; // hits/min
  hitRateEMA: number; // 30s EMA
  latestNonce: number;
  latestGap: number; // nonce gap since last row
  lastHitDistance: number; // nonce gap since last hit
  streamDurationSeconds: number;
}

export interface PinnedMultiplier {
  multiplier: number;
  tolerance: number; // 1e-9
  stats: MultiplierStats;
  alerts: AlertRule[];
}

export interface MultiplierStats {
  count: number;
  lastNonce: number;
  lastGap: number;
  meanGap: number;
  stdGap: number;
  maxGap: number;
  p90Gap: number;
  p99Gap: number;
  ringBuffer: RingBuffer<number>; // last 50 gaps
  eta: {
    value: number;
    model: 'theoretical' | 'observed';
  };
}

export interface PeakRecord {
  multiplier: number;
  nonce: number;
  timestamp: Date;
  id: number; // for jump-to-row
}

export interface DashboardFilters {
  minMultiplier?: number;
  order: 'nonce_asc' | 'id_desc';
  showOnlyPinned: boolean;
  applyFiltersToKPIs: boolean;
}

export interface AnalyticsState {
  // Live data
  bets: BetRecord[];
  lastId: number;

  // KPI state
  kpis: LiveKPIs;

  // Pinned multipliers
  pinnedMultipliers: Map<number, PinnedMultiplier>;

  // Filters
  filters: DashboardFilters;

  // Alert state
  recentAlerts: AlertEvent[];

  // Rolling window stats
  rollingStats: {
    mean: number;
    max: number;
    hitRate: number;
    count: number;
    deviationFromAllTime: number; // z-score
  };

  // Top peaks tracking
  topPeaks: PeakRecord[];

  // Density data
  densityData: {
    buckets: Map<number, number>;
    bucketSize: number;
    maxCount: number;
  };

  // Distance tracking (client-side fallback)
  lastNonceByMultiplier: Map<number, number>;

  // Stream metadata
  streamStartTime: Date | null;
  isLive: boolean;
}

interface AnalyticsCalculators {
  hitRateEMA: EMACalculator;
  densityManager: DensityBucketManager;
  alertEngine: AlertEngine;
  rollingWindow: RollingWindowCalculator;
  allTimeMultiplierStats: WelfordCalculator; // For all-time mean calculation
}

export function useAnalyticsState(streamId: string) {
  // Initialize calculators
  const calculatorsRef = useRef<AnalyticsCalculators>({
    hitRateEMA: new EMACalculator(30), // 30-second EMA
    densityManager: new DensityBucketManager(1000), // 1000 nonces per bucket
    alertEngine: new AlertEngine(),
    rollingWindow: new RollingWindowCalculator('time', 60), // 60-second window
    allTimeMultiplierStats: new WelfordCalculator()
  });

  const [state, setState] = useState<AnalyticsState>({
    bets: [],
    lastId: 0,
    kpis: {
      highestMultiplier: 0,
      hitsCount: 0,
      hitRate: 0,
      hitRateEMA: 0,
      latestNonce: 0,
      latestGap: 0,
      lastHitDistance: 0,
      streamDurationSeconds: 0
    },
    pinnedMultipliers: new Map(),
    filters: {
      order: 'id_desc',
      showOnlyPinned: false,
      applyFiltersToKPIs: false
    },
    recentAlerts: [],
    rollingStats: {
      mean: 0,
      max: 0,
      hitRate: 0,
      count: 0,
      deviationFromAllTime: 0
    },
    topPeaks: [],
    densityData: {
      buckets: new Map(),
      bucketSize: 1000,
      maxCount: 0
    },
    lastNonceByMultiplier: new Map(),
    streamStartTime: null,
    isLive: false
  });

  // Reset state when stream changes
  useEffect(() => {
    // Load pinned multipliers from session storage for the new stream
    const loaded = loadPinnedMultipliers(streamId);
    const reconstructedPinnedMap = new Map<number, PinnedMultiplier>();
    if (loaded && Array.isArray(loaded.multipliers)) {
      for (const m of loaded.multipliers) {
        reconstructedPinnedMap.set(m, {
          multiplier: m,
          tolerance: loaded.tolerance ?? 1e-9,
          stats: {
            count: 0,
            lastNonce: 0,
            lastGap: 0,
            meanGap: 0,
            stdGap: 0,
            maxGap: 0,
            p90Gap: 0,
            p99Gap: 0,
            ringBuffer: new RingBuffer<number>(50),
            eta: { value: 0, model: 'observed' }
          },
          alerts: []
        });
      }
    }

    setState(prevState => ({
      ...prevState,
      bets: [],
      lastId: 0,
      kpis: {
        highestMultiplier: 0,
        hitsCount: 0,
        hitRate: 0,
        hitRateEMA: 0,
        latestNonce: 0,
        latestGap: 0,
        lastHitDistance: 0,
        streamDurationSeconds: 0
      },
      pinnedMultipliers: reconstructedPinnedMap,
      recentAlerts: [],
      rollingStats: {
        mean: 0,
        max: 0,
        hitRate: 0,
        count: 0,
        deviationFromAllTime: 0
      },
      topPeaks: [],
      densityData: {
        buckets: new Map(),
        bucketSize: 1000,
        maxCount: 0
      },
      lastNonceByMultiplier: new Map(),
      streamStartTime: null,
      isLive: false
    }));

    // Reset calculators
    const calculators = calculatorsRef.current;
    calculators.hitRateEMA.reset();
    calculators.densityManager.reset();
    calculators.alertEngine.reset();
    calculators.rollingWindow.reset();
    calculators.allTimeMultiplierStats.reset();
  }, [streamId]);

  /**
   * Helper function to check if a bet passes the current filters
   */
  const betPassesFilters = useCallback((bet: BetRecord, filters: DashboardFilters, pinnedMultipliers: Map<number, PinnedMultiplier>): boolean => {
    // Check minimum multiplier filter
    if (filters.minMultiplier && bet.payout_multiplier < filters.minMultiplier) {
      return false;
    }

    // Check pinned multipliers filter
    if (filters.showOnlyPinned) {
      const tolerance = 1e-9;
      let matchesPinned = false;
      for (const multiplier of pinnedMultipliers.keys()) {
        if (Math.abs(bet.payout_multiplier - multiplier) <= tolerance) {
          matchesPinned = true;
          break;
        }
      }
      if (!matchesPinned) {
        return false;
      }
    }

    return true;
  }, []);

  /**
   * Calculate KPIs from a set of bets
   */
  const calculateKPIsFromBets = useCallback((bets: BetRecord[], streamStartTime: Date | null, streamDurationSeconds: number): LiveKPIs => {
    if (bets.length === 0) {
      return {
        highestMultiplier: 0,
        hitsCount: 0,
        hitRate: 0,
        hitRateEMA: 0,
        latestNonce: 0,
        latestGap: 0,
        lastHitDistance: 0,
        streamDurationSeconds
      };
    }

    // Find highest multiplier
    const highestMultiplier = Math.max(...bets.map(bet => bet.payout_multiplier));

    // Count hits
    const hitsCount = bets.length;

    // Calculate hit rate
    const hitRate = streamDurationSeconds > 0 ? (hitsCount * 60) / streamDurationSeconds : 0;

    // Find latest nonce and calculate gap
    const sortedByNonce = [...bets].sort((a, b) => b.nonce - a.nonce);
    const latestNonce = sortedByNonce[0]?.nonce || 0;
    const secondLatestNonce = sortedByNonce[1]?.nonce || 0;
    const latestGap = secondLatestNonce > 0 ? latestNonce - secondLatestNonce : 0;

    return {
      highestMultiplier,
      hitsCount,
      hitRate,
      hitRateEMA: hitRate, // Will be updated by EMA calculator
      latestNonce,
      latestGap,
      lastHitDistance: latestGap,
      streamDurationSeconds
    };
  }, []);

  /**
   * Update analytics state from new tail data
   */
  const updateFromTail = useCallback((newBets: BetRecord[]) => {
    if (newBets.length === 0) return;

    const calculators = calculatorsRef.current;
    const now = new Date();

    setState(prevState => {
      const updatedBets = [...prevState.bets, ...newBets];
      const newLastId = Math.max(...newBets.map(bet => bet.id));

      // Update stream start time if this is the first data
      const streamStartTime = prevState.streamStartTime || now;
      const streamDurationSeconds = (now.getTime() - streamStartTime.getTime()) / 1000;

      // Calculate incremental updates for all-time stats (always use all bets)
      let allTimeHighestMultiplier = prevState.kpis.highestMultiplier;
      let latestNonce = prevState.kpis.latestNonce;
      let latestGap = prevState.kpis.latestGap;
      const newTopPeaks = [...prevState.topPeaks];
      const newLastNonceByMultiplier = new Map(prevState.lastNonceByMultiplier);
      const newAlerts: AlertEvent[] = [];

      // Process each new bet for all-time calculations
      for (const bet of newBets) {
        // Update all-time highest multiplier
        if (bet.payout_multiplier > allTimeHighestMultiplier) {
          allTimeHighestMultiplier = bet.payout_multiplier;
        }

        // Update latest nonce and gap (always from all bets)
        if (bet.nonce > latestNonce) {
          latestGap = latestNonce > 0 ? bet.nonce - latestNonce : 0;
          latestNonce = bet.nonce;
        }

        // Update density buckets (always from all bets)
        calculators.densityManager.incrementBucket(bet.nonce);

        // Update rolling window (always from all bets)
        calculators.rollingWindow.update(bet.payout_multiplier, new Date(bet.date_time));

        // Update all-time multiplier stats (always from all bets)
        calculators.allTimeMultiplierStats.update(bet.payout_multiplier);

        // Update pinned multiplier stats
        const tolerance = 1e-9;
        let pinnedMultipliersUpdated = false;
        const pinnedMap = prevState.pinnedMultipliers instanceof Map ? prevState.pinnedMultipliers : new Map<number, PinnedMultiplier>();
        for (const [multiplier, pinnedData] of pinnedMap) {
          if (Math.abs(bet.payout_multiplier - multiplier) <= tolerance) {
            const lastNonce = newLastNonceByMultiplier.get(multiplier) || 0;
            const gap = lastNonce > 0 ? bet.nonce - lastNonce : 0;

            if (gap > 0) {
              pinnedData.stats.count++;
              pinnedData.stats.lastNonce = bet.nonce;
              pinnedData.stats.lastGap = gap;
              pinnedData.stats.ringBuffer.push(gap);

              // Update Welford stats (would need to maintain separate calculators per multiplier)
              // For now, we'll approximate
              const prevMean = pinnedData.stats.meanGap;
              const count = pinnedData.stats.count;
              pinnedData.stats.meanGap = (prevMean * (count - 1) + gap) / count;

              // Update standard deviation approximation
              const gaps = pinnedData.stats.ringBuffer.toArray();
              if (gaps.length > 1) {
                const mean = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
                const variance = gaps.reduce((sum, g) => sum + Math.pow(g - mean, 2), 0) / (gaps.length - 1);
                pinnedData.stats.stdGap = Math.sqrt(variance);

                // Approximate p90 from ring buffer
                const sortedGaps = [...gaps].sort((a, b) => a - b);
                const p90Index = Math.floor(sortedGaps.length * 0.9);
                pinnedData.stats.p90Gap = sortedGaps[p90Index] || 0;
              }

              if (gap > pinnedData.stats.maxGap) {
                pinnedData.stats.maxGap = gap;
              }

              pinnedMultipliersUpdated = true;
            }

            newLastNonceByMultiplier.set(multiplier, bet.nonce);
          }
        }

        // Save updated pinned multipliers to session storage if any were updated
        if (pinnedMultipliersUpdated) {
          const keys = Array.from(pinnedMap.keys());
          savePinnedMultipliers(streamId, keys);
        }

        // Update top peaks (keep top 20)
        if (bet.payout_multiplier >= 2.0) { // Only track significant multipliers
          newTopPeaks.push({
            multiplier: bet.payout_multiplier,
            nonce: bet.nonce,
            timestamp: new Date(bet.date_time),
            id: bet.id
          });

          // Sort and keep top 20
          newTopPeaks.sort((a, b) => b.multiplier - a.multiplier);
          if (newTopPeaks.length > 20) {
            newTopPeaks.splice(20);
          }
        }

        // Check alerts
        const multiplierStatsMap = new Map();
        for (const [multiplier, pinnedData] of pinnedMap) {
          multiplierStatsMap.set(multiplier, {
            count: pinnedData.stats.count,
            lastGap: pinnedData.stats.lastGap,
            meanGap: pinnedData.stats.meanGap,
            stdGap: pinnedData.stats.stdGap,
            p90Gap: pinnedData.stats.p90Gap
          });
        }

        const alertsForBet = calculators.alertEngine.checkAlerts(bet, multiplierStatsMap);
        newAlerts.push(...alertsForBet);

        // Update client-side distance calculation if not provided by server
        if (!bet.distance_prev_opt) {
          const lastNonceForMultiplier = newLastNonceByMultiplier.get(bet.payout_multiplier);
          if (lastNonceForMultiplier) {
            bet.distance_prev_opt = bet.nonce - lastNonceForMultiplier;
          }
          newLastNonceByMultiplier.set(bet.payout_multiplier, bet.nonce);
        }
      }

      // Calculate KPIs based on filter settings
      let kpis: LiveKPIs;
      if (prevState.filters.applyFiltersToKPIs) {
        // Calculate KPIs from filtered data
        const filteredBets = updatedBets.filter(bet =>
          betPassesFilters(bet, prevState.filters, (prevState.pinnedMultipliers instanceof Map ? prevState.pinnedMultipliers : new Map()))
        );
        kpis = calculateKPIsFromBets(filteredBets, streamStartTime, streamDurationSeconds);
        // Update EMA with filtered hit rate
        kpis.hitRateEMA = calculators.hitRateEMA.update(kpis.hitRate);
      } else {
        // Calculate KPIs from all data (default behavior)
        const allTimeHitsCount = prevState.kpis.hitsCount + newBets.length;
        const allTimeHitRate = streamDurationSeconds > 0 ? (allTimeHitsCount * 60) / streamDurationSeconds : 0;
        const hitRateEMA = calculators.hitRateEMA.update(allTimeHitRate);

        kpis = {
          highestMultiplier: allTimeHighestMultiplier,
          hitsCount: allTimeHitsCount,
          hitRate: allTimeHitRate,
          hitRateEMA,
          latestNonce,
          latestGap,
          lastHitDistance: latestGap, // For now, same as latestGap
          streamDurationSeconds
        };
      }

      // Get rolling window stats
      const rollingWindowStats = calculators.rollingWindow.getStats();
      const allTimeStats = calculators.allTimeMultiplierStats.stats;
      const deviationFromAllTime = allTimeStats.stddev > 0 ?
        (rollingWindowStats.mean - allTimeStats.mean) / allTimeStats.stddev : 0;

      return {
        ...prevState,
        bets: updatedBets,
        lastId: newLastId,
        kpis,
        recentAlerts: [...prevState.recentAlerts, ...newAlerts].slice(-100), // Keep last 100
        rollingStats: {
          mean: rollingWindowStats.mean,
          max: rollingWindowStats.max,
          hitRate: rollingWindowStats.hitRate,
          count: rollingWindowStats.count,
          deviationFromAllTime
        },
        topPeaks: newTopPeaks,
        densityData: {
          buckets: calculators.densityManager.getDensityData().buckets,
          bucketSize: calculators.densityManager.currentBucketSize,
          maxCount: calculators.densityManager.currentMaxCount
        },
        lastNonceByMultiplier: newLastNonceByMultiplier,
        streamStartTime,
        isLive: true
      };
    });
  }, [betPassesFilters, calculateKPIsFromBets, streamId]);

  /**
   * Pin a multiplier for tracking
   */
  const pinMultiplier = useCallback((multiplier: number) => {
    setState(prevState => {
      const newPinnedMultipliers = new Map(prevState.pinnedMultipliers);

      if (!newPinnedMultipliers.has(multiplier)) {
        newPinnedMultipliers.set(multiplier, {
          multiplier,
          tolerance: 1e-9,
          stats: {
            count: 0,
            lastNonce: 0,
            lastGap: 0,
            meanGap: 0,
            stdGap: 0,
            maxGap: 0,
            p90Gap: 0,
            p99Gap: 0,
            ringBuffer: new RingBuffer<number>(50),
            eta: {
              value: 0,
              model: 'observed'
            }
          },
          alerts: []
        });

        // Save to session storage
        savePinnedMultipliers(streamId, Array.from(newPinnedMultipliers.keys()));
      }

      return {
        ...prevState,
        pinnedMultipliers: newPinnedMultipliers
      };
    });
  }, [streamId]);

  /**
   * Unpin a multiplier
   */
  const unpinMultiplier = useCallback((multiplier: number) => {
    setState(prevState => {
      const newPinnedMultipliers = new Map(prevState.pinnedMultipliers);
      newPinnedMultipliers.delete(multiplier);

      // Save to session storage
      savePinnedMultipliers(streamId, Array.from(newPinnedMultipliers.keys()));

      return {
        ...prevState,
        pinnedMultipliers: newPinnedMultipliers
      };
    });
  }, [streamId]);

  /**
   * Configure an alert rule
   */
  const configureAlert = useCallback((rule: AlertRule) => {
    calculatorsRef.current.alertEngine.addRule(rule);
  }, []);

  /**
   * Update filters and recalculate KPIs if needed
   */
  const updateFilters = useCallback((filters: Partial<DashboardFilters>) => {
    setState(prevState => {
      const newFilters = { ...prevState.filters, ...filters };

      // If applyFiltersToKPIs changed or other filter settings changed while applyFiltersToKPIs is true,
      // recalculate KPIs
      let newKpis = prevState.kpis;
      if (newFilters.applyFiltersToKPIs !== prevState.filters.applyFiltersToKPIs ||
          (newFilters.applyFiltersToKPIs && (
            newFilters.minMultiplier !== prevState.filters.minMultiplier ||
            newFilters.showOnlyPinned !== prevState.filters.showOnlyPinned
          ))) {

        const streamDurationSeconds = prevState.streamStartTime
          ? (Date.now() - prevState.streamStartTime.getTime()) / 1000
          : 0;

        if (newFilters.applyFiltersToKPIs) {
          // Recalculate KPIs from filtered data
          const filteredBets = prevState.bets.filter(bet =>
            betPassesFilters(bet, newFilters, prevState.pinnedMultipliers)
          );
          newKpis = calculateKPIsFromBets(filteredBets, prevState.streamStartTime, streamDurationSeconds);
          // Keep the EMA from the calculator
          newKpis.hitRateEMA = prevState.kpis.hitRateEMA;
        } else {
          // Recalculate KPIs from all data
          newKpis = calculateKPIsFromBets(prevState.bets, prevState.streamStartTime, streamDurationSeconds);
          // Keep the EMA from the calculator
          newKpis.hitRateEMA = prevState.kpis.hitRateEMA;
        }
      }

      return {
        ...prevState,
        filters: newFilters,
        kpis: newKpis
      };
    });
  }, [betPassesFilters, calculateKPIsFromBets]);

  /**
   * Configure rolling window
   */
  const configureRollingWindow = useCallback((type: 'time' | 'count', size: number) => {
    calculatorsRef.current.rollingWindow.configure(type, size);
  }, []);

  return {
    state,
    updateFromTail,
    pinMultiplier,
    unpinMultiplier,
    configureAlert,
    updateFilters,
    configureRollingWindow
  };
}
