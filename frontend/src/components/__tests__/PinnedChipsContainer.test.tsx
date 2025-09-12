/**
 * PinnedChipsContainer Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PinnedChipsContainer } from '../PinnedChipsContainer';
import { BucketStats } from '@/lib/analysisMath';

// Mock sessionStorage
const mockSessionStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: mockSessionStorage,
});

// Mock stats data
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
  }
};

describe('PinnedChipsContainer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders pinned chips correctly', () => {
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200, 48800]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={null}
      />
    );
    
    expect(screen.getByText('Pinned:')).toBeInTheDocument();
    expect(screen.getByText('11.2kx')).toBeInTheDocument();
    expect(screen.getByText('48.8kx')).toBeInTheDocument();
  });

  it('shows active state for focused bucket', () => {
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200, 48800]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={11200}
      />
    );
    
    // The focused chip should have active styling
    const buttons = screen.getAllByRole('button');
    const focusedButton = buttons.find(button => 
      button.textContent?.includes('11.2kx')
    );
    expect(focusedButton).toHaveClass('ring-2');
  });

  it('calls onFocusChange when chip is clicked', () => {
    const onFocusChange = vi.fn();
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={null}
        onFocusChange={onFocusChange}
      />
    );
    
    const chipButton = screen.getByText('11.2kx').closest('button');
    fireEvent.click(chipButton!);
    
    expect(onFocusChange).toHaveBeenCalledWith(11200);
  });

  it('unfocuses when clicking the same focused bucket', () => {
    const onFocusChange = vi.fn();
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={11200}
        onFocusChange={onFocusChange}
      />
    );
    
    const chipButton = screen.getByText('11.2kx').closest('button');
    fireEvent.click(chipButton!);
    
    expect(onFocusChange).toHaveBeenCalledWith(null);
  });

  it('renders kebab menu buttons for chip options', () => {
    const onPinnedBucketsChange = vi.fn();
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200, 48800]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={null}
        onPinnedBucketsChange={onPinnedBucketsChange}
      />
    );
    
    // Should render kebab menu buttons for each chip
    const kebabButtons = screen.getAllByTitle(/Options for/);
    expect(kebabButtons).toHaveLength(2);
    expect(kebabButtons[0]).toHaveAttribute('aria-haspopup', 'menu');
    expect(kebabButtons[1]).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('shows add button and allows adding new buckets', async () => {
    const onPinnedBucketsChange = vi.fn();
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={null}
        onPinnedBucketsChange={onPinnedBucketsChange}
      />
    );
    
    // Click add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);
    
    // Enter new multiplier
    const input = screen.getByPlaceholderText('e.g. 11200');
    fireEvent.change(input, { target: { value: '48800' } });
    
    // Submit form
    const pinButton = screen.getByText('Pin');
    fireEvent.click(pinButton);
    
    await waitFor(() => {
      expect(onPinnedBucketsChange).toHaveBeenCalledWith([11200, 48800]);
    });
  });

  it('shows empty state when no pinned buckets', () => {
    render(
      <PinnedChipsContainer
        pinnedBuckets={[]}
        statsByPinnedBuckets={{}}
        focusedBucket={null}
      />
    );
    
    expect(screen.getByText('No pinned multipliers')).toBeInTheDocument();
  });

  it('does not render when disabled and no pinned buckets', () => {
    const { container } = render(
      <PinnedChipsContainer
        pinnedBuckets={[]}
        statsByPinnedBuckets={{}}
        focusedBucket={null}
        disabled={true}
      />
    );
    
    expect(container.firstChild).toBeNull();
  });

  it('saves pinned buckets to session storage', () => {
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200, 48800]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={null}
      />
    );
    
    expect(mockSessionStorage.setItem).toHaveBeenCalledWith(
      'analysis-pinned-buckets',
      JSON.stringify([11200, 48800])
    );
  });

  it('loads pinned buckets from session storage on mount', () => {
    mockSessionStorage.getItem.mockReturnValue(JSON.stringify([11200]));
    const onPinnedBucketsChange = vi.fn();
    
    render(
      <PinnedChipsContainer
        pinnedBuckets={[]}
        statsByPinnedBuckets={{}}
        focusedBucket={null}
        onPinnedBucketsChange={onPinnedBucketsChange}
      />
    );
    
    expect(mockSessionStorage.getItem).toHaveBeenCalledWith('analysis-pinned-buckets');
    expect(onPinnedBucketsChange).toHaveBeenCalledWith([11200]);
  });

  it('prevents adding duplicate buckets', async () => {
    const onPinnedBucketsChange = vi.fn();
    render(
      <PinnedChipsContainer
        pinnedBuckets={[11200]}
        statsByPinnedBuckets={mockStatsByPinnedBuckets}
        focusedBucket={null}
        onPinnedBucketsChange={onPinnedBucketsChange}
      />
    );
    
    // Click add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);
    
    // Try to add existing multiplier
    const input = screen.getByPlaceholderText('e.g. 11200');
    fireEvent.change(input, { target: { value: '11200' } });
    
    // Submit form
    const pinButton = screen.getByText('Pin');
    fireEvent.click(pinButton);
    
    // Should not call onPinnedBucketsChange since it's a duplicate
    expect(onPinnedBucketsChange).not.toHaveBeenCalled();
  });

  it('normalizes bucket values using bucketMultiplier', async () => {
    const onPinnedBucketsChange = vi.fn();
    render(
      <PinnedChipsContainer
        pinnedBuckets={[]}
        statsByPinnedBuckets={{}}
        focusedBucket={null}
        onPinnedBucketsChange={onPinnedBucketsChange}
      />
    );
    
    // Click add button
    const addButton = screen.getByText('Add');
    fireEvent.click(addButton);
    
    // Enter multiplier with extra precision
    const input = screen.getByPlaceholderText('e.g. 11200');
    fireEvent.change(input, { target: { value: '11200.0001' } });
    
    // Submit form
    const pinButton = screen.getByText('Pin');
    fireEvent.click(pinButton);
    
    await waitFor(() => {
      // Should be normalized to 11200
      expect(onPinnedBucketsChange).toHaveBeenCalledWith([11200]);
    });
  });
});