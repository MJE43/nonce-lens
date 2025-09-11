import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import ErrorBoundary from "./ErrorBoundary";

interface LiveStreamsErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
}

const LiveStreamsErrorFallback: React.FC<LiveStreamsErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
        <Card className="bg-red-900/20 border-red-500/50 max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-red-400" />
              <div>
                <CardTitle className="text-red-400">
                  Live Streams Error
                </CardTitle>
                <CardDescription className="text-red-300">
                  An error occurred while loading the live streams interface
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                <h4 className="text-sm font-medium text-slate-300 mb-2">
                  Error Details:
                </h4>
                <p className="text-sm text-slate-400 font-mono break-all">
                  {error.message}
                </p>
              </div>
            )}

            <div className="bg-slate-900/30 p-4 rounded border border-slate-700">
              <h4 className="text-sm font-medium text-slate-300 mb-2">
                What you can try:
              </h4>
              <ul className="text-sm text-slate-400 space-y-1">
                <li>• Check your internet connection</li>
                <li>• Verify the backend API is running</li>
                <li>• Try refreshing the page</li>
                <li>• Return to the main streams list</li>
              </ul>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              {resetError && (
                <Button
                  variant="outline"
                  onClick={resetError}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Button>
              )}

              <Button
                variant="outline"
                onClick={() => window.location.reload()}
                className="flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>

              <Button variant="outline" asChild>
                <Link to="/live" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back to Streams
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

interface LiveStreamsErrorBoundaryProps {
  children: React.ReactNode;
}

const LiveStreamsErrorBoundary: React.FC<LiveStreamsErrorBoundaryProps> = ({
  children,
}) => {
  return (
    <ErrorBoundary
      fallback={<LiveStreamsErrorFallback />}
      onError={(error, errorInfo) => {
        console.error("Live Streams Error:", error, errorInfo);
        // Could send to error reporting service here
      }}
    >
      {children}
    </ErrorBoundary>
  );
};

export default LiveStreamsErrorBoundary;
