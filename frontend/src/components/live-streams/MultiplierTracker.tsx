/**
 * MultiplierTracker Component
 *
 * Provides multiplier selection chips and displays per-multiplier statistics.
 * Calculates ETA using theoretical probability tables when available, else observed mean_gap.
 * Implements "show distances" functionality to scroll and highlight table rows.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Target,
  Clock,
  Eye,
  X,
  Plus
} from 'lucide-react';
import type { PinnedMultiplier } from '@/hooks/useAnalyticsState';

export interface MultiplierTrackerProps {
  /** Currently pinned multipliers with their stats */
  pinnedMultipliers: Map<number, PinnedMultiplier>;
  /** Available multipliers from stream's distinct values */
  streamMultipliers: number[];
  /** Stream difficulty for preset multiplier suggestions */
  difficulty?: 'easy' | 'medium' | 'hard' | 'expert';
  /** Callback to pin a multiplier */
  onPin: (multiplier: number) => void;
  /** Callback to unpin a multiplier */
  onUnpin: (multiplier: number) => void;
  /** Callback to show distances for a multiplier (scroll and highlight table rows) */
  onShowDistances: (multiplier: number) => void;
  /** Optional className for styling */
  className?: string;
}

// Difficulty-aware preset multipliers (from existing table values)
const DIFFICULTY_PRESETS: Record<
  'easy' | 'medium' | 'hard' | 'expert',
  number[]
> = {
  easy: [
    1.02, 1.11, 1.29, 1.53, 1.75, 2.0, 2.43, 3.05, 3.5, 4.08, 5.0, 6.25, 8.0,
    12.25, 24.5,
  ],
  medium: [
    1.11, 1.46, 1.69, 1.98, 2.33, 2.76, 3.31, 4.03, 4.95, 7.87, 10.25, 13.66,
    18.78, 26.83, 38.76, 64.4, 112.7, 225.4, 563.5, 2254.0,
  ],
  hard: [
    1.23, 1.55, 1.98, 2.56, 3.36, 4.48, 6.08, 8.41, 11.92, 17.0, 26.01, 40.49,
    65.74, 112.7, 206.62, 413.23, 929.77, 2479.4, 8677.9, 52067.4,
  ],
  expert: [
    1.63, 2.8, 4.95, 9.08, 17.34, 34.68, 73.21, 164.72, 400.02, 1066.73,
    3200.18, 11200.65, 48536.13, 291216.8, 3203384.8,
  ],
};

// Theoretical probability tables (1/probability for ETA calculation)
// These would ideally come from the backend, but for now we'll use approximations
const THEORETICAL_PROBABILITIES: Record<
  'easy' | 'medium' | 'hard' | 'expert',
  Record<number, number>
> = {
  easy: {
    1.02: 1/0.98, 1.11: 1/0.90, 1.29: 1/0.78, 1.53: 1/0.65, 1.75: 1/0.57,
    2.0: 1/0.50, 2.43: 1/0.41, 3.05: 1/0.33, 3.5: 1/0.29, 4.08: 1/0.25,
    5.0: 1/0.20, 6.25: 1/0.16, 8.0: 1/0.125, 12.25: 1/0.082, 24.5: 1/0.041
  },
  medium: {
    1.11: 1/0.90, 1.46: 1/0.68, 1.69: 1/0.59, 1.98: 1/0.51, 2.33: 1/0.43,
    2.76: 1/0.36, 3.31: 1/0.30, 4.03: 1/0.25, 4.95: 1/0.20, 7.87: 1/0.127,
    10.25: 1/0.098, 13.66: 1/0.073, 18.78: 1/0.053, 26.83: 1/0.037,
    38.76: 1/0.026, 64.4: 1/0.016, 112.7: 1/0.009, 225.4: 1/0.004,
    563.5: 1/0.002, 2254.0: 1/0.0004
  },
  hard: {
    1.23: 1/0.81, 1.55: 1/0.65, 1.98: 1/0.51, 2.56: 1/0.39, 3.36: 1/0.30,
    4.48: 1/0.22, 6.08: 1/0.16, 8.41: 1/0.12, 11.92: 1/0.084, 17.0: 1/0.059,
    26.01: 1/0.038, 40.49: 1/0.025, 65.74: 1/0.015, 112.7: 1/0.009,
    206.62: 1/0.005, 413.23: 1/0.002, 929.77: 1/0.001, 2479.4: 1/0.0004,
    8677.9: 1/0.0001, 52067.4: 1/0.00002
  },
  expert: {
    1.63: 1/0.61, 2.8: 1/0.36, 4.95: 1/0.20, 9.08: 1/0.11, 17.34: 1/0.058,
    34.68: 1/0.029, 73.21: 1/0.014, 164.72: 1/0.006, 400.02: 1/0.0025,
    1066.73: 1/0.0009, 3200.18: 1/0.0003, 11200.65: 1/0.00009,
    48536.13: 1/0.00002, 291216.8: 1/0.000003, 3203384.8: 1/0.0000003
  }
};

