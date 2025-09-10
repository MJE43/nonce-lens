// React import not needed for modern React
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Activity, Clock, Hash, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StreamSummary } from '@/lib/api';

interface StreamSummaryCardProps {
  stream?: StreamSummary;
  isLoading?: boolean;
  isError?: boolean;
  onNavigate?: (streamId: string) => void;
  showActivityIndicator?: boolean;
  className?: string;
}

/**
 * Compact stream information display component
 * Shows essential stream metadata with activity indicators and quick actions
 * Supports loading and error states as per requirements 3.1, 3.5
 */
export function StreamSummaryCard({
  stream,
  isLoading = false,
  isError = false,
  onNavigate,
  showActivityIndicator = true,
  className,
}: StreamSummaryCardProps) {
  // Loading state
  if (isLoading) {
    return (
      <Card className={cn("hover:shadow-md transition-shadow", className)}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-16" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError || !stream) {
    return (
      <Card className={cn("border-destructive/50 bg-destructive/5", className)}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center text-sm text-muted-foreground">
            {isError ? "Failed to load stream data" : "No stream data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate activity status based on last seen time
  const lastSeenDate = new Date(stream.lastSeenAt);
  const now = new Date();
  const minutesAgo = Math.floor((now.getTime() - lastSeenDate.getTime()) / (1000 * 60));
  
  const isActive = minutesAgo < 5; // Active if seen within 5 minutes
  const isRecent = minutesAgo < 30; // Recent if seen within 30 minutes

  const formatLastSeen = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const formatMultiplier = (multiplier: number) => {
    if (multiplier >= 1000) {
      return `${(multiplier / 1000).toFixed(1)}k×`;
    }
    return `${multiplier.toFixed(2)}×`;
  };

  const handleCardClick = () => {
    if (onNavigate) {
      onNavigate(stream.id);
    }
  };

  return (
    <Card 
      className={cn(
        "hover:shadow-md transition-all cursor-pointer group",
        "hover:border-primary/20 hover:bg-accent/5",
        className
      )}
      onClick={handleCardClick}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-sm font-medium truncate">
              <div className="flex items-center gap-2">
                <Hash className="h-3 w-3 text-muted-foreground shrink-0" />
                <span className="font-mono text-xs">
                  {stream.serverSeedHashed.substring(0, 10)}...
                </span>
              </div>
            </CardTitle>
            <div className="text-xs text-muted-foreground truncate">
              Client: <span className="font-mono">{stream.clientSeed}</span>
            </div>
          </div>
          
          <CardAction>
            <div className="flex items-center gap-2">
              {showActivityIndicator && (
                <div className="flex items-center gap-1">
                  <Activity 
                    className={cn(
                      "h-3 w-3",
                      isActive && "text-green-500 animate-pulse",
                      isRecent && !isActive && "text-yellow-500",
                      !isRecent && "text-muted-foreground"
                    )} 
                  />
                </div>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick();
                }}
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
          </CardAction>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-1">
            <div className="text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last seen
            </div>
            <div className="font-medium">
              {formatLastSeen(lastSeenDate)}
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-muted-foreground">Total bets</div>
            <div className="font-medium">
              {stream.totalBets.toLocaleString()}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Highest:</span>
            <Badge 
              variant="secondary" 
              className={cn(
                "text-xs font-mono",
                stream.highestMultiplier >= 1000 && "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400",
                stream.highestMultiplier >= 10000 && "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400",
                stream.highestMultiplier >= 100000 && "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
              )}
            >
              {formatMultiplier(stream.highestMultiplier)}
            </Badge>
          </div>

          {/* Activity status indicator */}
          {showActivityIndicator && (
            <Badge 
              variant={isActive ? "default" : isRecent ? "secondary" : "outline"}
              className="text-xs"
            >
              {isActive ? "Live" : isRecent ? "Recent" : "Idle"}
            </Badge>
          )}
        </div>

        {/* Optional notes preview */}
        {stream.notes && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs text-muted-foreground truncate">
              {stream.notes}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}