import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useRun, useRunHits } from '../lib/hooks';
import { runsApi } from '../lib/api';
import {
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';

const StatCard = ({
  label,
  value,
  unit,
  className = '',
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  className?: string;
}) => (
  <div className={` ${className}`}>
    <dt
      className="text-sm font-medium"
      style={{ color: 'var(--color-text-secondary)' }}
    >
      {label}
    </dt>
    <dd className="mt-1 flex items-baseline gap-x-2">
      <span className="text-2xl font-semibold tracking-tight">
        {value}
      </span>
      {unit && (
        <span
          className="text-sm"
          style={{ color: 'var(--color-text-tertiary)' }}
        >
          {unit}
        </span>
      )}
    </dd>
  </div>
);

const RunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [minMultiplier, setMinMultiplier] = useState<number | undefined>();
  const [hitsPage, setHitsPage] = useState(0);
  const hitsLimit = 100;

  const {
    data: run,
    isLoading: runLoading,
    error: runError,
  } = useRun(id!);
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
        <div
          className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-primary-500)' }}
        ></div>
      </div>
    );
  }

  if (runError || !run) {
    return (
      <div
        className="rounded-md p-4"
        style={{ backgroundColor: '#2c1919', borderColor: '#5a2525' }}
      >
        <div style={{ color: '#f8b4b4' }}>
          Error loading run: {runError?.message || 'Run not found'}
        </div>
        <Link
          to="/"
          className="mt-2 hover:underline"
          style={{ color: 'var(--color-primary-500)' }}
        >
          ← Back to runs
        </Link>
      </div>
    );
  }

  const hits = hitsData?.rows || [];
  const hitsTotal = hitsData?.total || 0;
  const hitsTotalPages = Math.ceil(hitsTotal / hitsLimit);

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    const seconds = (ms / 1000).toFixed(2);
    return `${seconds}s`;
  };

  const formatRange = (start: number, end: number) => {
    const count = end - start + 1;
    return `${start.toLocaleString()}-${end.toLocaleString()} (${count.toLocaleString()})`;
  };

  const handleDuplicate = () => {
    const params = new URLSearchParams({
      server_seed: run.server_seed,
      client_seed: run.client_seed,
      start: run.nonce_start.toString(),
      end: run.nonce_end.toString(),
      difficulty: run.difficulty,
      targets: run.targets.join(','),
    });
    navigate(`/new?${params.toString()}`);
  };

  const handleDownload = (type: 'hits' | 'full') => {
    const url = type === 'hits'
        ? runsApi.getHitsCsvUrl(id)
        : runsApi.getFullCsvUrl(id);
    window.open(url, '_blank');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        toast.success(`${label} copied to clipboard`);
      })
      .catch(() => {
        toast.error('Failed to copy to clipboard');
      });
  };

  const difficultyColorClasses = {
    easy: 'bg-green-400/10 text-green-400 ring-green-400/20',
    medium: 'bg-yellow-400/10 text-yellow-400 ring-yellow-400/20',
    hard: 'bg-orange-400/10 text-orange-400 ring-orange-400/20',
    expert: 'bg-red-400/10 text-red-400 ring-red-400/20',
  };

  return (
    <div className="space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-4">
        <div>
          <Link
            to="/"
            className="text-sm inline-flex items-center gap-2 hover:underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            <ChevronLeftIcon className="h-4 w-4" />
            Back to runs
          </Link>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
            Analysis Run Details
          </h1>
          <p
            className="mt-1 text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}
          >
            Run ID: {id}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-x-3">
          <button
            onClick={handleDuplicate}
            className="flex items-center gap-x-2 rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
            Duplicate
          </button>
          <button
            onClick={() => handleDownload('hits')}
            className="flex items-center gap-x-2 rounded-md px-3 py-2 text-sm font-semibold ring-1 ring-inset"
            style={{
              backgroundColor: 'var(--color-surface)',
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-border)',
            }}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Hits CSV
          </button>
          <button
            onClick={() => handleDownload('full')}
            className="flex items-center gap-x-2 rounded-md px-3 py-2 text-sm font-semibold text-white"
            style={{ backgroundColor: 'var(--color-primary-600)' }}
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            Full CSV
          </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Summary Card */}
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold leading-7">
                Summary
              </h2>
              <dl className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8">
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
                    style={{ color: 'var(--color-text-secondary)' }}
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
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Targets
                  </dt>
                  <dd className="mt-1 text-sm">{run.targets.join(', ')}x</dd>
                </div>
              </dl>
            </div>
          </div>
          {/* Seeds */}
          <div
            className="rounded-lg border"
            style={{
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold leading-7">
                Seeds
              </h2>
              <div className="mt-6 space-y-4">
                <div>
                  <dt
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Server Seed
                  </dt>
                  <dd className="mt-1 flex items-center gap-x-2">
                    <code className="flex-1 text-sm font-mono rounded px-2 py-1 truncate"
                      style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {run.server_seed}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(run.server_seed, 'Server seed')
                      }
                      className="rounded-md p-1.5 text-sm ring-1 ring-inset"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-secondary)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      Copy
                    </button>
                  </dd>
                </div>
                <div>
                  <dt
                    className="text-sm font-medium"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    Client Seed
                  </dt>
                  <dd className="mt-1 flex items-center gap-x-2">
                    <code className="flex-1 text-sm font-mono rounded px-2 py-1"
                       style={{
                        backgroundColor: 'var(--color-background)',
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      {run.client_seed}
                    </code>
                    <button
                      onClick={() =>
                        copyToClipboard(run.client_seed, 'Client seed')
                      }
                      className="rounded-md p-1.5 text-sm ring-1 ring-inset"
                      style={{
                        backgroundColor: 'var(--color-surface)',
                        color: 'var(--color-text-secondary)',
                        borderColor: 'var(--color-border)',
                      }}
                    >
                      Copy
                    </button>
                  </dd>
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
              backgroundColor: 'var(--color-surface)',
              borderColor: 'var(--color-border)',
            }}
          >
            <div className="p-6">
              <h2 className="text-base font-semibold leading-7">
                Target Counts
              </h2>
              <div className="mt-6 flow-root">
                <div className="-my-4 divide-y" style={{borderColor: 'var(--color-border)'}}>
                  {Object.entries(run.summary.counts_by_target)
                    .sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
                    .map(([target, count]) => (
                      <div
                        key={target}
                        className="flex items-center justify-between py-4"
                      >
                        <p
                          className="text-sm font-medium"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          ≥{target}x
                        </p>
                        <p className="text-sm font-semibold">
                          {count.toLocaleString()}
                        </p>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Hits Table */}
      <div
        className="rounded-lg border"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="p-6 border-b" style={{borderColor: 'var(--color-border)'}}>
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold">
              Hits ({hitsTotal.toLocaleString()})
            </h3>
            <div className="flex items-center gap-x-4">
              <div className="flex items-center">
                <label
                  htmlFor="minMultiplier"
                  className="text-sm font-medium mr-2"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  Min Multiplier:
                </label>
                <input
                  type="number"
                  id="minMultiplier"
                  step="0.1"
                  min="1"
                  value={minMultiplier || ''}
                  onChange={(e) => {
                    const val = e.target.value
                      ? parseFloat(e.target.value)
                      : undefined;
                    setMinMultiplier(val);
                    setHitsPage(0);
                  }}
                  placeholder="All"
                  className="w-24 rounded-md py-1.5 px-2 text-sm ring-1 ring-inset"
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text-primary)',
                    borderColor: 'var(--color-border)',
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {hitsLoading ? (
          <div className="flex justify-center items-center h-32">
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2"
              style={{ borderColor: 'var(--color-primary-500)' }}
            ></div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead
                  style={{
                    backgroundColor: 'var(--color-background)',
                    color: 'var(--color-text-secondary)',
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
                <tbody className="divide-y" style={{borderColor: 'var(--color-border)'}}>
                  {hits.map((hit) => (
                    <tr key={hit.nonce} className="hover:bg-gray-50/5">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono">
                        {hit.nonce.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {hit.max_multiplier.toFixed(2)}x
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hits Pagination */}
            {hitsTotalPages > 1 && (
              <div
                className="px-4 py-3 flex items-center justify-between border-t sm:px-6"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setHitsPage(hitsPage - 1)}
                    disabled={hitsPage === 0}
                    className="relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setHitsPage(hitsPage + 1)}
                    disabled={hitsPage >= hitsTotalPages - 1}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border text-sm font-medium rounded-md disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p
                      className="text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      Showing{' '}
                      <span className="font-medium">
                        {hitsPage * hitsLimit + 1}
                      </span>{' '}
                      to{' '}
                      <span className="font-medium">
                        {Math.min((hitsPage + 1) * hitsLimit, hitsTotal)}
                      </span>{' '}
                      of <span className="font-medium">{hitsTotal}</span> hits
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() => setHitsPage(hitsPage - 1)}
                        disabled={hitsPage === 0}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border text-sm font-medium hover:bg-gray-50/5 disabled:opacity-50"
                        style={{borderColor: 'var(--color-border)'}}
                      >
                        <ChevronLeftIcon className="h-5 w-5" />
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
                                  ? 'z-10'
                                  : 'hover:bg-gray-50/5'
                              }`}
                              style={{
                                borderColor: 'var(--color-border)',
                                backgroundColor: pageNum === hitsPage ? 'var(--color-primary-600)' : 'transparent',
                                color: pageNum === hitsPage ? 'white' : 'var(--color-text-secondary)'
                              }}
                            >
                              {pageNum + 1}
                            </button>
                          );
                        }
                      )}
                      <button
                        onClick={() => setHitsPage(hitsPage + 1)}
                        disabled={hitsPage >= hitsTotalPages - 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border text-sm font-medium hover:bg-gray-50/5 disabled:opacity-50"
                        style={{borderColor: 'var(--color-border)'}}
                      >
                        <ChevronRightIcon className="h-5 w-5" />
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}

            {hits.length === 0 && !hitsLoading && (
              <div className="text-center py-12">
                <div style={{ color: 'var(--color-text-secondary)' }}>
                  {minMultiplier
                    ? `No hits found with multiplier ≥ ${minMultiplier}x`
                    : 'No hits found.'}
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
