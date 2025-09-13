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
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BucketStats } from '@/lib/analysisMath';
import { StatisticsDisplay } from './StatisticsDisplay';
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
  stats,
  pinnedBuckets,
  statsByPinnedBuckets,
  onPinnedBucketsChange,
  scopeLabel,
  disabled = false,
  className,
}) => {



  // Handle mode toggle
  const handleModeToggle = useCallback((checked: boolean) => {
    onModeChange(checked ? 'analysis' : 'live');
  }, [onModeChange]);



  // Handle exit analysis
  const handleExitAnalysis = useCallback(() => {
    onModeChange('live');
  }, [onModeChange]);

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
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mode, disabled, handleExitAnalysis]);

  // Format focused bucket display
  const formatBucket = (bucket: number): string => {
    if (bucket >= 1000) {
      return `${(bucket / 1000).toFixed(1)}kx`;
    }
    return `${bucket}x`;
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

          {/* Right side: Exit button */}
          {mode === 'analysis' && (
            <div className="flex items-center gap-2">
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