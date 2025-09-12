/**
 * Statistics Display Component
 * 
 * Shows hit statistics in a consistent format across the application
 * Requirements: 8.2, 8.3
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { BucketStats } from '@/lib/analysisMath';
import { cn } from '@/lib/utils';

export interface StatisticsDisplayProps {
  /** Statistics to display */
  stats: BucketStats | null;
  /** Whether to show all statistics or just key ones */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show method indicator */
  showMethod?: boolean;
}

export const StatisticsDisplay: React.FC<StatisticsDisplayProps> = ({
  stats,
  compact = false,
  className,
  showMethod = false,
}) => {
  if (!stats || stats.count === 0) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        No hits
      </div>
    );
  }

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    return num.toLocaleString();
  };

  const formatCompactNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toString();
  };

  if (compact) {
    return (
      <div className={cn("flex items-center gap-2 text-sm", className)}>
        <Badge variant="secondary" className="font-mono">
          {stats.count}
        </Badge>
        <Separator orientation="vertical" className="h-4" />
        <span className="font-medium">
          Median: {formatCompactNumber(stats.median)}
        </span>
        <Separator orientation="vertical" className="h-4" />
        <span className="text-muted-foreground">
          Mean: {formatCompactNumber(stats.mean)}
        </span>
        {showMethod && stats.method === 'approximate' && (
          <>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant="outline" className="text-xs">
              ~
            </Badge>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={cn("grid grid-cols-2 gap-4 text-sm", className)}>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Count:</span>
          <Badge variant="secondary" className="font-mono">
            {formatNumber(stats.count)}
          </Badge>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Median:</span>
          <span className="font-medium font-mono">
            {formatNumber(stats.median)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Mean:</span>
          <span className="font-mono">
            {formatNumber(stats.mean)}
          </span>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Min:</span>
          <span className="font-mono">
            {formatNumber(stats.min)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Max:</span>
          <span className="font-mono">
            {formatNumber(stats.max)}
          </span>
        </div>
        {showMethod && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Method:</span>
            <Badge 
              variant={stats.method === 'exact' ? 'default' : 'outline'}
              className="text-xs"
            >
              {stats.method}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatisticsDisplay;