import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useRun, useRunHits } from "../lib/hooks";
import { RunActionsBar } from "../components/RunActionsBar";
import { HitFilters } from "../components/HitFilters";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { distancesApi, type DistanceStatsResponse } from "../lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Separator } from "../components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";

type DistanceMetricStats = {
  mean: number;
  median: number;
  min: number;
  max: number;
  p90: number;
  p99: number;
  stddev: number;
  cv: number;
};

const formatNumber = (n: number | string | null | undefined) => {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return new Intl.NumberFormat().format(Number(n));
};

const formatInteger = (n: number) => {
  return new Intl.NumberFormat().format(Math.trunc(n));
};

const DistanceStats = ({
  runId,
  multipliers,
  selected,
  onChangeSelected,
}: {
  runId: string;
  multipliers: number[];
  selected: number;
  onChangeSelected: (m: number) => void;
}) => {
  const [data, setData] = useState<DistanceStatsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    distancesApi
      .get(runId, { multiplier: selected })
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch((e: unknown) => {
        const msg = (e as Error)?.message || "Failed to load distances";
        if (!cancelled) setError(msg);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [runId, selected]);

  const csvUrl = useMemo(() => {
    return distancesApi.getCsvUrl(runId, selected);
  }, [runId, selected]);

  return (
    <Card className="bg-card/50 border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Distances for {selected}×
          </CardTitle>
          <div className="flex items-center gap-2">
            <select
              className="block border rounded-md text-sm px-2 py-1 bg-background"
              value={selected}
              onChange={(e) => onChangeSelected(parseFloat(e.target.value))}
            >
              {multipliers.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <Button size="sm" asChild>
              <a href={csvUrl}>Download CSV</a>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
        {error && <div className="text-sm text-destructive">{error}</div>}
        {!loading && !error && data && (
          <div className="space-y-6">
            {data.count < 2 ? (
              <div className="text-sm text-muted-foreground">
                Not enough data (need ≥2 occurrences).
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Primary Stats */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Count & Central Tendency
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Count
                        </span>
                        <span className="text-lg font-semibold">
                          {data.count}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Mean
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).mean
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Median
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).median
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Range Stats */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Range & Percentiles
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Min
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).min
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Max
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).max
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          p90
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).p90
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          p99
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).p99
                          )}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Variability Stats */}
                  <Card className="bg-card/50 border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Variability
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Std Dev
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber(
                            (data.stats as DistanceMetricStats).stddev
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          CV
                        </span>
                        <span className="text-lg font-semibold">
                          {formatNumber((data.stats as DistanceMetricStats).cv)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-medium mb-4">Raw Distances</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>From → To</TableHead>
                        <TableHead>Distance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.nonces.slice(1).map((to: number, idx: number) => {
                        const from = data.nonces[idx];
                        const dist = data.distances[idx];
                        return (
                          <TableRow key={idx}>
                            <TableCell>{idx + 1}</TableCell>
                            <TableCell>
                              {from} → {to}
                            </TableCell>
                            <TableCell>
                              {formatInteger(dist as number)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const RunDetail = () => {
  const { id } = useParams<{ id: string }>();

  const [minMultiplier, setMinMultiplier] = useState<number | undefined>();
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [hitsPage, setHitsPage] = useState(0);
  const hitsLimit = 100;
  const [distancesOpen, setDistancesOpen] = useState(false);
  const [selectedDistanceMultiplier, setSelectedDistanceMultiplier] = useState<
    number | null
  >(null);

  const { data: run, isLoading: runLoading, error: runError } = useRun(id!);
  const { data: hitsData, isLoading: hitsLoading } = useRunHits(id!, {
    min_multiplier: minMultiplier,
    limit: hitsLimit,
    offset: hitsPage * hitsLimit,
    include_distance: "per_multiplier",
  });

  const hits = hitsData?.rows || [];
  const hitsTotal = hitsData?.total || 0;

  // Use server-filtered hits (min_multiplier via API). Target checkboxes
  // synchronize to minMultiplier so results come from the API for parity.
  const filteredHits = hits;

  // Calculate pagination based on server totals
  const filteredHitsTotal = hitsTotal;
  const filteredHitsTotalPages = Math.ceil(filteredHitsTotal / hitsLimit);

  // Ensure hitsPage doesn't exceed available pages
  const validHitsPage = Math.min(
    hitsPage,
    Math.max(0, filteredHitsTotalPages - 1)
  );

  // API already paginates; just use current page's rows
  const paginatedFilteredHits = filteredHits;

  const handleJumpToNonce = (nonce: number) => {
    // TODO: Implement jump to nonce functionality
    console.log("Jump to nonce:", nonce);
    toast.error("Jump to nonce functionality not yet implemented");
  };

  // No local target toggling; target buttons map to minMultiplier changes

  const handleResetFilters = () => {
    setMinMultiplier(undefined);
    setSelectedTargets([]);
    setHitsPage(0);
  };

  // Local helpers are declared above; no duplicates here

  if (!id) {
    return <div>Invalid run ID</div>;
  }

  if (runLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: "var(--color-primary-500)" }}
        ></div>
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div
        className="rounded-md p-4"
        style={{ backgroundColor: "#2c1919", borderColor: "#5a2525" }}
      >
        <div style={{ color: "#f8b4b4" }}>
          Error loading run: {runError?.message || "Run not found"}
        </div>
        <Link
          to="/"
          className="mt-2 hover:underline"
          style={{ color: "var(--color-primary-500)" }}
        >
          ← Back to runs
        </Link>
      </div>
    );
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Button variant="ghost" size="sm" asChild className="pl-0">
            <Link
              to="/"
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Back to runs
            </Link>
          </Button>

          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Analysis Run Details
            </h1>
            <p className="text-muted-foreground">
              Run ID:{" "}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                {id}
              </code>
            </p>
          </div>
        </div>

        {/* Actions Bar */}
        <RunActionsBar
          run={run}
          minMultiplier={undefined}
          onMinMultiplierChange={() => {}}
          onJumpToNonce={handleJumpToNonce}
        />

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Nonce Range
                    </p>
                    <div>
                      <div className="text-2xl font-bold">
                        {run.summary.count.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {run.nonce_start.toLocaleString()} -{" "}
                        {run.nonce_end.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Duration
                    </p>
                    <div className="text-2xl font-bold">
                      {formatDuration(run.duration_ms)}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Total Hits
                    </p>
                    <div className="text-2xl font-bold">
                      {hitsTotal.toLocaleString()}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Max Multiplier
                    </p>
                    <div className="text-2xl font-bold">
                      {run.summary.max_multiplier.toFixed(2)}x
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Additional Info Card */}
            <Card>
              <CardHeader>
                <CardTitle>Run Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Difficulty
                    </p>
                    <Badge
                      variant={
                        run.difficulty === "expert"
                          ? "destructive"
                          : run.difficulty === "hard"
                          ? "default"
                          : "secondary"
                      }
                      className="capitalize"
                    >
                      {run.difficulty}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Median Multiplier
                    </p>
                    <div className="text-lg font-semibold">
                      {run.summary.median_multiplier.toFixed(2)}x
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">
                      Engine
                    </p>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {run.engine_version}
                    </code>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground">
                    Targets
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {run.targets.slice(0, 8).map((target, index) => (
                      <Badge key={index} variant="outline">
                        {target}x
                      </Badge>
                    ))}
                    {run.targets.length > 8 && (
                      <Badge variant="secondary">
                        +{run.targets.length - 8} more
                      </Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-8">
            {/* Target Counts */}
            <Card>
              <CardHeader>
                <CardTitle>Target Counts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(run.summary.counts_by_target)
                  .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                  .map(([target, count]) => (
                    <Button
                      key={target}
                      variant="ghost"
                      className="w-full justify-between h-auto p-3 text-left hover:bg-muted/50"
                      onClick={() => {
                        setSelectedDistanceMultiplier(parseFloat(target));
                        setDistancesOpen(true);
                      }}
                    >
                      <span className="text-sm font-medium text-muted-foreground">
                        ≥{target}x
                      </span>
                      <Badge variant="secondary">
                        {count.toLocaleString()}
                      </Badge>
                    </Button>
                  ))}
              </CardContent>
            </Card>

            {/* Distances */}
            <Card>
              <CardHeader>
                <Button
                  variant="ghost"
                  className="w-full justify-between h-auto p-0 text-left"
                  onClick={() => setDistancesOpen((v) => !v)}
                >
                  <CardTitle>Distances</CardTitle>
                  <span className="text-sm text-muted-foreground">
                    {distancesOpen ? "Hide" : "Show"}
                  </span>
                </Button>
              </CardHeader>
              {distancesOpen && (
                <CardContent>
                  {run.targets.length > 0 && (
                    <DistanceStats
                      runId={id!}
                      multipliers={run.targets}
                      selected={
                        (selectedDistanceMultiplier ?? run.targets[0]) as number
                      }
                      onChangeSelected={(m) => setSelectedDistanceMultiplier(m)}
                    />
                  )}
                </CardContent>
              )}
            </Card>
          </div>
        </div>

        {/* Hits Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Hits ({filteredHitsTotal.toLocaleString()})</CardTitle>
            </div>
            {/* Hit Filters */}
            <HitFilters
              minMultiplier={minMultiplier}
              selectedTargets={selectedTargets}
              availableTargets={run.targets}
              onMinMultiplierChange={(value) => {
                setMinMultiplier(value);
                setHitsPage(0);
              }}
              onResetFilters={handleResetFilters}
            />
          </CardHeader>

          <CardContent className="p-0">
            {hitsLoading ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nonce</TableHead>
                      <TableHead>Max Multiplier</TableHead>
                      <TableHead>
                        <span title="Distance since previous same-multiplier hit in this run's range.">
                          Distance
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFilteredHits.map((hit) => (
                      <TableRow key={hit.nonce}>
                        <TableCell className="font-mono">
                          {hit.nonce.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              hit.max_multiplier >= 10 ? "default" : "outline"
                            }
                            className="font-semibold"
                          >
                            {hit.max_multiplier.toFixed(2)}x
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {hit.distance_prev == null
                            ? "—"
                            : formatInteger(hit.distance_prev)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {filteredHitsTotalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t">
                    <div className="flex-1 flex justify-between sm:hidden">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHitsPage(validHitsPage - 1)}
                        disabled={validHitsPage === 0}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setHitsPage(validHitsPage + 1)}
                        disabled={validHitsPage >= filteredHitsTotalPages - 1}
                      >
                        Next
                      </Button>
                    </div>
                    <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">
                          Showing{" "}
                          <span className="font-medium">
                            {validHitsPage * hitsLimit + 1}
                          </span>{" "}
                          to{" "}
                          <span className="font-medium">
                            {Math.min(
                              (validHitsPage + 1) * hitsLimit,
                              filteredHitsTotal
                            )}
                          </span>{" "}
                          of{" "}
                          <span className="font-medium">
                            {filteredHitsTotal}
                          </span>{" "}
                          hits
                        </p>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHitsPage(validHitsPage - 1)}
                          disabled={validHitsPage === 0}
                        >
                          <ChevronLeftIcon className="h-4 w-4" />
                        </Button>
                        {Array.from(
                          { length: Math.min(filteredHitsTotalPages, 5) },
                          (_, i) => {
                            const pageNum =
                              validHitsPage < 3 ? i : validHitsPage - 2 + i;
                            if (pageNum >= filteredHitsTotalPages) return null;
                            return (
                              <Button
                                key={pageNum}
                                variant={
                                  pageNum === validHitsPage
                                    ? "default"
                                    : "outline"
                                }
                                size="sm"
                                onClick={() => setHitsPage(pageNum)}
                              >
                                {pageNum + 1}
                              </Button>
                            );
                          }
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHitsPage(validHitsPage + 1)}
                          disabled={validHitsPage >= filteredHitsTotalPages - 1}
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {paginatedFilteredHits.length === 0 && !hitsLoading && (
                  <div className="text-center py-12">
                    <div className="text-muted-foreground">
                      {minMultiplier || selectedTargets.length > 0
                        ? `No hits found with the current filters.`
                        : "No hits found."}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default RunDetail;
