/**
 * Demo component for AnalysisBar
 *
 * Demonstrates the sticky analysis bar functionality with mock data
 */

import React, { useState } from "react";
import { AnalysisBar, AnalysisMode } from "../AnalysisBar";
import { BucketStats } from "@/lib/analysisMath";

const mockStats: BucketStats = {
  count: 43,
  median: 1250,
  mean: 1180,
  min: 45,
  max: 8900,
  method: "exact",
};

const mockStatsByPinnedBuckets: Record<string, BucketStats> = {
  "11200": mockStats,
  "48800": {
    count: 12,
    median: 2500,
    mean: 2200,
    min: 120,
    max: 15000,
    method: "exact",
  },
  "400": {
    count: 156,
    median: 85,
    mean: 92,
    min: 12,
    max: 450,
    method: "exact",
  },
};

export const AnalysisBarDemo: React.FC = () => {
  const [mode, setMode] = useState<AnalysisMode>("live");
  const [focusedBucket, setFocusedBucket] = useState<number | null>(null);
  const [currentRange, setCurrentRange] = useState<[number, number]>([
    60000, 70000,
  ]);
  const [minMultiplier, setMinMultiplier] = useState(1);
  const [pinnedBuckets, setPinnedBuckets] = useState<number[]>([
    11200, 48800, 400,
  ]);

  // Generate scope label based on current state
  const generateScopeLabel = (): string => {
    if (mode === "live") {
      return "Live Mode";
    }

    const [start, end] = currentRange;
    const rangeLabel = `${(start / 1000).toFixed(0)}k–${(end / 1000).toFixed(
      0
    )}k`;

    if (focusedBucket) {
      const bucketLabel = `${(focusedBucket / 1000).toFixed(1)}kx`;
      const stats = mockStatsByPinnedBuckets[focusedBucket.toString()];
      const hitCount = stats?.count || 0;
      return `${hitCount} hits • nonce ${rangeLabel} • bucket ${bucketLabel}`;
    }

    return `nonce ${rangeLabel}`;
  };

  const currentStats = focusedBucket
    ? mockStatsByPinnedBuckets[focusedBucket.toString()] || null
    : null;

  return (
    <div className="min-h-screen bg-background">
      <AnalysisBar
        mode={mode}
        onModeChange={setMode}
        focusedBucket={focusedBucket}
        onFocusedBucketChange={setFocusedBucket}
        currentRange={currentRange}
        onRangeChange={setCurrentRange}
        maxNonce={70000}
        minMultiplier={minMultiplier}
        onMinMultiplierChange={setMinMultiplier}
        stats={currentStats}
        pinnedBuckets={pinnedBuckets}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        onPinnedBucketsChange={setPinnedBuckets}
        scopeLabel={generateScopeLabel()}
      />

      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">Analysis Bar Demo</h1>
        <p className="text-muted-foreground">
          Toggle between Live and Analysis modes to see the different UI states.
          In Analysis mode, you can:
        </p>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Toggle between Live and Analysis modes</li>
          <li>Set minimum multiplier filter</li>
          <li>
            Navigate between nonce ranges using keyboard shortcuts (J/K) or
            buttons
          </li>
          <li>Click on pinned multiplier chips to focus on them</li>
          <li>Remove pinned multipliers using the X button</li>
          <li>View live statistics for the focused bucket</li>
          <li>Use Escape key to exit analysis mode</li>
          <li>Expand range controls for detailed navigation</li>
        </ul>

        <div className="mt-8 p-4 border rounded-lg bg-muted/50">
          <h3 className="font-semibold mb-2">Current State:</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Mode:</strong> {mode}
            </div>
            <div>
              <strong>Focused Bucket:</strong>{" "}
              {focusedBucket ? `${focusedBucket}x` : "None"}
            </div>
            <div>
              <strong>Range:</strong> {currentRange[0].toLocaleString()}–
              {currentRange[1].toLocaleString()}
            </div>
            <div>
              <strong>Min Multiplier:</strong> {minMultiplier}x
            </div>
            <div>
              <strong>Pinned Buckets:</strong>{" "}
              {pinnedBuckets.length > 0
                ? pinnedBuckets.map((b) => `${b}x`).join(", ")
                : "None"}
            </div>
            <div>
              <strong>Scope:</strong> {generateScopeLabel()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisBarDemo;
