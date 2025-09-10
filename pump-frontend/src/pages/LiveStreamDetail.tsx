import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useEnhancedStreamDetail,
  useEnhancedDeleteStream,
  useEnhancedUpdateStream,
} from "@/hooks/useEnhancedLiveStreams";
import { useStreamBetsQuery } from "@/hooks/useStreamBetsQuery";
import { useAnalyticsState } from "@/hooks/useAnalyticsState";
import { liveStreamsApi } from "../lib/api";
import OfflineIndicator from "@/components/OfflineIndicator";
import { showSuccessToast, showErrorToast } from "../lib/errorHandling";
import {
  ArrowLeft,
  Download,
  Trash2,
  Edit3,
  Save,
  Activity,
  Hash,
  Key,
  Clock,
  BarChart3,
  RefreshCw,
} from "lucide-react";

// ShadCN Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { Skeleton } from "@/components/ui/skeleton";
// import { formatDistance } from "date-fns";
import { LiveBetTable } from "@/components/LiveBetTable";

const LiveStreamDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State for editing notes
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // State for UI controls only
  const [isPolling, setIsPolling] = useState(true);
  const [highFrequencyMode, setHighFrequencyMode] = useState(true); // Default to high frequency for betting

  // Shared, memoized filters to stabilize query keys
  const betsFilters = useMemo(
    () => ({ order: "id_desc" as const, limit: 1000 as const }),
    []
  );

  // Fetch bets with real-time streaming
  const betsQuery = useStreamBetsQuery({
    streamId: id!,
    filters: betsFilters,
    enabled: isPolling,
    pollingInterval: highFrequencyMode ? 500 : 2000,
  });
  const betsLoading = betsQuery.isLoading;

  // Analytics state hook for processing incoming bets
  const { updateFromTail } = useAnalyticsState(id!);

  // Update analytics when bets change
  useEffect(() => {
    if (betsQuery.bets.length > 0) {
      updateFromTail(betsQuery.bets);
    }
  }, [betsQuery.bets, updateFromTail]);

  const {
    data: streamDetail,
    isLoading: streamLoading,
    error: streamError,
    refetch: refetchStream,
  } = useEnhancedStreamDetail(id!);
  const deleteStreamMutation = useEnhancedDeleteStream();
  const updateStreamMutation = useEnhancedUpdateStream();

  // Initialize notes when stream data loads
  useEffect(() => {
    if (streamDetail && !isEditingNotes) {
      setNotesValue(streamDetail.notes || "");
    }
  }, [streamDetail, isEditingNotes]);

  // Handle delete stream
  const handleDeleteStream = async () => {
    if (!id) return;

    try {
      await deleteStreamMutation.mutateAsync(id);
      navigate("/live");
    } catch (error: unknown) {
      console.error("Failed to delete stream:", error);
      // Error handling is now done in the mutation hook
    }
  };

  // Handle save notes
  const handleSaveNotes = async () => {
    if (!id) return;

    try {
      await updateStreamMutation.mutateAsync({
        id,
        data: { notes: notesValue.trim() || undefined },
      });
      setIsEditingNotes(false);
    } catch (error: unknown) {
      console.error("Failed to update notes:", error);
      // Error handling is now done in the mutation hook
    }
  };

  // Handle export CSV
  const handleExportCsv = () => {
    if (!id) return;
    try {
      const url = liveStreamsApi.getExportCsvUrl(id);
      window.open(url, "_blank");
      showSuccessToast("CSV export started");
    } catch (error) {
      showErrorToast(error, "Failed to export CSV. Please try again.");
    }
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  // Format seed hash prefix
  const formatSeedPrefix = (hash: string) => {
    return hash.substring(0, 16) + "...";
  };

  // Difficulty color handled inside LiveBetTable

  // Route parameter validation
  if (!id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-900/20 border-red-500/50 max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-400">Invalid Stream ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-300 mb-4">
              Stream ID is required to view stream details.
            </p>
            <Button variant="outline" asChild>
              <Link to="/live">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Live Streams
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Additional validation for UUID format (basic check)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(id)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <Card className="bg-red-900/20 border-red-500/50 max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-red-400">
              Invalid Stream ID Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-300 mb-4">
              The provided stream ID is not in a valid format.
            </p>
            <Button variant="outline" asChild>
              <Link to="/live">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Live Streams
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (streamLoading || betsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64 bg-slate-700" />
            <Skeleton className="h-32 w-full bg-slate-700" />
            <Skeleton className="h-64 w-full bg-slate-700" />
          </div>
        </div>
      </div>
    );
  }

  if (streamError || !streamDetail) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
        <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
          <Card className="bg-red-900/20 border-red-500/50 max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-red-400">Stream Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-300 mb-4">
                {streamError?.message ||
                  "The requested stream could not be found."}
              </p>
              <Button variant="outline" asChild>
                <Link to="/live">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Streams
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const bets = betsQuery.bets;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                onClick={() => setIsPolling(!isPolling)}
                variant={isPolling ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Activity className="w-4 h-4" />
                {isPolling ? "Pause" : "Resume"}
              </Button>

              <Button
                onClick={() => setHighFrequencyMode(!highFrequencyMode)}
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Offline Indicator */}
        <OfflineIndicator
          onRetry={() => {
            refetchStream();
            betsQuery.refetch();
          }}
        />

        {/* Stream Metadata Card */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-primary" />
                Stream Information
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></div>
                  <span className="text-sm font-medium">Live</span>
                  {highFrequencyMode && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                      HF
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCsv}
                  disabled={bets.length === 0}
                  className="gap-2"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
                {!isEditingNotes ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsEditingNotes(true)}
                    className="gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    Edit Notes
                  </Button>
                ) : (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={updateStreamMutation.isPending}
                    className="gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {updateStreamMutation.isPending ? "Saving..." : "Save"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seed Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Hash className="w-4 h-4" />
                  Server Seed Hash
                </Label>
                <div className="font-mono text-sm bg-muted p-3 rounded-md border">
                  <span>
                    {formatSeedPrefix(streamDetail.server_seed_hashed)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Key className="w-4 h-4" />
                  Client Seed
                </Label>
                <div className="font-mono text-sm bg-muted p-3 rounded-md border">
                  <span>{streamDetail.client_seed}</span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold">
                  {streamDetail.total_bets.toLocaleString()}
                </div>
                <div className="text-sm text-muted-foreground">Total Bets</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">
                  {streamDetail.highest_multiplier?.toFixed(2) || "0.00"}x
                </div>
                <div className="text-sm text-muted-foreground">
                  Highest Multiplier
                </div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-blue-400">
                  {formatTimestamp(streamDetail.created_at).split(",")[0]}
                </div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg border">
                <div className="text-2xl font-bold text-green-400">
                  {formatTimestamp(streamDetail.last_seen_at).split(",")[1]}
                </div>
                <div className="text-sm text-muted-foreground">Last Seen</div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-slate-300">Notes</Label>
                {!isEditingNotes ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingNotes(true)}
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveNotes}
                      disabled={updateStreamMutation.isPending}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsEditingNotes(false);
                        setNotesValue(streamDetail.notes || "");
                      }}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                )}
              </div>
              {isEditingNotes ? (
                <Textarea
                  value={notesValue}
                  onChange={(e) => setNotesValue(e.target.value)}
                  placeholder="Add notes about this stream..."
                  className="bg-slate-900/50 border-slate-700 text-slate-300"
                  rows={3}
                />
              ) : (
                <div className="bg-slate-900/50 p-3 rounded border border-slate-700 min-h-[80px]">
                  <span className="text-slate-300">
                    {streamDetail.notes || "No notes added"}
                  </span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-slate-700">
              <Button
                variant="outline"
                onClick={handleExportCsv}
                className="flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    className="flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Stream
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-slate-800 border-slate-700">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-white">
                      Delete Stream
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-slate-300">
                      This will permanently delete the stream and all associated
                      bet data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="bg-slate-700 text-slate-300 border-slate-600">
                      Cancel
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteStream}
                      className="bg-red-600 hover:bg-red-700"
                      disabled={deleteStreamMutation.isPending}
                    >
                      {deleteStreamMutation.isPending
                        ? "Deleting..."
                        : "Delete"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* Bets Table */}
        <Card className="shadow-md">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Betting Activity
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
            {(bets.length === 0 && isPolling) || betsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : bets.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg mb-2 font-medium">No bets found</p>
                <p className="text-muted-foreground text-sm">
                  {isPolling
                    ? "Waiting for new bets..."
                    : "Bets will appear here as they are received"}
                </p>
              </div>
            ) : (
              <LiveBetTable
                key={`bets-${bets.length}-${bets[0]?.id || "empty"}`}
                bets={bets}
                isLoading={betsLoading}
                showDistanceColumn={true}
                showVirtualScrolling={bets.length > 100}
                hasNextPage={betsQuery.hasNextPage}
                fetchNextPage={betsQuery.fetchNextPage}
                isFetchingNextPage={
                  betsQuery.isFetching && !!betsQuery.hasNextPage
                }
                totalCount={betsQuery.total}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default LiveStreamDetail;
