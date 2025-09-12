import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useEnhancedStreamDetail,
  useEnhancedDeleteStream,
  useEnhancedUpdateStream,
} from "@/hooks/useEnhancedLiveStreams";
import { useStreamBetsQuery } from "@/hooks/useStreamBetsQuery";

import { useAnalyticsState } from "@/hooks/useAnalyticsState";
import { 
  useHits, 
  useHitStats, 
  useHitsBatch 
} from "@/hooks/useHitCentricAnalysis";
import { liveStreamsApi } from "../lib/api";

import OfflineIndicator from "@/components/OfflineIndicator";
import { showSuccessToast, showErrorToast } from "../lib/errorHandling";
import { AnalysisProvider, useAnalysis } from "@/contexts";
import {
  ArrowLeft,
  Activity,
  BarChart3,
  RefreshCw,
} from "lucide-react";

// ShadCN Components
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiplierTracker } from "@/components/live-streams/MultiplierTracker";
import { AnalysisBar } from "@/components/AnalysisBar";
import { StreamDetailHeader } from "@/components/live-streams/StreamDetailHeader";
import { StreamInfoCard } from "@/components/live-streams/StreamInfoCard";
import { BetsTableCard } from "@/components/live-streams/BetsTableCard";


const LiveStreamDetailContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Get analysis context
  const {
    mode,
    setMode,
    focusedBucket,
    setFocusedBucket,
    currentRange,
    setCurrentRange,
    minMultiplier,
    setMinMultiplier,
    pinnedBuckets,
    addPinnedBucket,
    removePinnedBucket,
    scopeLabel,
    statsByPinnedBuckets,
    setHits,
  } = useAnalysis();

  // State for editing notes
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // State for UI controls only
  const [isPolling, setIsPolling] = useState(true);
  const [highFrequencyMode, setHighFrequencyMode] = useState(true); // Default to high frequency for betting

  const isAnalysisMode = mode === 'analysis';

  // Shared, memoized filters to stabilize query keys
  const betsFilters = useMemo(
    () => ({ order: "id_desc" as const, limit: 1000 as const }),
    []
  );

  // Fetch bets with real-time streaming (live mode)
  const betsQuery = useStreamBetsQuery({
    streamId: id!,
    filters: betsFilters,
    enabled: isPolling && mode === 'live',
    pollingInterval: highFrequencyMode ? 500 : 2000,
  });

  // Hit-centric analysis queries
  const hitsQuery = useHits({
    streamId: id!,
    bucket: focusedBucket || minMultiplier,
    range: currentRange,
    enabled: isAnalysisMode && (focusedBucket !== null || minMultiplier > 1) && !!id,
  });

  const hitStatsQuery = useHitStats({
    streamId: id!,
    bucket: focusedBucket || minMultiplier,
    ranges: [`${currentRange[0]}-${currentRange[1]}`],
    enabled: isAnalysisMode && (focusedBucket !== null || minMultiplier > 1) && !!id,
  });

  // Batch query for pinned buckets (when in analysis mode and have pinned buckets)
  const hitsBatchQuery = useHitsBatch({
    streamId: id!,
    buckets: pinnedBuckets,
    range: currentRange,
    enabled: isAnalysisMode && pinnedBuckets.length > 0 && !!id,
  });



  // Calculate loading state based on mode
  const betsLoading = isAnalysisMode 
    ? (hitsQuery.isLoading || hitStatsQuery.isLoading || (pinnedBuckets.length > 0 && hitsBatchQuery.isLoading))
    : betsQuery.isLoading;

  // Analytics state hook for processing incoming bets (live mode only)
  const {
    state: analyticsState,
    updateFromTail,
    pinMultiplier,
    unpinMultiplier,
  } = useAnalyticsState(id!);

  // Update analytics when bets change in live mode
  useEffect(() => {
    if (mode === 'live' && betsQuery.bets.length > 0) {
      updateFromTail(betsQuery.bets);
    }
  }, [mode, betsQuery.bets, updateFromTail]);

  // Update analysis context with hits data when in analysis mode
  useEffect(() => {
    if (mode === 'analysis' && hitsQuery.hits.length > 0) {
      setHits(hitsQuery.hits);
    }
  }, [mode, hitsQuery.hits, setHits]);

  // Update analysis context with batch hits for pinned buckets
  useEffect(() => {
    if (mode === 'analysis' && hitsBatchQuery.hitsByBucket && Object.keys(hitsBatchQuery.hitsByBucket).length > 0) {
      // Combine all hits from batch query for context
      const allBatchHits = Object.values(hitsBatchQuery.hitsByBucket).flat();
      if (allBatchHits.length > 0) {
        setHits(allBatchHits);
      }
    }
  }, [mode, hitsBatchQuery.hitsByBucket, setHits]);

  // Get bets data based on mode
  const betsData = useMemo(() => {
    if (isAnalysisMode) {
      // In analysis mode, use hits data with precomputed distances
      return hitsQuery.hits.map(hit => ({
        // Core BetRecord fields
        id: hit.id,
        nonce: hit.nonce,
        payout_multiplier: hit.bucket,
        round_result: hit.bucket,
        distance_prev_opt: hit.distance_prev,
        date_time: hit.date_time || new Date().toISOString(),
        received_at: hit.date_time || new Date().toISOString(),
        // Required BetRecord fields with defaults
        antebot_bet_id: `hit-${hit.id}`,
        amount: 0,
        payout: 0,
        difficulty: 'expert' as const,
      }));
    } else {
      // In live mode, use regular bets
      return betsQuery.bets;
    }
  }, [isAnalysisMode, hitsQuery.hits, betsQuery.bets]);

  // Focused multiplier statistics from hit stats
  const multiplierStats = useMemo(() => {
    if (!isAnalysisMode || (!focusedBucket && minMultiplier <= 1) || hitStatsQuery.statsByRange.length === 0) {
      return { count: 0, median: null, min: null, max: null, mean: null, method: 'exact' as const };
    }
    const rangeStats = hitStatsQuery.statsByRange[0];
    if (!rangeStats) {
      return { count: 0, median: null, min: null, max: null, mean: null, method: 'exact' as const };
    }
    const stats = rangeStats.stats;
    return {
      count: stats.count,
      median: stats.median,
      mean: stats.mean,
      min: stats.min,
      max: stats.max,
      method: stats.method,
    };
  }, [isAnalysisMode, focusedBucket, minMultiplier, hitStatsQuery.statsByRange]);

  // Extract distinct multipliers from stream data
  const streamMultipliers = useMemo(() => {
    const multipliers = new Set<number>();
    betsData.forEach((bet) => {
      const multiplier = bet.round_result ?? bet.payout_multiplier;
      if (multiplier && multiplier > 0) {
        multipliers.add(Math.round(multiplier * 100) / 100); // Round to 2 decimal places
      }
    });
    return Array.from(multipliers).sort((a, b) => a - b);
  }, [betsData]);

  // Detect difficulty based on highest multiplier seen
  const detectedDifficulty = useMemo(() => {
    if (streamMultipliers.length === 0) return "expert";
    const maxMultiplier = Math.max(...streamMultipliers);
    if (maxMultiplier >= 100000) return "expert";
    if (maxMultiplier >= 10000) return "hard";
    if (maxMultiplier >= 1000) return "medium";
    return "easy";
  }, [streamMultipliers]);

  // Handle show distances functionality
  const handleShowDistances = useCallback((multiplier: number) => {
    setFocusedBucket(multiplier);
    // Switch to analysis mode if not already
    if (mode === 'live') {
      setMode('analysis');
      setMinMultiplier(multiplier);
    }
  }, [setFocusedBucket, mode, setMode, setMinMultiplier]);

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

  // Check for analysis mode errors
  const analysisError = isAnalysisMode && (hitsQuery.isError || hitStatsQuery.isError || hitsBatchQuery.isError);
  const analysisErrorMessage = analysisError 
    ? (hitsQuery.error?.message || hitStatsQuery.error?.message || hitsBatchQuery.error?.message || 'Analysis query failed')
    : null;

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
    <div className="min-h-screen bg-background">
      <StreamDetailHeader
        isPolling={isPolling}
        onTogglePolling={() => setIsPolling(!isPolling)}
        highFrequencyMode={highFrequencyMode}
        onToggleHighFrequencyMode={() => setHighFrequencyMode(!highFrequencyMode)}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Offline Indicator */}
        <OfflineIndicator
          onRetry={() => {
            refetchStream();
            betsQuery.refetch();
            if (isAnalysisMode) {
              hitsQuery.refetch();
              hitStatsQuery.refetch();
              hitsBatchQuery.refetch();
            }
          }}
        />

        {/* Analysis Error Display */}
        {analysisError && (
          <Card className="bg-red-900/20 border-red-500/50">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analysis Error
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-red-300 mb-4">
                {analysisErrorMessage}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    hitsQuery.refetch();
                    hitStatsQuery.refetch();
                    hitsBatchQuery.refetch();
                  }}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry Analysis
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setMode('live')}
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Exit Analysis
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stream Information and Multiplier Tracker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <StreamInfoCard
            streamDetail={streamDetail}
            highFrequencyMode={highFrequencyMode}
            isEditingNotes={isEditingNotes}
            notesValue={notesValue}
            onNotesValueChange={setNotesValue}
            onEditNotes={() => setIsEditingNotes(true)}
            onSaveNotes={handleSaveNotes}
            onCancelEditNotes={() => {
              setIsEditingNotes(false);
              setNotesValue(streamDetail.notes || "");
            }}
            onExportCsv={handleExportCsv}
            onDeleteStream={handleDeleteStream}
            isSavingNotes={updateStreamMutation.isPending}
            isDeletingStream={deleteStreamMutation.isPending}
            hasBets={betsData.length > 0}
          />

          {/* Multiplier Tracker */}
          <MultiplierTracker
            pinnedMultipliers={mode === 'live' 
              ? analyticsState.pinnedMultipliers 
              : new Map(pinnedBuckets.map(bucket => [bucket, { 
                  multiplier: bucket, 
                  tolerance: 0.01,
                  stats: { 
                    count: 0, 
                    lastNonce: 0, 
                    lastGap: 0, 
                    meanGap: 0, 
                    stdGap: 0, 
                    maxGap: 0, 
                    p90Gap: 0, 
                    p99Gap: 0, 
                    ringBuffer: { size: 0, capacity: 50 } as any, // Simplified for analysis mode
                    eta: { value: 0, model: 'theoretical' as const }
                  },
                  alerts: []
                }]))
            }
            streamMultipliers={streamMultipliers}
            difficulty={detectedDifficulty}
            onPin={mode === 'live' ? pinMultiplier : addPinnedBucket}
            onUnpin={mode === 'live' ? unpinMultiplier : removePinnedBucket}
            onShowDistances={handleShowDistances}
            className="h-fit"
          />
        </div>

        {/* Analysis Bar - replaces legacy analysis controls */}
        <AnalysisBar
          mode={mode}
          onModeChange={setMode}
          focusedBucket={focusedBucket}
          onFocusedBucketChange={setFocusedBucket}
          currentRange={currentRange}
          onRangeChange={setCurrentRange}
          maxNonce={streamDetail?.total_bets || 100000}
          minMultiplier={minMultiplier}
          onMinMultiplierChange={setMinMultiplier}
          stats={multiplierStats}
          pinnedBuckets={pinnedBuckets}
          statsByPinnedBuckets={statsByPinnedBuckets}
          onPinnedBucketsChange={(buckets) => {
            // Update pinned buckets through context
            const currentPinned = new Set(pinnedBuckets);
            const newPinned = new Set(buckets);
            
            // Add new buckets
            for (const bucket of newPinned) {
              if (!currentPinned.has(bucket)) {
                addPinnedBucket(bucket);
              }
            }
            
            // Remove old buckets
            for (const bucket of currentPinned) {
              if (!newPinned.has(bucket)) {
                removePinnedBucket(bucket);
              }
            }
          }}
          scopeLabel={scopeLabel}
        />

        <BetsTableCard
          isAnalysisMode={isAnalysisMode}
          betsData={betsData}
          betsLoading={betsLoading}
          isPolling={isPolling}
          highFrequencyMode={highFrequencyMode}
          minMultiplier={minMultiplier}
          hitsQuery={hitsQuery}
          betsQuery={betsQuery}
          focusedBucket={focusedBucket}
          setFocusedBucket={setFocusedBucket}
          pinnedBuckets={pinnedBuckets}
        />
      </div>
    </div>
  );
};

// Wrapper component with AnalysisProvider
const LiveStreamDetail = () => {
  const { id } = useParams<{ id: string }>();
  
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

  return (
    <AnalysisProvider streamId={id}>
      <LiveStreamDetailContent />
    </AnalysisProvider>
  );
};

export default LiveStreamDetail;
