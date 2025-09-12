/**
 * Demo component to showcase AnalysisProvider functionality
 * This demonstrates the key features implemented in task 6
 */

import React from 'react';
import { useAnalysis } from '@/contexts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const AnalysisDemo: React.FC = () => {
  const analysis = useAnalysis();

  const handleModeToggle = () => {
    analysis.setMode(analysis.mode === 'live' ? 'analysis' : 'live');
  };

  const handleSetFocusedBucket = () => {
    analysis.setFocusedBucket(analysis.focusedBucket ? null : 11200);
  };

  const handleAddPinnedBucket = () => {
    analysis.addPinnedBucket(48800);
  };

  const handleSetRange = () => {
    const [start] = analysis.currentRange;
    analysis.setCurrentRange([start + 10000, start + 20000]);
  };

  const handleSetTestHits = () => {
    const testHits = [
      { id: 1, nonce: 1000, bucket: 11200, distance_prev: null, date_time: null },
      { id: 2, nonce: 2000, bucket: 11200, distance_prev: 1000, date_time: null },
      { id: 3, nonce: 3500, bucket: 48800, distance_prev: null, date_time: null },
    ];
    analysis.setHits(testHits);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>Analysis Context Demo</CardTitle>
        <p className="text-sm text-muted-foreground">
          Demonstrating the AnalysisProvider functionality from task 6
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current State Display */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium">Mode:</label>
            <Badge variant={analysis.mode === 'analysis' ? 'default' : 'secondary'}>
              {analysis.mode}
            </Badge>
          </div>
          <div>
            <label className="text-sm font-medium">Stream ID:</label>
            <p className="text-sm font-mono">{analysis.streamId}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Focused Bucket:</label>
            <p className="text-sm">{analysis.focusedBucket || 'None'}</p>
          </div>
          <div>
            <label className="text-sm font-medium">Current Range:</label>
            <p className="text-sm">{analysis.currentRange.join(' - ')}</p>
          </div>
        </div>

        {/* Scope Label */}
        <div>
          <label className="text-sm font-medium">Scope Label:</label>
          <p className="text-sm bg-muted p-2 rounded">{analysis.scopeLabel}</p>
        </div>

        {/* Pinned Buckets */}
        <div>
          <label className="text-sm font-medium">Pinned Buckets:</label>
          <div className="flex gap-2 mt-1">
            {analysis.pinnedBuckets.length > 0 ? (
              analysis.pinnedBuckets.map(bucket => (
                <Badge key={bucket} variant="outline">
                  {bucket}x
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">None</p>
            )}
          </div>
        </div>

        {/* Stats by Pinned Buckets */}
        {Object.keys(analysis.statsByPinnedBuckets).length > 0 && (
          <div>
            <label className="text-sm font-medium">Stats by Pinned Buckets:</label>
            <div className="mt-1 space-y-1">
              {Object.entries(analysis.statsByPinnedBuckets).map(([bucket, stats]) => (
                <div key={bucket} className="text-sm bg-muted p-2 rounded">
                  <strong>{bucket}x:</strong> Count: {stats.count}, 
                  Median: {stats.median || 'N/A'}, 
                  Mean: {stats.mean || 'N/A'}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hits Data */}
        <div>
          <label className="text-sm font-medium">Hits Data:</label>
          <p className="text-sm">{analysis.hits.length} hits loaded</p>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={handleModeToggle} variant="outline">
            Toggle Mode
          </Button>
          <Button onClick={handleSetFocusedBucket} variant="outline">
            {analysis.focusedBucket ? 'Clear Focus' : 'Focus 11200x'}
          </Button>
          <Button onClick={handleAddPinnedBucket} variant="outline">
            Pin 48800x
          </Button>
          <Button onClick={handleSetRange} variant="outline">
            Shift Range +10k
          </Button>
          <Button onClick={handleSetTestHits} variant="outline">
            Load Test Hits
          </Button>
          <Button onClick={analysis.resetAnalysisData} variant="outline">
            Reset Data
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};