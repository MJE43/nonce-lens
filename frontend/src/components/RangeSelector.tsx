/**
 * Range Selector Component
 * 
 * Dropdown component for quick range selection in hit-centric analysis
 * Requirements: 5.1, 5.5
 */

import React, { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface RangeSelectorProps {
  /** Current nonce range [start, end] */
  currentRange: [number, number];
  /** Maximum nonce available in the stream */
  maxNonce: number;
  /** Range size in nonces */
  rangeSize: number;
  /** Callback when range changes */
  onRangeChange: (range: [number, number]) => void;
  /** Whether the selector is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Size variant */
  size?: 'sm' | 'default';
}

export const RangeSelector: React.FC<RangeSelectorProps> = ({
  currentRange,
  maxNonce,
  rangeSize,
  onRangeChange,
  disabled = false,
  className,
  placeholder = "Select range",
  size = "default",
}) => {
  const [currentStart] = currentRange;

  // Generate range options
  const rangeOptions = useMemo(() => {
    const options: Array<{ value: string; label: string; start: number; end: number }> = [];
    const totalRanges = Math.ceil(maxNonce / rangeSize);
    
    // For large datasets, show every nth range to keep dropdown manageable
    const step = totalRanges > 50 ? Math.max(1, Math.floor(totalRanges / 50)) : 1;
    
    for (let i = 0; i < totalRanges; i += step) {
      const start = i * rangeSize;
      const end = Math.min(start + rangeSize, maxNonce);
      
      // Format labels with k suffix for thousands
      const startLabel = start >= 1000 ? `${(start / 1000).toFixed(0)}k` : start.toString();
      const endLabel = end >= 1000 ? `${(end / 1000).toFixed(0)}k` : end.toString();
      
      options.push({
        value: start.toString(),
        label: `${startLabel}–${endLabel}`,
        start,
        end,
      });
    }
    
    return options;
  }, [maxNonce, rangeSize]);

  // Handle range selection
  const handleRangeSelect = (startNonce: string) => {
    const start = parseInt(startNonce, 10);
    if (!isNaN(start)) {
      const end = Math.min(start + rangeSize, maxNonce);
      onRangeChange([start, end]);
    }
  };

  // Find current selection
  const currentValue = currentStart.toString();
  const currentOption = rangeOptions.find(option => option.value === currentValue);
  
  return (
    <Select
      value={currentValue}
      onValueChange={handleRangeSelect}
      disabled={disabled}
    >
      <SelectTrigger size={size} className={cn("min-w-32", className)}>
        <SelectValue placeholder={placeholder}>
          {currentOption ? currentOption.label : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {rangeOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <div className="flex items-center justify-between w-full">
              <span>{option.label}</span>
              <span className="text-xs text-muted-foreground ml-2">
                ({option.start.toLocaleString()}–{option.end.toLocaleString()})
              </span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default RangeSelector;