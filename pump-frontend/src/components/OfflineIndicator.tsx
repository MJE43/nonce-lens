import React from "react";
import { WifiOff, Wifi, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useOfflineDetection } from "@/hooks/useOfflineDetection";

interface OfflineIndicatorProps {
  onRetry?: () => void;
}

const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({ onRetry }) => {
  const { isOnline, wasOffline, resetOfflineState } = useOfflineDetection();

  // Show reconnection message when coming back online
  if (isOnline && wasOffline) {
    return (
      <Card className="bg-green-900/20 border-green-500/40 mb-4">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-green-300">
              <Wifi className="w-4 h-4" />
              <span className="text-sm">Connection restored</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetOfflineState();
                onRetry?.();
              }}
              className="text-green-300 hover:text-green-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show offline message when disconnected
  if (!isOnline) {
    return (
      <Card className="bg-red-900/20 border-red-500/50 mb-4">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-300">
              <WifiOff className="w-4 h-4" />
              <span className="text-sm">You're offline. Some features may not work.</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="text-red-300 hover:text-red-200"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default OfflineIndicator;