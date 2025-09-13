/**
 * Tests for AnalysisBar component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AnalysisBar } from '../components/AnalysisBar';
import { BucketStats } from '@/lib/analysisMath';

const mockStats: BucketStats = {
  count: 43,
  median: 1250,
  mean: 1180,
  min: 45,
  max: 8900,
  method: 'exact'
};

const defaultProps = {
  mode: 'live' as const,
  onModeChange: vi.fn(),
  focusedBucket: null,
  currentRange: [0, 10000] as [number, number],
  onRangeChange: vi.fn(),
  maxNonce: 70000,
  minMultiplier: 1,
  onMinMultiplierChange: vi.fn(),
  stats: null,
  pinnedBuckets: [],
  statsByPinnedBuckets: {},
  onPinnedBucketsChange: vi.fn(),
  scopeLabel: 'Live Mode',
};

describe('AnalysisBar', () => {
  it('renders in live mode', () => {
    render(<AnalysisBar {...defaultProps} />);
    
    expect(screen.getByText('Live')).toBeInTheDocument();
    expect(screen.getByText('Analysis')).toBeInTheDocument();
    expect(screen.getByRole('switch')).not.toBeChecked();
  });

  it('renders in analysis mode with controls', () => {
    render(
      <AnalysisBar 
        {...defaultProps} 
        mode="analysis"
        focusedBucket={11200}
        stats={mockStats}
        scopeLabel="43 hits • nonce 60k–70k • bucket 11.2kx"
      />
    );
    
    expect(screen.getByRole('switch')).toBeChecked();
    expect(screen.getByText('Min:')).toBeInTheDocument();
    expect(screen.getByText('Focus:')).toBeInTheDocument();
    expect(screen.getByText('11.2kx')).toBeInTheDocument();
    expect(screen.getByText('43 hits • nonce 60k–70k • bucket 11.2kx')).toBeInTheDocument();
  });

  it('handles mode toggle', () => {
    const onModeChange = vi.fn();
    render(<AnalysisBar {...defaultProps} onModeChange={onModeChange} />);
    
    const toggle = screen.getByRole('switch');
    fireEvent.click(toggle);
    
    expect(onModeChange).toHaveBeenCalledWith('analysis');
  });

  it('handles min multiplier change', () => {
    const onMinMultiplierChange = vi.fn();
    render(
      <AnalysisBar 
        {...defaultProps} 
        mode="analysis"
        onMinMultiplierChange={onMinMultiplierChange}
      />
    );
    
    const input = screen.getByLabelText('Min:');
    fireEvent.change(input, { target: { value: '5' } });
    fireEvent.blur(input);
    
    expect(onMinMultiplierChange).toHaveBeenCalledWith(5);
  });

  it('displays statistics when focused bucket is set', () => {
    render(
      <AnalysisBar 
        {...defaultProps} 
        mode="analysis"
        focusedBucket={11200}
        stats={mockStats}
      />
    );
    
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Median: 1.3k')).toBeInTheDocument();
    expect(screen.getByText('Mean: 1.2k')).toBeInTheDocument();
  });

  it('displays pinned buckets', () => {
    const statsByPinnedBuckets = {
      '11200': mockStats,
      '48800': { ...mockStats, count: 12, median: 2500 }
    };

    render(
      <AnalysisBar 
        {...defaultProps} 
        mode="analysis"
        pinnedBuckets={[11200, 48800]}
        statsByPinnedBuckets={statsByPinnedBuckets}
      />
    );
    
    expect(screen.getByText('Pinned:')).toBeInTheDocument();
    expect(screen.getByText('11.2kx')).toBeInTheDocument();
    expect(screen.getByText('48.8kx')).toBeInTheDocument();
  });

  it('handles range navigation', () => {
    const onRangeChange = vi.fn();
    render(
      <AnalysisBar 
        {...defaultProps} 
        mode="analysis"
        currentRange={[10000, 20000]}
        onRangeChange={onRangeChange}
      />
    );
    
    const prevButton = screen.getByTitle('Previous range (J)');
    fireEvent.click(prevButton);
    
    expect(onRangeChange).toHaveBeenCalledWith([0, 10000]);
  });

  it('handles exit analysis', () => {
    const onModeChange = vi.fn();
    render(
      <AnalysisBar 
        {...defaultProps} 
        mode="analysis"
        onModeChange={onModeChange}
      />
    );
    
    const exitButton = screen.getByTitle('Exit analysis mode (Escape)');
    fireEvent.click(exitButton);
    
    expect(onModeChange).toHaveBeenCalledWith('live');
  });
});