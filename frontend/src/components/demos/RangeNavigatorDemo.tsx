/**
 * RangeNavigator Demo Component
 * 
 * Demonstrates usage of the RangeNavigator component
 */

import React, { useState } from 'react';
import { RangeNavigator } from '../RangeNavigator';
import { RangeSelector } from '../RangeSelector';

export const RangeNavigatorDemo: React.FC = () => {
  const [currentRange, setCurrentRange] = useState<[number, number]>([0, 10000]);
  const [rangeSize, setRangeSize] = useState(10000);
  const maxNonce = 100000;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Range Navigator Demo</h2>
        <p className="text-muted-foreground mb-6">
          Navigate through nonce ranges for hit-centric analysis
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Full Range Navigator</h3>
          <div className="border rounded-lg p-4">
            <RangeNavigator
              currentRange={currentRange}
              maxNonce={maxNonce}
              onRangeChange={setCurrentRange}
              rangeSize={rangeSize}
              rangeSizeOptions={[5000, 10000, 20000]}
              onRangeSizeChange={setRangeSize}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Simple Range Selector</h3>
          <div className="border rounded-lg p-4">
            <RangeSelector
              currentRange={currentRange}
              maxNonce={maxNonce}
              rangeSize={rangeSize}
              onRangeChange={setCurrentRange}
            />
          </div>
        </div>

        <div>
          <h3 className="text-lg font-semibold mb-2">Current State</h3>
          <div className="border rounded-lg p-4 bg-muted">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium">Current Range:</span> {currentRange[0].toLocaleString()} - {currentRange[1].toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Range Size:</span> {rangeSize.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Max Nonce:</span> {maxNonce.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Total Ranges:</span> {Math.ceil(maxNonce / rangeSize)}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-2">Features</h3>
        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
          <li>Navigate with prev/next buttons or jump to specific nonce</li>
          <li>Keyboard shortcuts: Arrow keys, Page Up/Down, Home/End</li>
          <li>Visual progress indicator showing current position</li>
          <li>Configurable range sizes (5k, 10k, 20k nonces)</li>
          <li>Quick range selector dropdown for large datasets</li>
          <li>Automatic range clamping for invalid inputs</li>
        </ul>
      </div>
    </div>
  );
};

export default RangeNavigatorDemo;