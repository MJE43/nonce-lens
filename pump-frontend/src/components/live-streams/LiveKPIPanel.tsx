/**
 * LiveKPIPanel Component
 * 
 * Displays real-time KPIs that update incrementally from tail appends.
 * Supports "Freeze UI" mode that continues stats updates while stopping auto-scroll.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Activity, 
  TrendingUp, 
  Hash, 
  Clock, 
  Zap,
  Pause,
  Play,
  Snowflake
} from 'lucide-react';
import type { LiveKPIs } from '@/hooks/useAnalyticsState';

export interface LiveKPIPanelProps {
  /** Live KPI data */
  kpis: LiveKPIs;
  /** Whether the stream is currently live */
  isLive: boolean;
  /** Stream start time for duration calculation */
  streamStartTime: Date | null;
  /** Whether UI is frozen (stats continue updating but auto-scroll stops) */
  freezeUI: boolean;
  /** Callback to toggle freeze UI mode */
  onToggleFreezeUI: (frozen: boolean) => void;
  /** Whether filters should be applied to KPI calculations */
  applyFiltersToKPIs: boolean;
  /** Callback to toggle filter application to KPIs */
  onToggleApplyFilters: (apply: boolean) => void;
  /** Optional className for styling */
  className?: string;
}

/**
 * Format duration in seconds to human readable format
 */
const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}m ${remainingSeconds}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }
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
 * Get multiplier color based on value
 */
const getMultiplierColor = (multiplier: number): string => {
  if (multiplier >= 1000) return 'text-yellow-400';
  if (multiplier >= 100) return 'text-orange-400';
  if (multiplier >= 10) return 'text-blue-400';
  if (multiplier >= 2) return 'text-green-400';
  return 'text-slate-400';
};

export const LiveKPIPanel: React.FC<LiveKPIPanelProps> = ({
  kpis,
  isLive,
  streamStartTime,
  freezeUI,
  onToggleFreezeUI,
  applyFiltersToKPIs,
  onToggleApplyFilters,
  className = ''
}) => {
  return (
    <Card className={`bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl ${className}`}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Live KPIs
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* Live Status Indicator */}
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
              <span className={`text-sm ${isLive ? 'text-green-400' : 'text-red-400'}`}>
                {isLive ? 'Live' : 'Offline'}
              </span>
            </div>
            
            {/* Freeze UI Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onToggleFreezeUI(!freezeUI)}
              className={`flex items-center gap-2 ${
                freezeUI ? 'bg-blue-600/20 border-blue-500 text-blue-400' : ''
              }`}
            >
              {freezeUI ? (
                <>
                  <Snowflake className="w-4 h-4" />
                  Frozen
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Live
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Primary KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {/* Highest Multiplier */}
          <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
            <div className={`text-2xl font-bold ${getMultiplierColor(kpis.highestMultiplier)}`}>
              {kpis.highestMultiplier.toFixed(2)}x
            </div>
            <div className="text-sm text-slate-400">Highest Multiplier</div>
          </div>
          
          {/* Hits Count */}
          <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-white">
              {formatNumber(kpis.hitsCount)}
            </div>
            <div className="text-sm text-slate-400">Total Hits</div>
          </div>
          
          {/* Hit Rate */}
          <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
            <div className="text-2xl font-bold text-blue-400">
              {kpis.hitRate.toFixed(1)}
            </div>
            <div className="text-sm text-slate-400">Hits/min</div>
          </div>
        </div>

        {/* Secondary KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* EMA Hit Rate */}
          <div className="text-center p-3 bg-slate-900/20 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <TrendingUp className="w-4 h-4 text-purple-400" />
              <div className="text-lg font-semibold text-purple-400">
                {kpis.hitRateEMA.toFixed(1)}
              </div>
            </div>
            <div className="text-xs text-slate-400">30s EMA</div>
          </div>
          
          {/* Latest Nonce */}
          <div className="text-center p-3 bg-slate-900/20 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Hash className="w-4 h-4 text-green-400" />
              <div className="text-lg font-semibold text-green-400 font-mono">
                {kpis.latestNonce.toLocaleString()}
              </div>
            </div>
            <div className="text-xs text-slate-400">Latest Nonce</div>
          </div>
          
          {/* Latest Gap */}
          <div className="text-center p-3 bg-slate-900/20 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="w-4 h-4 text-yellow-400" />
              <div className="text-lg font-semibold text-yellow-400 font-mono">
                {kpis.latestGap.toLocaleString()}
              </div>
            </div>
            <div className="text-xs text-slate-400">Latest Gap</div>
          </div>
          
          {/* Stream Duration */}
          <div className="text-center p-3 bg-slate-900/20 rounded-lg border border-slate-700/50">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Clock className="w-4 h-4 text-cyan-400" />
              <div className="text-lg font-semibold text-cyan-400">
                {formatDuration(kpis.streamDurationSeconds)}
              </div>
            </div>
            <div className="text-xs text-slate-400">Duration</div>
          </div>
        </div>

        {/* Controls Section */}
        <div className="pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Switch
                id="apply-filters-kpis"
                checked={applyFiltersToKPIs}
                onCheckedChange={onToggleApplyFilters}
              />
              <Label 
                htmlFor="apply-filters-kpis" 
                className="text-sm text-slate-300 cursor-pointer"
              >
                Apply filters to KPIs
              </Label>
            </div>
            
            {applyFiltersToKPIs && (
              <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                Filtered
              </Badge>
            )}
          </div>
          
          <div className="mt-2 text-xs text-slate-500">
            {applyFiltersToKPIs 
              ? "KPIs calculated from filtered data only"
              : "KPIs calculated from all stream data"
            }
          </div>
        </div>

        {/* Freeze UI Info */}
        {freezeUI && (
          <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-3">
            <div className="flex items-center gap-2 text-blue-400 text-sm">
              <Snowflake className="w-4 h-4" />
              <span className="font-medium">UI Frozen</span>
            </div>
            <div className="text-xs text-blue-300/70 mt-1">
              Statistics continue updating while auto-scroll is paused
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default LiveKPIPanel;