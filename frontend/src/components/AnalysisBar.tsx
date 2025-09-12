/**
 * Analysis Bar Component
 * 
 * Sticky analysis bar with mode toggle, controls, and live statistics
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { 
  Play, 
  BarChart3, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  Navigation,
  Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BucketStats } from '@/lib/analysisMath';
import { StatisticsDisplay } from './StatisticsDisplay';
import { RangeNavigator } from './RangeNavigator';
import { PinnedChipsContainer } from './PinnedChipsContainer';

export type AnalysisMode = 'live' | 'analysis';

export interface AnalysisBarProps {
  /** Current analysis mode */
  mode: AnalysisMode;
  /** Callback when mode changes */
  onModeChange: (mode: AnalysisMode) => void;
  /** Currently focused bucket multiplier */
  focusedBucket: number | null;
  /** Callback when focused bucket changes */
  onFocusedBucketChange?: (bucket: number | null) => void;
  /** Current nonce range */
  currentRange: [number, number];
  /** Callback when range changes */
  onRangeChange: (range: [number, number]) => void;
  /** Maximum nonce available */
  maxNonce: number;
  /** Minimum multiplier filter */
  minMultiplier: number;
  /** Callback when min multiplier changes */
  onMinMultiplierChange: (min: number) => void;
  /** Statistics for the focused bucket */
  stats: BucketStats | null;
  /** Pinned bucket multipliers */
  pinnedBuckets: number[];
  /** Statistics for all pinned buckets */
  statsByPinnedBuckets: Record<string, BucketStats>;
  /** Callback when pinned buckets change */
  onPinnedBucketsChange: (buckets: number[]) => void;
  /** Current scope description */
  scopeLabel: string;
  /** Whether the bar is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const AnalysisBar: React.FC<AnalysisBarProps> = ({
  mode,
  onModeChange,
  focusedBucket,
  onFocusedBucketChange,
  currentRange,
  onRangeChange,
  maxNonce,
  minMultiplier,
  onMinMultiplierChange,
  stats,
  pinnedBuckets,
  statsByPinnedBuckets,
  onPinnedBucketsChange,
  scopeLabel,
  disabled = false,
  className,
}) => {
  const [minMultiplierInput, setMinMultiplierInput] = useState(minMultiplier.toString());
  const [showRangeControls, setShowRangeControls] = useState(false);

  // Update input when prop changes
  useEffect(() => {
    setMinMultiplierInput(minMultiplier.toString());
  }, [minMultiplier]);

  // Handle mode toggle
  const handleModeToggle = useCallback((checked: boolean) => {
    onModeChange(checked ? 'analysis' : 'live');
  }, [onModeChange]);

  // Handle min multiplier change
  const handleMinMultiplierSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(minMultiplierInput);
    if (!isNaN(value) && value > 0) {
      onMinMultiplierChange(value);
    } else {
      // Reset to current value if invalid
      setMinMultiplierInput(minMultiplier.toString());
    }
  }, [minMultiplierInput, onMinMultiplierChange, minMultiplier]);

  const handleMinMultiplierBlur = useCallback(() => {
    const value = parseFloat(minMultiplierInput);
    if (!isNaN(value) && value > 0) {
      onMinMultiplierChange(value);
    } else {
      // Reset to current value if invalid
      setMinMultiplierInput(minMultiplier.toString());
    }
  }, [minMultiplierInput, onMinMultiplierChange, minMultiplier]);

  // Handle exit analysis
  const handleExitAnalysis = useCallback(() => {
    onModeChange('live');
  }, [onModeChange]);

  // Handle range navigation shortcuts
  const goToPrevRange = useCallback(() => {
    const [start] = currentRange;
    const rangeSize = currentRange[1] - currentRange[0];
    const newStart = Math.max(0, start - rangeSize);
    const newEnd = newStart + rangeSize;
    onRangeChange([newStart, newEnd]);
  }, [currentRange, onRangeChange]);

  const goToNextRange = useCallback(() => {
    const [, end] = currentRange;
    const rangeSize = currentRange[1] - currentRange[0];
    const newStart = end;
    const newEnd = Math.min(newStart + rangeSize, maxNonce);
    onRangeChange([newStart, newEnd]);
  }, [currentRange, maxNonce, onRangeChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle shortcuts in analysis mode and when not typing in inputs
      if (mode !== 'analysis' || disabled) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'Escape':
          e.preventDefault();
          handleExitAnalysis();
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          goToPrevRange();
          break;
        case 'k':
        case 'K':
          e.preventDefault();
          goToNextRange();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, disabled, handleExitAnalysis, goToPrevRange, goToNextRange]);

  // Format focused bucket display
  const formatBucket = (bucket: number): string => {
    if (bucket >= 1000) {
      return `${(bucket / 1000).toFixed(1)}kx`;
    }
    return `${bucket}x`;
  };

  // Format range display
  const formatRange = (start: number, end: number): string => {
    const startLabel = start >= 1000 ? `${(start / 1000).toFixed(0)}k` : start.toString();
    const endLabel = end >= 1000 ? `${(end / 1000).toFixed(0)}k` : end.toString();
    return `${startLabel}–${endLabel}`;
  };

  return (
    <Card className={cn(
      "sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}>
      <div className="p-4 space-y-4">
        {/* Top row: Mode toggle and main controls */}
        <div className="flex items-center justify-between gap-4">
          {/* Left side: Mode toggle and basic controls */}
          <div className="flex items-center gap-4">
            {/* Mode toggle */}
            <div className="flex items-center gap-2">
              <Play className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="analysis-mode" className="text-sm font-medium">
                Live
              </Label>
              <Switch
                id="analysis-mode"
                checked={mode === 'analysis'}
                onCheckedChange={handleModeToggle}
                disabled={disabled}
              />
              <Label htmlFor="analysis-mode" className="text-sm font-medium">
                Analysis
              </Label>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>

            {/* Min multiplier input (only in analysis mode) */}
            {mode === 'analysis' && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <form onSubmit={handleMinMultiplierSubmit} className="flex items-center gap-2">
                  <Label htmlFor="min-multiplier" className="text-sm font-medium whitespace-nowrap">
                    Min:
                  </Label>
                  <Input
                    id="min-multiplier"
                    type="number"
                    value={minMultiplierInput}
                    onChange={(e) => setMinMultiplierInput(e.target.value)}
                    onBlur={handleMinMultiplierBlur}
                    disabled={disabled}
                    className="w-20 h-8"
                    min={1}
                    step={0.01}
                  />
                  <span className="text-sm text-muted-foreground">×</span>
                </form>
              </>
            )}

            {/* Focused bucket display (only in analysis mode) */}
            {mode === 'analysis' && focusedBucket && (
              <>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Focus:</span>
                  <Badge variant="default" className="font-mono">
                    {formatBucket(focusedBucket)}
                  </Badge>
                </div>
              </>
            )}
          </div>

          {/* Right side: Range controls and exit button */}
          {mode === 'analysis' && (
            <div className="flex items-center gap-2">
              {/* Quick range navigation */}
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToPrevRange}
                  disabled={disabled || currentRange[0] <= 0}
                  title="Previous range (J)"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToNextRange}
                  disabled={disabled || currentRange[1] >= maxNonce}
                  title="Next range (K)"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Range controls toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRangeControls(!showRangeControls)}
                disabled={disabled}
                title="Toggle range controls"
              >
                <Settings className="h-4 w-4" />
              </Button>

              {/* Exit analysis button */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExitAnalysis}
                disabled={disabled}
                title="Exit analysis mode (Escape)"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Scope and statistics row (only in analysis mode) */}
        {mode === 'analysis' && (
          <div className="flex items-center justify-between gap-4">
            {/* Scope indicator */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-xs">
                {scopeLabel}
              </Badge>
            </div>

            {/* Statistics display */}
            {focusedBucket && stats && (
              <div className="flex-1 max-w-md">
                <StatisticsDisplay 
                  stats={stats} 
                  compact 
                  className="justify-end"
                />
              </div>
            )}
          </div>
        )}

        {/* Expanded range controls (when toggled) */}
        {mode === 'analysis' && showRangeControls && (
          <div className="border-t pt-4">
            <RangeNavigator
              currentRange={currentRange}
              maxNonce={maxNonce}
              onRangeChange={onRangeChange}
              disabled={disabled}
            />
          </div>
        )}

        {/* Pinned buckets chips (only in analysis mode) */}
        {mode === 'analysis' && (
          <PinnedChipsContainer
            pinnedBuckets={pinnedBuckets}
            statsByPinnedBuckets={statsByPinnedBuckets}
            focusedBucket={focusedBucket}
            disabled={disabled}
            onFocusChange={onFocusedBucketChange}
            onPinnedBucketsChange={onPinnedBucketsChange}
          />
        )}
      </div>
    </Card>
  );
};

export default AnalysisBar;