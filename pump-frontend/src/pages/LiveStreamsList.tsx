import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useLiveStreams } from "../lib/hooks";
import { Activity, Calendar, TrendingUp, Eye, EyeOff } from "lucide-react";

// ShadCN Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const LiveStreamsList = () => {
  const [autoFollow, setAutoFollow] = useState(false);
  const [lastMostRecentId, setLastMostRecentId] = useState<string | null>(null);

  const { data, isLoading, error } = useLiveStreams({
    limit: 100,
    offset: 0,
  });

  // Auto-follow latest stream logic
  useEffect(() => {
    if (!autoFollow || !data?.streams || data.streams.length === 0) return;

    // Find the most recently active stream
    const mostRecentStream = data.streams.reduce((latest, current) => {
      return new Date(current.lastSeenAt) > new Date(latest.lastSeenAt) 
        ? current 
        : latest;
    });

    // If this is a different stream than we last saw, navigate to it
    if (mostRecentStream.id !== lastMostRecentId) {
      setLastMostRecentId(mostRecentStream.id);
      // Navigate to the stream detail page
      window.location.href = `/live/${mostRecentStream.id}`;
    }
  }, [data?.streams, autoFollow, lastMostRecentId]);

  // Format timestamp for display
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  // Format seed hash prefix (first 10 characters)
  const formatSeedPrefix = (hash: string) => {
    return hash.substring(0, 10) + "...";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
            <p className="text-slate-400 text-lg">Loading live streams...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
          <Card className="bg-red-900/20 border-red-500/50 max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-red-400">Error Loading Streams</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-300">{error.message}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const streams = data?.streams || [];
  const total = data?.total || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold text-white tracking-tight">
              Live Streams
            </h1>
            <div className="flex items-center gap-4 text-slate-400">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                <span>{total} active streams</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>Real-time betting data</span>
              </div>
            </div>
          </div>

          {/* Auto-follow toggle */}
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              {autoFollow ? (
                <Eye className="w-4 h-4 text-green-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm text-slate-300">Auto-follow latest</span>
              <Switch
                checked={autoFollow}
                onCheckedChange={setAutoFollow}
                className="data-[state=checked]:bg-green-600"
              />
            </div>
          </div>
        </div>

        {/* Auto-follow status */}
        {autoFollow && (
          <Card className="bg-green-900/20 border-green-500/40">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-green-300">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <span className="text-sm">
                  Auto-following enabled - will automatically open the most recently active stream
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Streams Table */}
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white">Active Streams ({streams.length})</CardTitle>
            <CardDescription className="text-slate-400">
              Live betting streams grouped by seed pairs
            </CardDescription>
          </CardHeader>
          <CardContent>
            {streams.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg mb-2">No active streams</p>
                <p className="text-slate-500 text-sm">
                  Streams will appear here when betting data is received
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Seed Hash</TableHead>
                      <TableHead className="text-slate-300">Client Seed</TableHead>
                      <TableHead className="text-slate-300">Last Seen</TableHead>
                      <TableHead className="text-slate-300">Total Bets</TableHead>
                      <TableHead className="text-slate-300">Highest Multiplier</TableHead>
                      <TableHead className="text-slate-300">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {streams.map((stream) => (
                      <TableRow 
                        key={stream.id} 
                        className="border-slate-700 hover:bg-slate-700/30 transition-colors"
                      >
                        <TableCell className="font-mono text-slate-300">
                          {formatSeedPrefix(stream.serverSeedHashed)}
                        </TableCell>
                        <TableCell className="font-mono text-slate-300">
                          {stream.clientSeed}
                        </TableCell>
                        <TableCell className="text-slate-400">
                          {formatTimestamp(stream.lastSeenAt)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="bg-slate-700 text-slate-200">
                            {stream.totalBets.toLocaleString()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline" 
                            className="border-yellow-500/50 text-yellow-400"
                          >
                            {stream.highestMultiplier.toFixed(2)}x
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/live/${stream.id}`}>
                              <TrendingUp className="w-4 h-4 mr-2" />
                              View Stream
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiveStreamsList;