import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useRun, useRunHits } from "../lib/hooks";
import { RunActionsBar } from "../components/RunActionsBar";
import { HitFilters } from "../components/HitFilters";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

const StatCard = ({
  label,
  value,
  unit,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  className?: string;
}) => (
  <div className={` ${className}`}>
    <dt
      className="text-sm font-medium"
      style={{ color: "var(--color-text-secondary)" }}
    >
      {label}
    </dt>
    <dd className="mt-1 flex items-baseline gap-x-2">
      <span className="text-2xl font-semibold tracking-tight">{value}</span>
      {unit && (
        <span
          className="text-sm"
          style={{ color: "var(--color-text-tertiary)" }}
        >
          {unit}
        </span>
      )}
    </dd>
  </div>
);

const RunDetail = () => {
  const { id } = useParams<{ id: string }>();

  const [minMultiplier, setMinMultiplier] = useState<number | undefined>();
  const [selectedTargets, setSelectedTargets] = useState<number[]>([]);
  const [hitsPage, setHitsPage] = useState(0);
  const hitsLimit = 100;

  const { data: run, isLoading: runLoading, error: runError } = useRun(id!);
  const { data: hitsData, isLoading: hitsLoading } = useRunHits(id!, {
    min_multiplier: minMultiplier,
    limit: hitsLimit,
    offset: hitsPage * hitsLimit,
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

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard`);
      })
      .catch(() => {
        toast.error("Failed to copy to clipboard");
      });
  };

  const difficultyColorClasses = {
    easy: "bg-green-400/10 text-green-400 ring-green-400/20",
    medium: "bg-yellow-400/10 text-yellow-400 ring-yellow-400/20",
    hard: "bg-orange-400/10 text-orange-400 ring-orange-400/20",
    expert: "bg-red-400/10 text-red-400 ring-red-400/20",
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex flex-col gap-4">
        <div>
          <Link
            to="/"
            className="text-sm inline-flex items-center gap-2 hover:underline"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to runs
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Analysis Run Details
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            Run ID: {id}
          </p>
        </div>
      </header>

      {/* Sticky Actions Bar */}
      <RunActionsBar
        run={run}
        minMultiplier={undefined} // Moved to HitFilters
        onMinMultiplierChange={() => {}} // Not used anymore
        onJumpToNonce={handleJumpToNonce}
      />

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold leading-7">Summary</h2>
              <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-6">
                <StatCard
                  label="Nonce Range"
                  value={
                    <div className="text-lg">
                      {run.summary.count.toLocaleString()}
                    </div>
                  }
                  unit={`(${run.nonce_start.toLocaleString()} - ${run.nonce_end.toLocaleString()})`}
                />
                <StatCard
                  label="Duration"
                  value={formatDuration(run.duration_ms)}
                />
                <StatCard
                  label="Total Hits"
                  value={hitsTotal.toLocaleString()}
                />
                <StatCard
                  label="Max Multiplier"
                  value={`${run.summary.max_multiplier.toFixed(2)}x`}
                />

                <div>
                  <dt
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Difficulty
                  </dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium capitalize ring-1 ring-inset ${
                        difficultyColorClasses[
                          run.difficulty as keyof typeof difficultyColorClasses
                        ]
                      }`}
                    >
                      {run.difficulty}
                    </span>
                  </dd>
                </div>
                <StatCard
                  label="Median Multiplier"
                  value={`${run.summary.median_multiplier.toFixed(2)}x`}
                />
                <StatCard label="Engine" value={run.engine_version} />
                <div className="sm:col-span-1">
                  <dt
                    className="text-sm font-medium"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Targets
                  </dt>
                  <dd className="mt-1">
                    <div className="flex flex-wrap gap-1">
                      {run.targets.slice(0, 6).map((target, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: "var(--color-background)",
                            color: "var(--color-text-secondary)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          {target}x
                        </span>
                      ))}
                      {run.targets.length > 6 && (
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: "var(--color-background)",
                            color: "var(--color-text-tertiary)",
                            border: "1px solid var(--color-border)",
                          }}
                        >
                          +{run.targets.length - 6} more
                        </span>
                      )}
                    </div>
                  </dd>
                </div>
              </dl>
            </div>
          </div>
          {/* Seeds */}
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold leading-7">Seeds</h2>
              <div className="mt-4 grid grid-cols-1 gap-3">
                <div>
                  <label
                    className="block text-xs font-medium mb-2"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Server Seed
                  </label>
                  <div className="flex items-center gap-x-2">
                    <code
                      className="flex-1 text-xs font-mono rounded px-3 py-2 truncate"
                      style={{
                        backgroundColor: "var(--color-background)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {run.server_seed}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(run.server_seed, "Server seed")
                      }
                      className="shrink-0 rounded-md px-2 py-2 text-xs font-medium ring-1 ring-inset hover:bg-gray-50/5"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <label
                    className="block text-xs font-medium mb-2"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    Client Seed
                  </label>
                  <div className="flex items-center gap-x-2">
                    <code
                      className="flex-1 text-xs font-mono rounded px-3 py-2 truncate"
                      style={{
                        backgroundColor: "var(--color-background)",
                        color: "var(--color-text-secondary)",
                        border: "1px solid var(--color-border)",
                      }}
                    >
                      {run.client_seed}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(run.client_seed, "Client seed")
                      }
                      className="shrink-0 rounded-md px-2 py-2 text-xs font-medium ring-1 ring-inset hover:bg-gray-50/5"
                      style={{
                        backgroundColor: "var(--color-surface)",
                        color: "var(--color-text-secondary)",
                        borderColor: "var(--color-border)",
                      }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
          {/* Target Counts */}
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: "var(--color-surface)",
              borderColor: "var(--color-border)",
            }}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold leading-7">
                Target Counts
              </h2>
              <div className="mt-4 space-y-2">
                {Object.entries(run.summary.counts_by_target)
                  .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                  .map(([target, count]) => (
                    <div
                      key={target}
                      className="flex items-center justify-between py-2 px-3 rounded"
                      style={{ backgroundColor: "var(--color-background)" }}
                    >
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--color-text-secondary)" }}
                      >
                        ≥{target}x
                      </span>
                      <span className="text-sm font-semibold">
                        {count.toLocaleString()}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Hits Table */}
      <div
        className="rounded-lg border"
        style={{
          backgroundColor: "var(--color-surface)",
          borderColor: "var(--color-border)",
        }}
      >
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

        <div
          className="p-6 border-b"
          style={{ borderColor: "var(--color-border)" }}
        >
          <h3 className="text-base font-semibold">
            Hits ({filteredHitsTotal.toLocaleString()})
          </h3>
        </div>

        {hitsLoading ? (
          <div className="flex justify-center items-center h-32">
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2"
              style={{ borderColor: "var(--color-primary-500)" }}
            ></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead
                  style={{
                    backgroundColor: "var(--color-background)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Nonce
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider">
                      Max Multiplier
                    </th>
                  </tr>
                </thead>
                <tbody
                  className="divide-y"
                  style={{ borderColor: "var(--color-border)" }}
                >
                  {paginatedFilteredHits.map((hit) => (
                    <tr
                      key={hit.nonce}
                      className="hover:bg-gray-50/5 transition-colors"
                    >
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-mono">
                        {hit.nonce.toLocaleString()}
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-sm font-semibold">
                        <span
                          className="inline-flex items-center rounded px-2 py-1 text-xs font-medium"
                          style={{
                            backgroundColor:
                              hit.max_multiplier >= 10
                                ? "var(--color-primary-600)/10"
                                : "var(--color-background)",
                            color:
                              hit.max_multiplier >= 10
                                ? "var(--color-primary-500)"
                                : "var(--color-text-secondary)",
                            border: `1px solid ${
                              hit.max_multiplier >= 10
                                ? "var(--color-primary-500)/20"
                                : "var(--color-border)"
                            }`,
                          }}
                        >
                          {hit.max_multiplier.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hits Pagination */}
            {filteredHitsTotalPages > 1 && (
              <div
                className="px-4 py-3 flex items-center justify-between border-t sm:px-6"
                style={{ borderColor: "var(--color-border)" }}
              >
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setHitsPage(validHitsPage - 1)}
                    disabled={validHitsPage === 0}
                    className="relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHitsPage(validHitsPage + 1)}
                    disabled={validHitsPage >= filteredHitsTotalPages - 1}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p
                      className="text-sm"
                      style={{ color: "var(--color-text-secondary)" }}
                    >
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
                      <span className="font-medium">{filteredHitsTotal}</span>{" "}
                      hits
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setHitsPage(validHitsPage - 1)}
                        disabled={validHitsPage === 0}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium hover:bg-gray-50/5 disabled:opacity-50"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <ChevronLeftIcon className="h-5 w-5" />
                      </button>
                      {Array.from(
                        { length: Math.min(filteredHitsTotalPages, 5) },
                        (_, i) => {
                          const pageNum =
                            validHitsPage < 3 ? i : validHitsPage - 2 + i;
                          if (pageNum >= filteredHitsTotalPages) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setHitsPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === validHitsPage
                                  ? "z-10"
                                  : "hover:bg-gray-50/5"
                              }`}
                              style={{
                                borderColor: "var(--color-border)",
                                backgroundColor:
                                  pageNum === validHitsPage
                                    ? "var(--color-primary-600)"
                                    : "transparent",
                                color:
                                  pageNum === validHitsPage
                                    ? "white"
                                    : "var(--color-text-secondary)",
                              }}
                            >
                              {pageNum + 1}
                            </button>
                          );
                        }
                      )}
                      <button
                        onClick={() => setHitsPage(validHitsPage + 1)}
                        disabled={validHitsPage >= filteredHitsTotalPages - 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium hover:bg-gray-50/5 disabled:opacity-50"
                        style={{ borderColor: "var(--color-border)" }}
                      >
                        <ChevronRightIcon className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}

            {paginatedFilteredHits.length === 0 && !hitsLoading && (
              <div className="text-center py-12">
                <div style={{ color: "var(--color-text-secondary)" }}>
                  {minMultiplier || selectedTargets.length > 0
                    ? `No hits found with the current filters.`
                    : "No hits found."}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default RunDetail;
