/**
 * PinnedChipsContainer Component
 * 
 * Container component to manage multiple pinned multiplier chips
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Plus, Pin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BucketStats, bucketMultiplier } from '@/lib/analysisMath';
import { MultiplierChip } from './MultiplierChip';

export interface PinnedChipsContainerProps {
  /** Array of pinned bucket multipliers */
  pinnedBuckets: number[];
  /** Pre-computed statistics for all pinned buckets */
  statsByPinnedBuckets: Record<string, BucketStats>;
  /** Currently focused bucket */
  focusedBucket: number | null;
  /** Whether the container is disabled */
  disabled?: boolean;
  /** Callback when a chip is clicked to focus */
  onFocusChange?: (bucket: number | null) => void;
  /** Callback when pinned buckets change */
  onPinnedBucketsChange?: (buckets: number[]) => void;
  /** Additional CSS classes */
  className?: string;
}

// Session storage key for persistence
const PINNED_BUCKETS_STORAGE_KEY = 'analysis-pinned-buckets';

export const PinnedChipsContainer: React.FC<PinnedChipsContainerProps> = ({
  pinnedBuckets,
  statsByPinnedBuckets,
  focusedBucket,
  disabled = false,
  onFocusChange,
  onPinnedBucketsChange,
  className,
}) => {
  const [newBucketInput, setNewBucketInput] = useState('');
  const [showAddPopover, setShowAddPopover] = useState(false);

  // Load pinned buckets from session storage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(PINNED_BUCKETS_STORAGE_KEY);
      if (stored && onPinnedBucketsChange) {
        const buckets = JSON.parse(stored) as number[];
        if (Array.isArray(buckets) && buckets.length > 0) {
          // Only load if current pinned buckets is empty (initial load)
          if (pinnedBuckets.length === 0) {
            onPinnedBucketsChange(buckets);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to load pinned buckets from session storage:', error);
    }
  }, [onPinnedBucketsChange, pinnedBuckets.length]);

  // Save pinned buckets to session storage when they change
  useEffect(() => {
    try {
      if (pinnedBuckets.length > 0) {
        sessionStorage.setItem(PINNED_BUCKETS_STORAGE_KEY, JSON.stringify(pinnedBuckets));
      } else {
        sessionStorage.removeItem(PINNED_BUCKETS_STORAGE_KEY);
      }
    } catch (error) {
      console.warn('Failed to save pinned buckets to session storage:', error);
    }
  }, [pinnedBuckets]);

  // Handle adding a new bucket
  const handleAddBucket = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    const value = parseFloat(newBucketInput.trim());
    if (isNaN(value) || value <= 0) {
      return;
    }

    // Normalize the bucket value
    const normalizedBucket = bucketMultiplier(value);
    
    // Check if already pinned
    if (pinnedBuckets.includes(normalizedBucket)) {
      setNewBucketInput('');
      setShowAddPopover(false);
      return;
    }

    // Add to pinned buckets
    if (onPinnedBucketsChange) {
      const newPinnedBuckets = [...pinnedBuckets, normalizedBucket].sort((a, b) => a - b);
      onPinnedBucketsChange(newPinnedBuckets);
    }

    // Reset input and close popover
    setNewBucketInput('');
    setShowAddPopover(false);
  }, [newBucketInput, pinnedBuckets, onPinnedBucketsChange]);

  // Handle removing a bucket
  const handleRemoveBucket = useCallback((bucket: number) => {
    if (onPinnedBucketsChange) {
      const newPinnedBuckets = pinnedBuckets.filter(b => b !== bucket);
      onPinnedBucketsChange(newPinnedBuckets);
    }
  }, [pinnedBuckets, onPinnedBucketsChange]);

  // Handle focusing a bucket
  const handleFocusBucket = useCallback((bucket: number) => {
    if (onFocusChange) {
      // If clicking the same bucket, unfocus it
      if (bucket === focusedBucket) {
        onFocusChange(null);
      } else {
        onFocusChange(bucket);
      }
    }
  }, [focusedBucket, onFocusChange]);

  // Don't render if no pinned buckets and disabled
  if (pinnedBuckets.length === 0 && disabled) {
    return null;
  }

  return (
    <div className={cn("flex items-center gap-2 flex-wrap", className)}>
      {/* Label */}
      {pinnedBuckets.length > 0 && (
        <div className="flex items-center gap-2">
          <Pin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            Pinned:
          </span>
        </div>
      )}

      {/* Pinned chips */}
      {pinnedBuckets.map((bucket) => {
        const bucketKey = bucket.toString();
        const bucketStats = statsByPinnedBuckets[bucketKey];
        const isActive = bucket === focusedBucket;
        
        return (
          <MultiplierChip
            key={bucket}
            bucket={bucket}
            stats={bucketStats}
            isActive={isActive}
            disabled={disabled}
            onFocus={handleFocusBucket}
            onRemove={handleRemoveBucket}
          />
        );
      })}

      {/* Add new bucket button */}
      {!disabled && (
        <Popover open={showAddPopover} onOpenChange={setShowAddPopover}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-dashed"
              title="Add multiplier to pinned"
            >
              <Plus className="h-3 w-3" />
              <span className="text-xs">Add</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64" align="start">
            <form onSubmit={handleAddBucket} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="new-bucket" className="text-sm font-medium">
                  Add Multiplier
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="new-bucket"
                    type="number"
                    value={newBucketInput}
                    onChange={(e) => setNewBucketInput(e.target.value)}
                    placeholder="e.g. 11200"
                    className="flex-1"
                    min={1}
                    step={0.01}
                    autoFocus
                  />
                  <span className="flex items-center text-sm text-muted-foreground">×</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" className="flex-1">
                  Pin
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowAddPopover(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </PopoverContent>
        </Popover>
      )}

      {/* Empty state message */}
      {pinnedBuckets.length === 0 && !disabled && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Pin className="h-4 w-4" />
          <span>No pinned multipliers</span>
        </div>
      )}
    </div>
  );
};

export default PinnedChipsContainer;