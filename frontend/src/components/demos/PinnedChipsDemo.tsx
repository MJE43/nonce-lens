/**
 * PinnedChipsDemo Component
 * 
 * Demo component to showcase the pinned multiplier chips system
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BucketStats } from '@/lib/analysisMath';
import { PinnedChipsContainer } from '../PinnedChipsContainer';
import { MultiplierChip } from '../MultiplierChip';

// Mock stats data for demo
const mockStatsByPinnedBuckets: Record<string, BucketStats> = {
  '11200': {
    count: 42,
    median: 1250,
    mean: 1300,
    min: 800,
    max: 2100,
    method: 'exact'
  },
  '48800': {
    count: 15,
    median: 2800,
    mean: 2950,
    min: 1200,
    max: 4500,
    method: 'exact'
  },
  '250': {
    count: 156,
    median: 45,
    mean: 52,
    min: 12,
    max: 180,
    method: 'exact'
  }
};

export const PinnedChipsDemo: React.FC = () => {
  const [pinnedBuckets, setPinnedBuckets] = useState<number[]>([11200, 48800]);
  const [focusedBucket, setFocusedBucket] = useState<number | null>(11200);

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Pinned Multiplier Chips Demo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-sm font-medium mb-2">PinnedChipsContainer</h3>
            <PinnedChipsContainer
              pinnedBuckets={pinnedBuckets}
              statsByPinnedBuckets={mockStatsByPinnedBuckets}
              focusedBucket={focusedBucket}
              onFocusChange={setFocusedBucket}
              onPinnedBucketsChange={setPinnedBuckets}
            />
          </div>

          <div>
            <h3 className="text-sm font-medium mb-2">Individual MultiplierChip Examples</h3>
            <div className="flex gap-2 flex-wrap">
              <MultiplierChip
                bucket={250}
                stats={mockStatsByPinnedBuckets['250']}
                isActive={false}
                onFocus={(bucket) => console.log('Focus:', bucket)}
                onRemove={(bucket) => console.log('Remove:', bucket)}
              />
              <MultiplierChip
                bucket={11200}
                stats={mockStatsByPinnedBuckets['11200']}
                isActive={true}
                onFocus={(bucket) => console.log('Focus:', bucket)}
                onRemove={(bucket) => console.log('Remove:', bucket)}
              />
              <MultiplierChip
                bucket={48800}
                stats={null}
                isActive={false}
                onFocus={(bucket) => console.log('Focus:', bucket)}
                onRemove={(bucket) => console.log('Remove:', bucket)}
              />
              <MultiplierChip
                bucket={100000}
                stats={mockStatsByPinnedBuckets['48800']}
                disabled={true}
                onFocus={(bucket) => console.log('Focus:', bucket)}
                onRemove={(bucket) => console.log('Remove:', bucket)}
              />
            </div>
          </div>

          <div className="text-sm text-muted-foreground space-y-1">
            <p><strong>Current State:</strong></p>
            <p>Pinned Buckets: {JSON.stringify(pinnedBuckets)}</p>
            <p>Focused Bucket: {focusedBucket}</p>
            <p><strong>Features:</strong></p>
            <ul className="list-disc list-inside space-y-1">
              <li>Click chips to focus/unfocus</li>
              <li>Right-click or use kebab menu to remove</li>
              <li>Add new multipliers with the "Add" button</li>
              <li>Session storage persistence</li>
              <li>Pre-computed statistics display</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PinnedChipsDemo;