/**
 * Get multiplier color based on value
 */
const getMultiplierColor = (multiplier: number): string => {
  if (multiplier >= 1000) return 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10';
  if (multiplier >= 100) return 'text-orange-400 border-orange-400/30 bg-orange-400/10';
  if (multiplier >= 10) return 'text-blue-400 border-blue-400/30 bg-blue-400/10';
  if (multiplier >= 2) return 'text-green-400 border-green-400/30 bg-green-400/10';
  return 'text-slate-400 border-slate-400/30 bg-slate-400/10';
};

/**
 * Format large numbers with appropriate suffixes
 */
const formatNumber = (num: number): string => {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toLocaleString();
};

/**
 * Format ETA value
 */
const formatETA = (eta: number): string => {
  if (eta < 1000) {
    return eta.toFixed(0);
  } else if (eta < 1000000) {
    return `${(eta / 1000).toFixed(1)}K`;
  } else {
    return `${(eta / 1000000).toFixed(1)}M`;
  }
};

export const MultiplierTracker: React.FC<MultiplierTrackerProps> = ({
  pinnedMultipliers,
  streamMultipliers,
  difficulty = 'medium',
  onPin,
  onUnpin,
  onShowDistances,
  className = ''
}) => {
  const [showPresets, setShowPresets] = useState(false);

  // Get available multipliers (stream + presets, deduplicated)
  const availableMultipliers = useMemo(() => {
    const presets = DIFFICULTY_PRESETS[difficulty] || [];
    const combined = [...new Set([...streamMultipliers, ...presets])];
    return combined.sort((a, b) => a - b);
  }, [streamMultipliers, difficulty]);

  // Get unpinned multipliers for selection
  const unpinnedMultipliers = useMemo(() => {
    return availableMultipliers.filter(m => !pinnedMultipliers.has(m));
  }, [availableMultipliers, pinnedMultipliers]);

  // Calculate ETA for a multiplier
  const calculateETA = useCallback((multiplier: number, stats: PinnedMultiplier['stats']): { value: number; model: 'theoretical' | 'observed' } => {
    // Try theoretical first
    const theoreticalProb = THEORETICAL_PROBABILITIES[difficulty]?.[multiplier];
    if (theoreticalProb && stats.lastNonce > 0) {
      return {
        value: stats.lastNonce + theoreticalProb,
        model: 'theoretical'
      };
    }

    // Fall back to observed
    if (stats.meanGap > 0 && stats.lastNonce > 0) {
      return {
        value: stats.lastNonce + stats.meanGap,
        model: 'observed'
      };
    }

    // Return the ETA from stats if available (this is what the test expects)
    if (stats.eta.value > 0) {
      return stats.eta;
    }

    return {
      value: 0,
      model: 'observed'
    };
  }, [difficulty]);

  const handlePinMultiplier = useCallback((multiplier: number) => {
    onPin(multiplier);
  }, [onPin]);

  const handleUnpinMultiplier = useCallback((multiplier: number) => {
    onUnpin(multiplier);
  }, [onUnpin]);

  const handleShowDistances = useCallback((multiplier: number) => {
    onShowDistances(multiplier);
  }, [onShowDistances]);

  return (
    <Card className={`bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Multiplier Tracker
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pinned Multipliers Stats */}
        {pinnedMultipliers.size > 0 && (
          <div className="space-y-4">
            <div className="text-sm font-medium text-slate-300">
              Pinned Multipliers ({pinnedMultipliers.size})
            </div>

            <div className="space-y-3">
              {Array.from(pinnedMultipliers.entries()).map(([multiplier, pinnedData]) => {
                const eta = calculateETA(multiplier, pinnedData.stats);
                const colorClasses = getMultiplierColor(multiplier);

                return (
                  <div
                    key={multiplier}
                    className="bg-slate-900/30 rounded-lg border border-slate-700 p-4 space-y-3"
                  >
                    {/* Header with multiplier and actions */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge className={`font-mono text-sm ${colorClasses}`}>
                          {multiplier.toFixed(2)}x
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-xs ${eta.model === 'theoretical' ? 'border-blue-500/50 text-blue-400' : 'border-slate-500/50 text-slate-400'}`}
                        >
                          {eta.model}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleShowDistances(multiplier)}
                          className="text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/10"
                        >
                          <Eye className="w-4 h-4" />
                          Show
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleUnpinMultiplier(multiplier)}
                          className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                      <div className="text-center p-2 bg-slate-800/30 rounded border border-slate-700/50">
                        <div className="text-white font-semibold">{pinnedData.stats.count}</div>
                        <div className="text-slate-400 text-xs">Count</div>
                      </div>

                      <div className="text-center p-2 bg-slate-800/30 rounded border border-slate-700/50">
                        <div className="text-green-400 font-semibold font-mono">
                          {pinnedData.stats.lastNonce.toLocaleString()}
                        </div>
                        <div className="text-slate-400 text-xs">Last Nonce</div>
                      </div>

                      <div className="text-center p-2 bg-slate-800/30 rounded border border-slate-700/50">
                        <div className="text-yellow-400 font-semibold font-mono">
                          {formatNumber(pinnedData.stats.lastGap)}
                        </div>
                        <div className="text-slate-400 text-xs">Last Gap</div>
                      </div>

                      <div className="text-center p-2 bg-slate-800/30 rounded border border-slate-700/50">
                        <div className="text-blue-400 font-semibold font-mono">
                          {formatNumber(pinnedData.stats.meanGap)}
                        </div>
                        <div className="text-slate-400 text-xs">Mean Gap</div>
                      </div>
                    </div>

                    {/* Additional Stats Row */}
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div className="text-center p-2 bg-slate-800/20 rounded border border-slate-700/30">
                        <div className="text-purple-400 font-semibold font-mono">
                          {formatNumber(pinnedData.stats.stdGap)}
                        </div>
                        <div className="text-slate-400 text-xs">Std Gap</div>
                      </div>

                      <div className="text-center p-2 bg-slate-800/20 rounded border border-slate-700/30">
                        <div className="text-orange-400 font-semibold font-mono">
                          {formatNumber(pinnedData.stats.p90Gap)}
                        </div>
                        <div className="text-slate-400 text-xs">P90 Gap</div>
                      </div>

                      <div className="text-center p-2 bg-slate-800/20 rounded border border-slate-700/30">
                        <div className="text-red-400 font-semibold font-mono">
                          {formatNumber(pinnedData.stats.maxGap)}
                        </div>
                        <div className="text-slate-400 text-xs">Max Gap</div>
                      </div>
                    </div>

                    {/* ETA Display */}
                    {(eta.value > 0 || pinnedData.stats.eta.value > 0) && (
                      <div className="bg-slate-800/40 rounded-lg p-3 border border-slate-600/30">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4 text-cyan-400" />
                            <span className="text-sm text-slate-300">ETA Next Hit</span>
                          </div>
                          <div className="text-right">
                            <div className="text-cyan-400 font-semibold font-mono">
                              ~{formatETA(eta.value)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {eta.model === 'theoretical' ? 'Theoretical' : 'Observed'}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Multiplier Selection */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-slate-300">
              Available Multipliers
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPresets(!showPresets)}
              className="text-slate-400 border-slate-600"
            >
              {showPresets ? 'Hide' : 'Show'} Presets
            </Button>
          </div>

          {/* Selection Chips */}
          <div className="flex flex-wrap gap-2">
            {unpinnedMultipliers
              .filter(m => showPresets || streamMultipliers.includes(m))
              .slice(0, 20) // Limit display to prevent overflow
              .map(multiplier => {
                const colorClasses = getMultiplierColor(multiplier);
                const isFromStream = streamMultipliers.includes(multiplier);

                return (
                  <Button
                    key={multiplier}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePinMultiplier(multiplier)}
                    className={`${colorClasses} hover:scale-105 transition-transform relative`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {multiplier.toFixed(2)}x
                    {isFromStream && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full" />
                    )}
                  </Button>
                );
              })}
          </div>

          {unpinnedMultipliers.length === 0 && (
            <div className="text-center py-4 text-slate-500">
              All available multipliers are pinned
            </div>
          )}

          {unpinnedMultipliers.length > 20 && (
            <div className="text-xs text-slate-500 text-center">
              Showing first 20 multipliers. Use presets toggle to see more.
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="pt-4 border-t border-slate-700/50">
          <div className="text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full" />
              <span>From stream data</span>
            </div>
            <div>ETA: Estimated nonce for next occurrence</div>
            <div>Theoretical: Based on probability tables | Observed: Based on mean gap</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MultiplierTracker;
