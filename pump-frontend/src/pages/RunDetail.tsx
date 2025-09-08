import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { useRun, useRunHits } from "../lib/hooks";
import { runsApi } from "../lib/api";

const RunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [minMultiplier, setMinMultiplier] = useState<number | undefined>();
  const [hitsPage, setHitsPage] = useState(0);
  const hitsLimit = 100;

  const { data: run, isLoading: runLoading, error: runError } = useRun(id!);
  const { data: hitsData, isLoading: hitsLoading } = useRunHits(id!, {
    min_multiplier: minMultiplier,
    limit: hitsLimit,
    offset: hitsPage * hitsLimit,
  });

  if (!id) {
    return <div>Invalid run ID</div>;
  }

  if (runLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-red-800">
          Error loading run: {runError?.message || "Run not found"}
        </div>
        <Link to="/" className="mt-2 text-blue-600 hover:underline">
          ← Back to runs
        </Link>
      </div>
    );
  }

  const hits = hitsData?.hits || [];
  const hitsTotal = hitsData?.total || 0;
  const hitsTotalPages = Math.ceil(hitsTotal / hitsLimit);

  const formatDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatRange = (start: number, end: number) => {
    const count = end - start + 1;
    return `${start.toLocaleString()}-${end.toLocaleString()} (${count.toLocaleString()} nonces)`;
  };

  const handleDuplicate = () => {
    const params = new URLSearchParams({
      server_seed: run.server_seed,
      client_seed: run.client_seed,
      start: run.nonce_start.toString(),
      end: run.nonce_end.toString(),
      difficulty: run.difficulty,
      targets: run.targets.join(","),
    });
    navigate(`/new?${params.toString()}`);
  };

  const handleDownloadHits = () => {
    const url = runsApi.getHitsCsvUrl(id);
    window.open(url, "_blank");
  };

  const handleDownloadFull = () => {
    const url = runsApi.getFullCsvUrl(id);
    window.open(url, "_blank");
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/" className="text-blue-600 hover:underline text-sm">
            ← Back to runs
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            Analysis Run Details
          </h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleDuplicate}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Duplicate
          </button>
          <button
            onClick={handleDownloadHits}
            className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Download Hits CSV
          </button>
          <button
            onClick={handleDownloadFull}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
          >
            Download Full CSV
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Range</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatRange(run.nonce_start, run.nonce_end)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Duration</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {formatDuration(run.duration_ms)}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Total Hits</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {run.summary.count.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Max Multiplier
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {run.summary.max_multiplier.toFixed(2)}x
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Difficulty</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  run.difficulty === "easy"
                    ? "bg-green-100 text-green-800"
                    : run.difficulty === "medium"
                    ? "bg-yellow-100 text-yellow-800"
                    : run.difficulty === "hard"
                    ? "bg-orange-100 text-orange-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {run.difficulty}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Median Multiplier
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {run.summary.median_multiplier.toFixed(2)}x
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Engine Version
            </dt>
            <dd className="mt-1 text-sm text-gray-900">{run.engine_version}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Targets</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {run.targets.join(", ")}x
            </dd>
          </div>
        </div>
      </div>

      {/* Target Counts */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Target Counts
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(run.summary.counts_by_target)
            .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
            .map(([target, count]) => (
              <div
                key={target}
                className="text-center p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-lg font-semibold text-gray-900">
                  {count.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500">≥{target}x</div>
              </div>
            ))}
        </div>
      </div>

      {/* Seeds */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Seeds</h3>
        <div className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Server Seed</dt>
            <dd className="mt-1 flex items-center">
              <code className="flex-1 text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded break-all">
                {run.server_seed}
              </code>
              <button
                onClick={() => copyToClipboard(run.server_seed, "Server seed")}
                className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Copy
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Client Seed</dt>
            <dd className="mt-1 flex items-center">
              <code className="flex-1 text-sm font-mono text-gray-900 bg-gray-50 p-2 rounded">
                {run.client_seed}
              </code>
              <button
                onClick={() => copyToClipboard(run.client_seed, "Client seed")}
                className="ml-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Copy
              </button>
            </dd>
          </div>
        </div>
      </div>

      {/* Hits Table */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Hits ({hitsTotal.toLocaleString()})
            </h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center">
                <label
                  htmlFor="minMultiplier"
                  className="text-sm font-medium text-gray-700 mr-2"
                >
                  Min Multiplier:
                </label>
                <input
                  type="number"
                  id="minMultiplier"
                  step="0.1"
                  min="1"
                  value={minMultiplier || ""}
                  onChange={(e) => {
                    const val = e.target.value
                      ? parseFloat(e.target.value)
                      : undefined;
                    setMinMultiplier(val);
                    setHitsPage(0);
                  }}
                  placeholder="All"
                  className="w-24 border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {hitsLoading ? (
          <div className="flex justify-center items-center h-32">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nonce
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Max Multiplier
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {hits.map((hit) => (
                    <tr key={hit.nonce} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {hit.nonce.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {hit.max_multiplier.toFixed(2)}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hits Pagination */}
            {hitsTotalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setHitsPage(hitsPage - 1)}
                    disabled={hitsPage === 0}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHitsPage(hitsPage + 1)}
                    disabled={hitsPage >= hitsTotalPages - 1}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing{" "}
                      <span className="font-medium">
                        {hitsPage * hitsLimit + 1}
                      </span>{" "}
                      to{" "}
                      <span className="font-medium">
                        {Math.min((hitsPage + 1) * hitsLimit, hitsTotal)}
                      </span>{" "}
                      of <span className="font-medium">{hitsTotal}</span> hits
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setHitsPage(hitsPage - 1)}
                        disabled={hitsPage === 0}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      {Array.from(
                        { length: Math.min(hitsTotalPages, 5) },
                        (_, i) => {
                          const pageNum = hitsPage < 3 ? i : hitsPage - 2 + i;
                          if (pageNum >= hitsTotalPages) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setHitsPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pageNum === hitsPage
                                  ? "z-10 bg-blue-50 border-blue-500 text-blue-600"
                                  : "bg-white border-gray-300 text-gray-500 hover:bg-gray-50"
                              }`}
                            >
                              {pageNum + 1}
                            </button>
                          );
                        }
                      )}
                      <button
                        onClick={() => setHitsPage(hitsPage + 1)}
                        disabled={hitsPage >= hitsTotalPages - 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}

            {hits.length === 0 && !hitsLoading && (
              <div className="text-center py-12">
                <div className="text-gray-500">
                  {minMultiplier
                    ? `No hits found with multiplier ≥ ${minMultiplier}x`
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
