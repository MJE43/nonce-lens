import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { Eye, TrendingUp, AlertCircle } from "lucide-react";
import type { StreamSummary } from "@/lib/api";

interface UseStreamNotificationsOptions {
  enabled?: boolean;
  onNewStream?: (stream: StreamSummary) => void;
}

export const useStreamNotifications = (
  streams: StreamSummary[] | undefined,
  options: UseStreamNotificationsOptions = {}
) => {
  const { enabled = true, onNewStream } = options;
  const navigate = useNavigate();
  const previousStreamsRef = useRef<Set<string>>(new Set());
  const isInitialLoadRef = useRef(true);

  useEffect(() => {
    if (!enabled || !streams) return;

    const currentStreamIds = new Set(streams.map(s => s.id));
    
    // Skip notifications on initial load
    if (isInitialLoadRef.current) {
      previousStreamsRef.current = currentStreamIds;
      isInitialLoadRef.current = false;
      return;
    }

    // Find new streams
    const newStreams = streams.filter(
      stream => !previousStreamsRef.current.has(stream.id)
    );

    // Show notifications for new streams
    newStreams.forEach(stream => {
      const seedPrefix = stream.server_seed_hashed.substring(0, 10);
      
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-blue-500/50`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <TrendingUp className="h-6 w-6 text-blue-400" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-white">
                    New Stream Detected
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    Seed: {seedPrefix}... | Client: {stream.client_seed}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {stream.total_bets} bets • {stream.highest_multiplier?.toFixed(2) || '0.00'}x max
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-slate-700">
              <button
                onClick={() => {
                  navigate(`/live/${stream.id}`);
                  toast.dismiss(t.id);
                }}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-blue-400 hover:text-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <Eye className="w-4 h-4 mr-2" />
                View
              </button>
            </div>
            <div className="flex border-l border-slate-700">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                ×
              </button>
            </div>
          </div>
        ),
        {
          duration: 8000,
          position: 'top-right',
        }
      );

      onNewStream?.(stream);
    });

    // Update previous streams set
    previousStreamsRef.current = currentStreamIds;
  }, [streams, enabled, navigate, onNewStream]);

  return {
    showSuccessToast: (message: string) => {
      toast.success(message, {
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #10b981',
        },
        iconTheme: {
          primary: '#10b981',
          secondary: '#1e293b',
        },
      });
    },
    
    showErrorToast: (message: string) => {
      toast.error(message, {
        style: {
          background: '#1e293b',
          color: '#f1f5f9',
          border: '1px solid #ef4444',
        },
        iconTheme: {
          primary: '#ef4444',
          secondary: '#1e293b',
        },
      });
    },
    
    showWarningToast: (message: string) => {
      toast.custom(
        (t) => (
          <div
            className={`${
              t.visible ? 'animate-enter' : 'animate-leave'
            } max-w-md w-full bg-slate-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5 border border-yellow-500/50`}
          >
            <div className="flex-1 w-0 p-4">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                </div>
                <div className="ml-3 flex-1">
                  <p className="text-sm font-medium text-white">
                    Warning
                  </p>
                  <p className="mt-1 text-sm text-slate-300">
                    {message}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex border-l border-slate-700">
              <button
                onClick={() => toast.dismiss(t.id)}
                className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-slate-400 hover:text-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-500"
              >
                ×
              </button>
            </div>
          </div>
        ),
        {
          duration: 6000,
          position: 'top-right',
        }
      );
    },
  };
};