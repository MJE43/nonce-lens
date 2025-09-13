import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Activity, Clock } from "lucide-react";
import LiveBetsTable from "@/components/live-streams/LiveBetsTable";

interface BetsTableCardProps {
  streamId: string;
  isPolling: boolean;
  highFrequencyMode: boolean;
}

export const BetsTableCard = ({
  streamId,
  isPolling,
  highFrequencyMode,
}: BetsTableCardProps) => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Live Betting Activity
          </CardTitle>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">
              Updates every {highFrequencyMode ? "0.5" : "2"} seconds
            </span>
          </div>
        </div>
        <CardDescription>
          Real-time betting data with distance calculations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <LiveBetsTable 
          streamId={streamId}
          isPolling={isPolling}
          pollingInterval={highFrequencyMode ? 500 : 2000}
        />
      </CardContent>
    </Card>
  );
};
