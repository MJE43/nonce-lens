/**
 * Range Navigator Component
 * 
 * Provides navigation controls for jumping between nonce ranges in hit-centric analysis
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, SkipBack, SkipForward, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RangeNavigatorProps {
  /** Current nonce range [start, end] */
  currentRange: [number, number];
  /** Maximum nonce available in the stream */
  maxNonce: number;
  /** Callback when range changes */
  onRangeChange: (range: [number, number]) => void;
  /** Range size in nonces (default: 10000) */
  rangeSize?: number;
  /** Available range size options */
  rangeSizeOptions?: number[];
  /** Callback when range size changes */
  onRangeSizeChange?: (size: number) => void;
  /** Whether the navigator is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export const RangeNavigator: React.FC<RangeNavigatorProps> = ({
  currentRange,
  maxNonce,
  onRangeChange,
  rangeSize = 10000,
  rangeSizeOptions = [5000, 10000, 20000],
  onRangeSizeChange,
  disabled = false,
  className,
}) => {
  const [jumpToValue, setJumpToValue] = useState('');
  const [isJumpInputFocused, setIsJumpInputFocused] = useState(false);

  const [currentStart, currentEnd] = currentRange;

  // Calculate navigation state
  const canGoPrev = currentStart > 0;
  const canGoNext = currentEnd < maxNonce;
  const totalRanges = Math.ceil(maxNonce / rangeSize);
  const currentRangeIndex = Math.floor(currentStart / rangeSize);

  // Generate quick range options (every 10 ranges for large datasets)
  const quickRangeOptions = useMemo(() => {
    const options: Array<{ value: number; label: string }> = [];
    const step = totalRanges > 20 ? Math.max(1, Math.floor(totalRanges / 20)) : 1;
    
    for (let i = 0; i < totalRanges; i += step) {
      const start = i * rangeSize;
      const end = Math.min(start + rangeSize, maxNonce);
      const startLabel = start >= 1000 ? `${(start / 1000).toFixed(0)}k` : start.toString();
      const endLabel = end >= 1000 ? `${(end / 1000).toFixed(0)}k` : end.toString();
      
      options.push({
        value: start,
        label: `${startLabel}–${endLabel}`,
      });
    }
    
    return options;
  }, [totalRanges, rangeSize, maxNonce]);

  // Navigation functions
  const goToPrevRange = useCallback(() => {
    if (!canGoPrev || disabled) return;
    const newStart = Math.max(0, currentStart - rangeSize);
    const newEnd = newStart + rangeSize;
    onRangeChange([newStart, newEnd]);
  }, [canGoPrev, disabled, currentStart, rangeSize, onRangeChange]);

  const goToNextRange = useCallback(() => {
    if (!canGoNext || disabled) return;
    const newStart = currentEnd;
    const newEnd = Math.min(newStart + rangeSize, maxNonce);
    onRangeChange([newStart, newEnd]);
  }, [canGoNext, disabled, currentEnd, rangeSize, maxNonce, onRangeChange]);

  const goToFirstRange = useCallback(() => {
    if (disabled) return;
    onRangeChange([0, Math.min(rangeSize, maxNonce)]);
  }, [disabled, rangeSize, maxNonce, onRangeChange]);

  const goToLastRange = useCallback(() => {
    if (disabled) return;
    const lastStart = Math.max(0, Math.floor((maxNonce - 1) / rangeSize) * rangeSize);
    onRangeChange([lastStart, maxNonce]);
  }, [disabled, maxNonce, rangeSize, onRangeChange]);

  const jumpToNonce = useCallback((nonce: number) => {
    if (disabled) return;
    
    // Clamp nonce to valid range
    const clampedNonce = Math.max(0, Math.min(nonce, maxNonce - 1));
    
    // Calculate which range this nonce falls into
    const rangeStart = Math.floor(clampedNonce / rangeSize) * rangeSize;
    const rangeEnd = Math.min(rangeStart + rangeSize, maxNonce);
    
    onRangeChange([rangeStart, rangeEnd]);
  }, [disabled, maxNonce, rangeSize, onRangeChange]);

  const handleJumpToSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const nonce = parseInt(jumpToValue, 10);
    if (!isNaN(nonce)) {
      jumpToNonce(nonce);
      setJumpToValue('');
    }
  }, [jumpToValue, jumpToNonce]);

  const handleJumpButtonClick = useCallback(() => {
    const nonce = parseInt(jumpToValue, 10);
    if (!isNaN(nonce)) {
      jumpToNonce(nonce);
      setJumpToValue('');
    }
  }, [jumpToValue, jumpToNonce]);

  const handleQuickRangeSelect = useCallback((startNonce: string) => {
    const start = parseInt(startNonce, 10);
    if (!isNaN(start)) {
      const end = Math.min(start + rangeSize, maxNonce);
      onRangeChange([start, end]);
    }
  }, [rangeSize, maxNonce, onRangeChange]);

  const handleRangeSizeChange = useCallback((newSize: string) => {
    const size = parseInt(newSize, 10);
    if (!isNaN(size) && onRangeSizeChange) {
      onRangeSizeChange(size);
      // Adjust current range to new size, keeping the start nonce
      const newEnd = Math.min(currentStart + size, maxNonce);
      onRangeChange([currentStart, newEnd]);
    }
  }, [currentStart, maxNonce, onRangeChange, onRangeSizeChange]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when input is focused or if disabled
      if (isJumpInputFocused || disabled) return;
      
      // Don't handle if user is typing in another input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevRange();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNextRange();
          break;
        case 'PageUp':
          e.preventDefault();
          goToPrevRange();
          break;
        case 'PageDown':
          e.preventDefault();
          goToNextRange();
          break;
        case 'Home':
          e.preventDefault();
          goToFirstRange();
          break;
        case 'End':
          e.preventDefault();
          goToLastRange();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isJumpInputFocused,
    disabled,
    goToPrevRange,
    goToNextRange,
    goToFirstRange,
    goToLastRange,
  ]);

  // Format range display
  const formatRange = (start: number, end: number) => {
    const startLabel = start >= 1000 ? `${(start / 1000).toFixed(0)}k` : start.toString();
    const endLabel = end >= 1000 ? `${(end / 1000).toFixed(0)}k` : end.toString();
    return `${startLabel}–${endLabel}`;
  };

  // Progress indicator
  const progressPercentage = totalRanges > 1 ? (currentRangeIndex / (totalRanges - 1)) * 100 : 0;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Main navigation controls */}
      <div className="flex items-center gap-2">
        {/* First/Previous buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToFirstRange}
            disabled={!canGoPrev || disabled}
            title="Go to first range (Home)"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToPrevRange}
            disabled={!canGoPrev || disabled}
            title="Previous range (← or Page Up)"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* Current range display */}
        <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-md min-w-0">
          <span className="text-sm font-medium whitespace-nowrap">
            Range: {formatRange(currentStart, currentEnd)}
          </span>
          <span className="text-xs text-muted-foreground">
            ({currentRangeIndex + 1}/{totalRanges})
          </span>
        </div>

        {/* Next/Last buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={goToNextRange}
            disabled={!canGoNext || disabled}
            title="Next range (→ or Page Down)"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToLastRange}
            disabled={!canGoNext || disabled}
            title="Go to last range (End)"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        </div>

        {/* Range size selector */}
        {onRangeSizeChange && rangeSizeOptions && (
          <Select value={rangeSize.toString()} onValueChange={handleRangeSizeChange} disabled={disabled}>
            <SelectTrigger size="sm" className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rangeSizeOptions.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size >= 1000 ? `${size / 1000}k` : size.toString()}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Progress indicator */}
      <div className="relative">
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-200 ease-out"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1">
          <span>0</span>
          <span>{maxNonce >= 1000 ? `${(maxNonce / 1000).toFixed(0)}k` : maxNonce}</span>
        </div>
      </div>

      {/* Jump to and quick range selector */}
      <div className="flex items-center gap-2">
        {/* Jump to nonce input */}
        <form onSubmit={handleJumpToSubmit} className="flex items-center gap-2">
          <label htmlFor="jump-to-nonce" className="text-sm font-medium whitespace-nowrap">
            Jump to:
          </label>
          <Input
            id="jump-to-nonce"
            type="number"
            placeholder="Nonce"
            value={jumpToValue}
            onChange={(e) => setJumpToValue(e.target.value)}
            onFocus={() => setIsJumpInputFocused(true)}
            onBlur={() => setIsJumpInputFocused(false)}
            disabled={disabled}
            className="w-24"
            min={0}
            max={maxNonce - 1}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleJumpButtonClick}
            disabled={!jumpToValue || disabled}
            title="Jump to nonce"
          >
            <Navigation className="h-4 w-4" />
          </Button>
        </form>

        {/* Quick range selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium whitespace-nowrap">Quick:</span>
          <Select
            value={currentStart.toString()}
            onValueChange={handleQuickRangeSelect}
            disabled={disabled}
          >
            <SelectTrigger size="sm" className="w-32">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {quickRangeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value.toString()}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default RangeNavigator;