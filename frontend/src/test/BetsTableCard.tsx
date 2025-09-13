import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LiveBetTable, BetData } from "@/components/LiveBetTable";
import { Activity, BarChart3, Clock } from "lucide-react";

interface BetsTableCardProps {
  isAnalysisMode: boolean;
  betsData: BetData[];
  betsLoading: boolean;
  isPolling: boolean;
  highFrequencyMode: boolean;
  minMultiplier: number;
  hitsQuery: any; // Simplified for this component
  betsQuery: any; // Simplified for this component
  focusedBucket: number | null;
  setFocusedBucket: (bucket: number | null) => void;
  pinnedBuckets: number[];
}

export const BetsTableCard = ({
  isAnalysisMode,
  betsData,
  betsLoading,
  isPolling,
  highFrequencyMode,
  minMultiplier,
  hitsQuery,
  betsQuery,
  focusedBucket,
  setFocusedBucket,
  pinnedBuckets,
}: BetsTableCardProps) => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            {isAnalysisMode ? "Hit-Centric Analysis" : "Betting Activity"}
            {isAnalysisMode && (
              <span className="text-sm text-muted-foreground ml-2">
                ({betsData.length.toLocaleString()} hits ≥ {minMultiplier}×)
              </span>
            )}
          </CardTitle>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Updates every {highFrequencyMode ? "0.5" : "2"} seconds
            </span>
          </div>
        </div>
        <CardDescription>
          Real-time betting data for this seed pair
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(betsData.length === 0 && (isPolling || isAnalysisMode)) || betsLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : betsData.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg mb-2 font-medium">
              {isAnalysisMode ? "No hits found" : "No bets found"}
            </p>
            <p className="text-muted-foreground text-sm">
              {isAnalysisMode
                ? "Try adjusting the multiplier filter or range"
                : isPolling
                ? "Waiting for new bets..."
                : "Bets will appear here as they are received"}
            </p>
          </div>
        ) : (
          <LiveBetTable
            key={`bets-table-${isAnalysisMode}-${focusedBucket}`}
            bets={betsData}
            isLoading={betsLoading}
            showDistanceColumn={isAnalysisMode}
            showVirtualScrolling={betsData.length > 100}
            hasNextPage={isAnalysisMode ? hitsQuery.hasMore : betsQuery.hasNextPage}
            fetchNextPage={isAnalysisMode ? undefined : betsQuery.fetchNextPage}
            isFetchingNextPage={
              isAnalysisMode
                ? hitsQuery.isFetching
                : betsQuery.isFetching && !!betsQuery.hasNextPage
            }
            totalCount={isAnalysisMode ? hitsQuery.totalInRange : betsQuery.total}
            isAnalysisMode={isAnalysisMode}
            focusedMultiplier={focusedBucket}
            onMultiplierFocus={setFocusedBucket}
            pinnedMultipliers={pinnedBuckets}
          />
        )}
      </CardContent>
    </Card>
  );
};
