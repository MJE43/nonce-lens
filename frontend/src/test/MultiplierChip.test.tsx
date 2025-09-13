/**
 * MultiplierChip Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MultiplierChip } from '../components/MultiplierChip';
import { BucketStats } from '@/lib/analysisMath';

// Mock stats data
const mockStats: BucketStats = {
  count: 42,
  median: 1250,
  mean: 1300,
  min: 800,
  max: 2100,
  method: 'exact'
};

describe('MultiplierChip', () => {
  it('renders bucket value correctly', () => {
    render(
      <MultiplierChip
        bucket={11200}
        stats={mockStats}
      />
    );
    
    expect(screen.getByText('11.2kx')).toBeInTheDocument();
  });

  it('renders statistics when provided', () => {
    render(
      <MultiplierChip
        bucket={11200}
        stats={mockStats}
      />
    );
    
    expect(screen.getByText('42 • 1250')).toBeInTheDocument();
  });

  it('shows active state when isActive is true', () => {
    render(
      <MultiplierChip
        bucket={11200}
        stats={mockStats}
        isActive={true}
      />
    );
    
    const chipButton = screen.getByText('11.2kx').closest('button');
    expect(chipButton).toHaveClass('ring-2');
  });

  it('calls onFocus when clicked', () => {
    const onFocus = vi.fn();
    render(
      <MultiplierChip
        bucket={11200}
        stats={mockStats}
        onFocus={onFocus}
      />
    );
    
    const chipButton = screen.getByText('11.2kx').closest('button');
    fireEvent.click(chipButton!);
    expect(onFocus).toHaveBeenCalledWith(11200);
  });

  it('renders kebab menu button for options', () => {
    const onRemove = vi.fn();
    render(
      <MultiplierChip
        bucket={11200}
        stats={mockStats}
        onRemove={onRemove}
      />
    );
    
    // Should render the kebab menu button
    const kebabButton = screen.getByTitle('Options for 11.2kx');
    expect(kebabButton).toBeInTheDocument();
    expect(kebabButton).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('handles disabled state correctly', () => {
    const onFocus = vi.fn();
    render(
      <MultiplierChip
        bucket={11200}
        stats={mockStats}
        disabled={true}
        onFocus={onFocus}
      />
    );
    
    const chipButton = screen.getByText('11.2kx').closest('button');
    expect(chipButton).toBeDisabled();
    
    fireEvent.click(chipButton!);
    expect(onFocus).not.toHaveBeenCalled();
  });

  it('formats small multipliers without k suffix', () => {
    render(
      <MultiplierChip
        bucket={250}
        stats={mockStats}
      />
    );
    
    expect(screen.getByText('250x')).toBeInTheDocument();
  });

  it('shows zero hits message when no stats', () => {
    render(
      <MultiplierChip
        bucket={11200}
        stats={null}
      />
    );
    
    // Should only show the bucket value, no stats
    expect(screen.getByText('11.2kx')).toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });

  it('shows zero hits when count is 0', () => {
    const emptyStats: BucketStats = {
      count: 0,
      median: null,
      mean: null,
      min: null,
      max: null,
      method: 'exact'
    };

    render(
      <MultiplierChip
        bucket={11200}
        stats={emptyStats}
      />
    );
    
    // Should only show the bucket value, no stats separator
    expect(screen.getByText('11.2kx')).toBeInTheDocument();
    expect(screen.queryByText(/•/)).not.toBeInTheDocument();
  });
});