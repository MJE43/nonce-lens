import { Link } from "react-router-dom";
import { ArrowLeft, Activity, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface StreamDetailHeaderProps {
  isPolling: boolean;
  onTogglePolling: () => void;
  highFrequencyMode: boolean;
  onToggleHighFrequencyMode: () => void;
}

export const StreamDetailHeader = ({
  isPolling,
  onTogglePolling,
  highFrequencyMode,
  onToggleHighFrequencyMode,
}: StreamDetailHeaderProps) => {
  return (
    <div className="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/streams">
              <Button variant="outline" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to Streams
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">Live Stream Detail</h1>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Button
              onClick={onTogglePolling}
              variant={isPolling ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <Activity className="w-4 h-4" />
              {isPolling ? "Pause" : "Resume"}
            </Button>

            <Button
              onClick={onToggleHighFrequencyMode}
              variant={highFrequencyMode ? "default" : "outline"}
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {highFrequencyMode ? "Normal" : "HF Mode"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
