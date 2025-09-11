import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart3, Target, Hash, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MultiplierStatsProps {
  focusedMultiplier: number | null;
  stats: {
    count: number;
    median: number | null;
    min: number | null;
    max: number | null;
    mean: number | null;
  };
  onClearFocus: () => void;
  className?: string;
}

/**
 * Displays statistics for a focused multiplier in Analysis Mode
 * Shows count, median, min, max, and mean distances
 */
export function MultiplierStats({
  focusedMultiplier,
  stats,
  onClearFocus,
  className,
}: MultiplierStatsProps) {
  if (!focusedMultiplier || stats.count === 0) {
    return null;
  }

  const formatMultiplier = (multiplier: number) => {
    if (multiplier >= 1000) {
      return `${(multiplier / 1000).toFixed(1)}k×`;
    }
    return `${multiplier.toFixed(2)}×`;
  };

  const formatDistance = (distance: number | null) => {
    if (distance === null) return "—";
    return distance.toLocaleString();
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" />
            Analysis: {formatMultiplier(focusedMultiplier)}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFocus}
            className="h-6 px-2 text-xs"
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Hash className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Count:</span>
              <Badge variant="outline" className="text-xs">
                {stats.count.toLocaleString()}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Median:</span>
              <Badge variant="default" className="text-xs">
                {formatDistance(stats.median)}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Mean:</span>
              <Badge variant="secondary" className="text-xs">
                {formatDistance(stats.mean)}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Range:</span>
              <Badge variant="outline" className="text-xs">
                {formatDistance(stats.min)} - {formatDistance(stats.max)}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
