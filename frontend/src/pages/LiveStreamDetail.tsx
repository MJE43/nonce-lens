import { useState, useEffect, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  useEnhancedStreamDetail,
  useEnhancedDeleteStream,
  useEnhancedUpdateStream,
} from "@/hooks/useEnhancedLiveStreams";
import { useStreamBetsQuery } from "@/hooks/useStreamBetsQuery";
import { liveStreamsApi } from "../lib/api";

import OfflineIndicator from "@/components/OfflineIndicator";
import { showSuccessToast, showErrorToast } from "../lib/errorHandling";
import { ArrowLeft } from "lucide-react";

// ShadCN Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StreamDetailHeader } from "@/components/live-streams/StreamDetailHeader";
import { StreamInfoCard } from "@/components/live-streams/StreamInfoCard";
import { BetsTableCard } from "@/test/BetsTableCard";

const LiveStreamDetailContent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // State for editing notes
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  // State for UI controls only
  const [isPolling, setIsPolling] = useState(true);
  const [highFrequencyMode, setHighFrequencyMode] = useState(true);

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

  if (streamLoading || betsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="space-y-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (streamError || !streamDetail) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-destructive">Stream Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
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
        onToggleHighFrequencyMode={() =>
          setHighFrequencyMode(!highFrequencyMode)
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Offline Indicator */}
        <OfflineIndicator
          onRetry={() => {
            refetchStream();
            betsQuery.refetch();
          }}
        />

        {/* Stream Information */}
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
          hasBets={betsQuery.bets.length > 0}
        />

        {/* Bets Table */}
        <BetsTableCard
          streamId={id!}
          isPolling={isPolling}
          highFrequencyMode={highFrequencyMode}
        />
      </div>
    </div>
  );
};

// Main component
const LiveStreamDetail = () => {
  const { id } = useParams<{ id: string }>();

  // Route parameter validation
  if (!id) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Stream ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle className="text-destructive">
              Invalid Stream ID Format
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
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

  return <LiveStreamDetailContent />;
};

export default LiveStreamDetail;
