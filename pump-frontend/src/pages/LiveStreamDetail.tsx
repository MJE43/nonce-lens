import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useEnhancedStreamDetail,
  useEnhancedStreamBets,
  useEnhancedDeleteStream,
  useEnhancedUpdateStream,
} from "@/hooks/useEnhancedLiveStreams";
import { useRealTimeBets } from "@/hooks/useStreamTail";
import { useAnalyticsState } from "@/hooks/useAnalyticsState";
import { liveStreamsApi } from "../lib/api";
import Breadcrumb from "../components/Breadcrumb";
import OfflineIndicator from "@/components/OfflineIndicator";
import { showSuccessToast, showErrorToast } from "../lib/errorHandling";
import {
  ArrowLeft,
  Download,
  Trash2,
  Edit3,
  Save,
  X,
  Activity,
  Hash,
  Key,
  Clock,
  BarChart3,
  Filter,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Skeleton } from "@/components/ui/skeleton";
// import { formatDistance } from "date-fns";

const LiveStreamDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State for editing notes
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // State for bet filtering
  const [minMultiplier, setMinMultiplier] = useState<number | undefined>();
  const [orderBy, setOrderBy] = useState<"nonce_asc" | "id_desc">("id_desc");

  // State for UI controls only
  const [isPolling, setIsPolling] = useState(true);
  const [highFrequencyMode, setHighFrequencyMode] = useState(true); // Default to high frequency for betting

  // Fetch initial bets data
  const { data: initialBetsData, isLoading: betsLoading } =
    useEnhancedStreamBets(id!, {
      order: "id_desc",
      limit: 100, // Get recent bets to establish lastId
    });

  // Analytics state hook for processing incoming bets
  const { updateFromTail } = useAnalyticsState(id!);

  // Hooks - pass initial bets to establish proper lastId
  const realTimeBets = useRealTimeBets(id!, initialBetsData?.bets || []);

  // Update analytics when new bets arrive
  useEffect(() => {
    if (realTimeBets.newBets.length > 0) {
      updateFromTail(realTimeBets.newBets);
    }
  }, [realTimeBets.newBets, updateFromTail]);

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

  // Get difficulty badge color
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "easy":
        return "bg-green-600";
      case "medium":
        return "bg-yellow-600";
      case "hard":
        return "bg-orange-600";
      case "expert":
        return "bg-red-600";
      default:
        return "bg-gray-600";
    }
  };

  // Filter bets based on minMultiplier (using round_result instead of payout_multiplier)
  const filteredBets = minMultiplier
    ? realTimeBets.bets.filter((bet) => {
        const multiplier = bet.round_result;
        return multiplier != null && multiplier >= minMultiplier;
      })
    : realTimeBets.bets;

  // Sort bets based on orderBy
  const sortedBets = [...filteredBets].sort((a, b) => {
    if (orderBy === "nonce_asc") {
      return a.nonce - b.nonce;
    } else {
      return b.id - a.id;
    }
  });

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === "development" && realTimeBets.bets.length > 0) {
    console.log("LiveStreamDetail:", {
      totalBets: realTimeBets.bets.length,
      filteredBets: filteredBets.length,
      sortedBets: sortedBets.length,
      minMultiplier,
    });
  }

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_70%)]" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-full blur-3xl" />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl space-y-8">
        {/* Breadcrumb Navigation */}
        <Breadcrumb
          items={[
            { label: "Live", href: "/live" },
            {
              label: streamDetail
                ? `${streamDetail.server_seed_hashed.substring(0, 10)}...`
                : "Stream Detail",
            },
          ]}
        />

        {/* Offline Indicator */}
        <OfflineIndicator
          onRetry={() => {
            refetchStream();
            // Note: Bets are handled by useRealTimeBets hook
          }}
        />

        {/* Header */}
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-blue-400" />
          <h1 className="text-2xl font-bold text-white">Live Stream Detail</h1>
        </div>

        {/* Stream Metadata Card */}
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <Hash className="w-5 h-5 text-blue-400" />
                Stream Information
              </CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 text-green-400">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                  <span className="text-sm">Live</span>
                  {highFrequencyMode && (
                    <span className="text-xs bg-green-600 px-1 rounded">
                      HF
                    </span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHighFrequencyMode(!highFrequencyMode)}
                  className={
                    highFrequencyMode ? "bg-blue-600/20 border-blue-500" : ""
                  }
                >
                  <Activity className="w-4 h-4 mr-2" />
                  {highFrequencyMode ? "0.5s" : "2s"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsPolling(!isPolling)}
                >
                  <RefreshCw
                    className={`w-4 h-4 mr-2 ${
                      isPolling ? "animate-spin" : ""
                    }`}
                  />
                  {isPolling ? "Pause" : "Resume"}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seed Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Hash className="w-4 h-4" />
                  Server Seed Hash
                </Label>
                <div className="font-mono text-sm bg-slate-900/50 p-3 rounded border border-slate-700">
                  <span className="text-slate-300">
                    {formatSeedPrefix(streamDetail.server_seed_hashed)}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Client Seed
                </Label>
                <div className="font-mono text-sm bg-slate-900/50 p-3 rounded border border-slate-700">
                  <span className="text-slate-300">
                    {streamDetail.client_seed}
                  </span>
                </div>
              </div>
            </div>

            {/* Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-white">
                  {streamDetail.total_bets.toLocaleString()}
                </div>
                <div className="text-sm text-slate-400">Total Bets</div>
              </div>
              <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-yellow-400">
                  {streamDetail.highest_multiplier?.toFixed(2) || "0.00"}x
                </div>
                <div className="text-sm text-slate-400">Highest Multiplier</div>
              </div>
              <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-blue-400">
                  {formatTimestamp(streamDetail.created_at).split(",")[0]}
                </div>
                <div className="text-sm text-slate-400">Created</div>
              </div>
              <div className="text-center p-4 bg-slate-900/30 rounded-lg border border-slate-700">
                <div className="text-2xl font-bold text-green-400">
                  {formatTimestamp(streamDetail.last_seen_at).split(",")[1]}
                </div>
                <div className="text-sm text-slate-400">Last Seen</div>
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
                      <X className="w-4 h-4 mr-2" />
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

        {/* Bet Filters and Controls */}
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-400" />
              Bet Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label className="text-slate-300">Minimum Multiplier</Label>
                <Input
                  type="number"
                  placeholder="e.g. 100"
                  value={minMultiplier || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "") {
                      setMinMultiplier(undefined);
                    } else {
                      const parsed = parseFloat(value);
                      setMinMultiplier(isNaN(parsed) ? undefined : parsed);
                    }
                  }}
                  className={`w-32 ${
                    minMultiplier
                      ? "bg-blue-900/30 border-blue-500 text-blue-300"
                      : "bg-slate-900/50 border-slate-700 text-slate-300"
                  }`}
                  min="0"
                  step="0.01"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Order By</Label>
                <Select
                  value={orderBy}
                  onValueChange={(value: "nonce_asc" | "id_desc") =>
                    setOrderBy(value)
                  }
                >
                  <SelectTrigger className="bg-slate-900/50 border-slate-700 text-slate-300 w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    <SelectItem value="nonce_asc" className="text-slate-300">
                      Nonce (Asc)
                    </SelectItem>
                    <SelectItem value="id_desc" className="text-slate-300">
                      Latest First
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setMinMultiplier(undefined);
                  setOrderBy("id_desc");
                }}
                className="flex items-center gap-2"
                disabled={!minMultiplier}
              >
                <X className="w-4 h-4" />
                Clear Filters
                {minMultiplier && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    1
                  </Badge>
                )}
              </Button>
            </div>
            <div className="mt-4 text-sm text-slate-400">
              Showing {sortedBets.length.toLocaleString()} of{" "}
              {realTimeBets.bets.length.toLocaleString()} bets
              {minMultiplier && ` (≥${minMultiplier}x multiplier)`}
            </div>
          </CardContent>
        </Card>

        {/* Bets Table */}
        <Card className="bg-slate-800/50 backdrop-blur-xl border-slate-700/50 shadow-2xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Betting Activity
              </CardTitle>
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4" />
                <span className="text-sm">
                  Updates every {highFrequencyMode ? "0.5" : "2"} seconds
                </span>
                {realTimeBets.newBetsCount > 0 && (
                  <Badge
                    variant="outline"
                    className="border-green-500 text-green-400"
                  >
                    +{realTimeBets.newBetsCount} new
                  </Badge>
                )}
              </div>
            </div>
            <CardDescription className="text-slate-400">
              Real-time betting data for this seed pair
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(realTimeBets.bets.length === 0 && realTimeBets.isPolling) ||
            betsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full bg-slate-700" />
                ))}
              </div>
            ) : realTimeBets.bets.length === 0 ? (
              <div className="text-center py-12">
                <Activity className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 text-lg mb-2">No bets found</p>
                <p className="text-slate-500 text-sm">
                  {minMultiplier
                    ? `No bets found with multiplier ≥${minMultiplier}x`
                    : realTimeBets.isRealTimeActive
                    ? "Waiting for new bets..."
                    : "Bets will appear here as they are received"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700">
                      <TableHead className="text-slate-300">Nonce</TableHead>
                      <TableHead className="text-slate-300">
                        Date/Time
                      </TableHead>
                      <TableHead className="text-slate-300">Amount</TableHead>
                      <TableHead className="text-slate-300">
                        Multiplier
                      </TableHead>
                      <TableHead className="text-slate-300">Payout</TableHead>
                      <TableHead className="text-slate-300">
                        Difficulty
                      </TableHead>
                      <TableHead className="text-slate-300">Target</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBets.map((bet) => (
                      <TableRow
                        key={bet.id}
                        className="border-slate-700 hover:bg-slate-700/30 transition-colors"
                      >
                        <TableCell className="font-mono text-slate-300">
                          {bet.nonce.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">
                          {bet.date_time
                            ? formatTimestamp(bet.date_time)
                            : formatTimestamp(bet.received_at)}
                        </TableCell>
                        <TableCell className="font-mono text-slate-300">
                          {bet.amount.toFixed(8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`${
                              (bet.round_result || 0) >= 1000
                                ? "border-yellow-500/50 text-yellow-400"
                                : (bet.round_result || 0) >= 100
                                ? "border-orange-500/50 text-orange-400"
                                : (bet.round_result || 0) >= 10
                                ? "border-blue-500/50 text-blue-400"
                                : "border-slate-500/50 text-slate-400"
                            }`}
                          >
                            {bet.round_result?.toFixed(2) || "0.00"}x
                          </Badge>
                        </TableCell>
                        {/* Distance column temporarily removed */}
                        <TableCell className="font-mono text-slate-300">
                          {bet.payout.toFixed(8)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={`${getDifficultyColor(
                              bet.difficulty
                            )} text-white`}
                          >
                            {bet.difficulty}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-slate-400 text-sm">
                          {bet.round_target?.toFixed(2) || "—"}
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

export default LiveStreamDetail;
