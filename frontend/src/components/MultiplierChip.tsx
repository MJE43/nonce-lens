/**
 * MultiplierChip Component
 * 
 * Individual chip component for pinned multipliers with statistics display
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5
 */

import React, { useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { MoreHorizontal, X, Pin, PinOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BucketStats } from '@/lib/analysisMath';

export interface MultiplierChipProps {
  /** The multiplier bucket value */
  bucket: number;
  /** Statistics for this bucket in the current range */
  stats: BucketStats | null;
  /** Whether this chip is currently focused/active */
  isActive?: boolean;
  /** Whether the chip is disabled */
  disabled?: boolean;
  /** Callback when chip is clicked to focus */
  onFocus?: (bucket: number) => void;
  /** Callback when chip should be removed */
  onRemove?: (bucket: number) => void;
  /** Additional CSS classes */
  className?: string;
}

export const MultiplierChip: React.FC<MultiplierChipProps> = ({
  bucket,
  stats,
  isActive = false,
  disabled = false,
  onFocus,
  onRemove,
  className,
}) => {
  // Format bucket display
  const formatBucket = useCallback((bucket: number): string => {
    if (bucket >= 1000) {
      return `${(bucket / 1000).toFixed(1)}kx`;
    }
    return `${bucket}x`;
  }, []);

  // Format statistics for display
  const formatStats = useCallback((stats: BucketStats | null): string => {
    if (!stats || stats.count === 0) {
      return '0 hits';
    }
    
    const parts = [`${stats.count}`];
    if (stats.median !== null) {
      parts.push(`${stats.median}`);
    }
    
    return parts.join(' • ');
  }, []);

  // Handle chip click to focus
  const handleClick = useCallback(() => {
    if (!disabled && onFocus) {
      onFocus(bucket);
    }
  }, [bucket, disabled, onFocus]);

  // Handle remove action
  const handleRemove = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!disabled && onRemove) {
      onRemove(bucket);
    }
  }, [bucket, disabled, onRemove]);

  // Render the chip content
  const chipContent = (
    <Button
      variant={isActive ? "default" : "outline"}
      size="sm"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "h-8 gap-2 transition-all duration-200",
        isActive && "ring-2 ring-ring ring-offset-2",
        !disabled && "hover:scale-105",
        className
      )}
    >
      {/* Bucket value */}
      <span className="font-mono font-medium">
        {formatBucket(bucket)}
      </span>
      
      {/* Statistics */}
      {stats && stats.count > 0 && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-xs text-muted-foreground">
            {formatStats(stats)}
          </span>
        </>
      )}
      
      {/* Pin indicator for active state */}
      {isActive && (
        <Pin className="h-3 w-3 ml-1" />
      )}
    </Button>
  );

  // Render with context menu for right-click removal
  return (
    <div className="flex items-center gap-1">
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {chipContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem 
            onClick={handleRemove}
            disabled={disabled}
            className="text-destructive focus:text-destructive"
          >
            <PinOff className="h-4 w-4 mr-2" />
            Remove from pinned
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
      
      {/* Kebab menu for additional actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-muted"
            disabled={disabled}
            title={`Options for ${formatBucket(bucket)}`}
          >
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={handleRemove}
            disabled={disabled}
            className="text-destructive focus:text-destructive"
          >
            <X className="h-4 w-4 mr-2" />
            Remove
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

export default MultiplierChip;