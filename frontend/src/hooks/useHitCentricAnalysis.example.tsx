/**
 * Example usage of hit-centric analysis hooks
 * 
 * This file demonstrates how to use the hit-centric data fetching hooks
 * for analyzing ultra-rare multipliers across large nonce ranges.
 */

import React from 'react';
import {
  useHits,
  useHitStats,
  useGlobalHitStats,
  useHitsBatch,
} from './useHitCentricAnalysis';

// Example 1: Basic hit analysis for a specific multiplier
export function BasicHitAnalysis({ streamId }: { streamId: string }) {
  const { hits, totalInRange, isLoading, error } = useHits({
    streamId,
    bucket: 11200.00, // Analyzing 11,200× multiplier
    range: [60000, 70000], // Nonce range 60k-70k
  });

  if (isLoading) return <div>Loading hits...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h3>Hits for 11,200× in range 60k-70k</h3>
      <p>Total hits: {totalInRange}</p>
      <ul>
        {hits.map((hit) => (
          <li key={hit.id}>
            Nonce: {hit.nonce}, Distance: {hit.distance_prev || 'N/A'}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Example 2: Statistics analysis across multiple ranges
export function RangeStatistics({ streamId }: { streamId: string }) {
  const { statsByRange, isLoading } = useHitStats({
    streamId,
    bucket: 48800.00, // Analyzing 48,800× multiplier
    ranges: ['0-20000', '20000-40000', '40000-60000'], // Multiple 20k ranges
  });

  if (isLoading) return <div>Loading statistics...</div>;

  return (
    <div>
      <h3>Statistics for 48,800× across ranges</h3>
      {statsByRange.map((rangeStats) => (
        <div key={rangeStats.range}>
          <h4>Range: {rangeStats.range}</h4>
          <p>Count: {rangeStats.stats.count}</p>
          <p>Median distance: {rangeStats.stats.median || 'N/A'}</p>
          <p>Mean distance: {rangeStats.stats.mean || 'N/A'}</p>
        </div>
      ))}
    </div>
  );
}

// Example 3: Global statistics with theoretical comparison
export function GlobalAnalysis({ streamId }: { streamId: string }) {
  const { globalStats, theoreticalEta, confidenceInterval, isLoading } = useGlobalHitStats({
    streamId,
    bucket: 11200.00,
  });

  if (isLoading) return <div>Loading global statistics...</div>;

  return (
    <div>
      <h3>Global Analysis for 11,200×</h3>
      {globalStats && (
        <div>
          <p>Total occurrences: {globalStats.count}</p>
          <p>Median distance: {globalStats.median || 'N/A'}</p>
          <p>Theoretical ETA: {theoreticalEta || 'N/A'}</p>
          {confidenceInterval && (
            <p>
              Confidence interval: [{confidenceInterval[0]}, {confidenceInterval[1]}]
            </p>
          )}
          <p>Method: {globalStats.method}</p>
        </div>
      )}
    </div>
  );
}

// Example 4: Multi-bucket comparison
export function MultiBucketComparison({ streamId }: { streamId: string }) {
  const { hitsByBucket, statsByBucket, isLoading } = useHitsBatch({
    streamId,
    buckets: [11200.00, 48800.00, 99999.00], // Compare multiple rare multipliers
    range: [0, 70000], // Full range analysis
    limitPerBucket: 100,
  });

  if (isLoading) return <div>Loading batch analysis...</div>;

  return (
    <div>
      <h3>Multi-Bucket Comparison</h3>
      {Object.entries(hitsByBucket).map(([bucket, hits]) => (
        <div key={bucket}>
          <h4>Bucket: {bucket}×</h4>
          <p>Hits found: {hits.length}</p>
          <p>Statistics: {JSON.stringify(statsByBucket[bucket])}</p>
        </div>
      ))}
    </div>
  );
}

// Example 5: Range navigation pattern
export function RangeNavigator({ streamId }: { streamId: string }) {
  const [currentRange, setCurrentRange] = React.useState<[number, number]>([0, 10000]);
  const [focusedBucket, setFocusedBucket] = React.useState(11200.00);

  const { hits, totalInRange, isLoading } = useHits({
    streamId,
    bucket: focusedBucket,
    range: currentRange,
  });

  const navigateToNextRange = () => {
    const [start, end] = currentRange;
    const rangeSize = end - start;
    setCurrentRange([end, end + rangeSize]);
  };

  const navigateToPrevRange = () => {
    const [start, end] = currentRange;
    const rangeSize = end - start;
    const newStart = Math.max(0, start - rangeSize);
    setCurrentRange([newStart, newStart + rangeSize]);
  };

  return (
    <div>
      <h3>Range Navigator</h3>
      <div>
        <label>
          Multiplier:
          <select
            value={focusedBucket}
            onChange={(e) => setFocusedBucket(Number(e.target.value))}
          >
            <option value={11200.00}>11,200×</option>
            <option value={48800.00}>48,800×</option>
            <option value={99999.00}>99,999×</option>
          </select>
        </label>
      </div>
      
      <div>
        <button onClick={navigateToPrevRange} disabled={currentRange[0] === 0}>
          ← Prev 10k
        </button>
        <span>
          Range: {currentRange[0].toLocaleString()}-{currentRange[1].toLocaleString()}
        </span>
        <button onClick={navigateToNextRange}>Next 10k →</button>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          <p>
            {totalInRange} hits for {focusedBucket}× in current range
          </p>
          <div style={{ maxHeight: '200px', overflow: 'auto' }}>
            {hits.map((hit) => (
              <div key={hit.id}>
                Nonce: {hit.nonce}, Distance: {hit.distance_prev || 'First'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Example 6: Cache-aware component that demonstrates efficient data fetching
export function CacheAwareAnalysis({ streamId }: { streamId: string }) {
  const [selectedRanges, setSelectedRanges] = React.useState([
    [0, 10000],
    [10000, 20000],
    [20000, 30000],
  ]);

  // This will efficiently cache each range separately
  const rangeQueries = selectedRanges.map((range) =>
    useHits({
      streamId,
      bucket: 11200.00,
      range: range as [number, number],
    })
  );

  const allLoading = rangeQueries.some((query) => query.isLoading);
  const totalHits = rangeQueries.reduce((sum, query) => sum + query.hits.length, 0);

  return (
    <div>
      <h3>Cache-Aware Multi-Range Analysis</h3>
      <p>
        Analyzing {selectedRanges.length} ranges with efficient caching
      </p>
      
      {allLoading ? (
        <div>Loading ranges...</div>
      ) : (
        <div>
          <p>Total hits across all ranges: {totalHits}</p>
          {rangeQueries.map((query, index) => (
            <div key={index}>
              Range {selectedRanges[index][0]}-{selectedRanges[index][1]}: {query.hits.length} hits
            </div>
          ))}
        </div>
      )}
    </div>
  );
}