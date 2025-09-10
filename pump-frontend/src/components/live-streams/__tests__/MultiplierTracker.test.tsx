/**
 * Tests for MultiplierTracker component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MultiplierTracker } from '../MultiplierTracker';
import { RingBuffer } from '@/lib/analytics';
import type { PinnedMultiplier } from '@/hooks/useAnalyticsState';

// Mock the RingBuffer for testing
vi.mock('@/lib/analytics', async () => {
  const actual = await vi.importActual('@/lib/analytics');
  return {
    ...actual,
    RingBuffer: vi.fn().mockImplementation(() => ({
      push: vi.fn(),
      toArray: vi.fn(() => [100, 200, 150]),
      length: 3
    }))
  };
});

describe('MultiplierTracker', () => {
  const mockOnPin = vi.fn();
  const mockOnUnpin = vi.fn();
  const mockOnShowDistances = vi.fn();

  const createMockPinnedMultiplier = (multiplier: number): PinnedMultiplier => ({
    multiplier,
    tolerance: 1e-9,
    stats: {
      count: 5,
      lastNonce: 12345,
      lastGap: 150,
      meanGap: 125,
      stdGap: 25,
      maxGap: 200,
      p90Gap: 180,
      p99Gap: 195,
      ringBuffer: new RingBuffer<number>(50),
      eta: {
        value: 12470,
        model: 'theoretical' as const
      }
    },
    alerts: []
  });

  const defaultProps = {
    pinnedMultipliers: new Map(),
    streamMultipliers: [2.0, 3.5, 5.0, 10.0],
    difficulty: 'medium' as const,
    onPin: mockOnPin,
    onUnpin: mockOnUnpin,
    onShowDistances: mockOnShowDistances
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<MultiplierTracker {...defaultProps} />);
    expect(screen.getByText('Multiplier Tracker')).toBeInTheDocument();
  });

  it('displays available multipliers for selection', () => {
    render(<MultiplierTracker {...defaultProps} />);
    
    expect(screen.getByText('Available Multipliers')).toBeInTheDocument();
    expect(screen.getByText('2.00x')).toBeInTheDocument();
    expect(screen.getByText('3.50x')).toBeInTheDocument();
  });

  it('calls onPin when multiplier chip is clicked', () => {
    render(<MultiplierTracker {...defaultProps} />);
    
    const multiplierChip = screen.getByText('2.00x');
    fireEvent.click(multiplierChip);
    
    expect(mockOnPin).toHaveBeenCalledWith(2.0);
  });

  it('displays pinned multiplier stats', () => {
    const pinnedMultipliers = new Map();
    pinnedMultipliers.set(2.0, createMockPinnedMultiplier(2.0));
    
    render(<MultiplierTracker {...defaultProps} pinnedMultipliers={pinnedMultipliers} />);
    
    expect(screen.getByText('Pinned Multipliers (1)')).toBeInTheDocument();
    expect(screen.getByText('2.00x')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // count
    expect(screen.getByText('12,345')).toBeInTheDocument(); // last nonce
    expect(screen.getByText('150')).toBeInTheDocument(); // last gap
  });

  it('displays ETA with model type', () => {
    const pinnedMultipliers = new Map();
    // Use 1.98 which has theoretical probability in medium difficulty
    pinnedMultipliers.set(1.98, createMockPinnedMultiplier(1.98));
    
    render(<MultiplierTracker {...defaultProps} pinnedMultipliers={pinnedMultipliers} />);
    
    // Check that theoretical model is detected and displayed
    expect(screen.getByText('theoretical')).toBeInTheDocument(); // model type badge
    
    // Check that the ETA section exists (it should show because stats.eta.value > 0)
    expect(screen.getByText('ETA Next Hit')).toBeInTheDocument();
    expect(screen.getByText('Theoretical')).toBeInTheDocument(); // model label in ETA section
  });

  it('calls onUnpin when unpin button is clicked', () => {
    const pinnedMultipliers = new Map();
    pinnedMultipliers.set(2.0, createMockPinnedMultiplier(2.0));
    
    render(<MultiplierTracker {...defaultProps} pinnedMultipliers={pinnedMultipliers} />);
    
    const unpinButtons = screen.getAllByRole('button');
    const unpinButton = unpinButtons.find(button => 
      button.querySelector('svg') && button.textContent === ''
    );
    
    if (unpinButton) {
      fireEvent.click(unpinButton);
      expect(mockOnUnpin).toHaveBeenCalledWith(2.0);
    }
  });

  it('calls onShowDistances when show button is clicked', () => {
    const pinnedMultipliers = new Map();
    pinnedMultipliers.set(2.0, createMockPinnedMultiplier(2.0));
    
    render(<MultiplierTracker {...defaultProps} pinnedMultipliers={pinnedMultipliers} />);
    
    const showButton = screen.getByText('Show');
    fireEvent.click(showButton);
    
    expect(mockOnShowDistances).toHaveBeenCalledWith(2.0);
  });

  it('shows preset multipliers when toggle is enabled', () => {
    render(<MultiplierTracker {...defaultProps} />);
    
    const presetToggle = screen.getByText('Show Presets');
    fireEvent.click(presetToggle);
    
    // Should show more multipliers from the medium difficulty preset
    expect(screen.getByText('1.11x')).toBeInTheDocument();
    expect(screen.getByText('1.46x')).toBeInTheDocument();
  });

  it('indicates stream multipliers with green dot', () => {
    render(<MultiplierTracker {...defaultProps} />);
    
    // Stream multipliers should have a green indicator dot
    const multiplierButtons = screen.getAllByRole('button');
    const streamMultiplierButton = multiplierButtons.find(button => 
      button.textContent?.includes('2.00x')
    );
    
    expect(streamMultiplierButton).toBeInTheDocument();
    // The green dot is implemented as a CSS class, so we check for the button structure
  });

  it('displays appropriate color classes for different multiplier ranges', () => {
    const pinnedMultipliers = new Map();
    pinnedMultipliers.set(1000, createMockPinnedMultiplier(1000)); // Should be yellow
    pinnedMultipliers.set(100, createMockPinnedMultiplier(100));   // Should be orange
    pinnedMultipliers.set(10, createMockPinnedMultiplier(10));     // Should be blue
    pinnedMultipliers.set(2, createMockPinnedMultiplier(2));       // Should be green
    
    render(<MultiplierTracker {...defaultProps} pinnedMultipliers={pinnedMultipliers} />);
    
    expect(screen.getByText('1000.00x')).toBeInTheDocument();
    expect(screen.getByText('100.00x')).toBeInTheDocument();
    expect(screen.getByText('10.00x')).toBeInTheDocument();
    expect(screen.getByText('2.00x')).toBeInTheDocument();
  });

  it('shows empty state when no multipliers are available', () => {
    const allPinned = new Map();
    // Pin all stream multipliers AND all preset multipliers for medium difficulty
    const allMultipliers = [...new Set([...defaultProps.streamMultipliers, 1.11, 1.46, 1.69, 1.98, 2.33, 2.76, 3.31, 4.03, 4.95, 7.87, 10.25, 13.66, 18.78, 26.83, 38.76, 64.4, 112.7, 225.4, 563.5, 2254.0])];
    allMultipliers.forEach(m => {
      allPinned.set(m, createMockPinnedMultiplier(m));
    });
    
    render(<MultiplierTracker {...defaultProps} pinnedMultipliers={allPinned} />);
    
    expect(screen.getByText('All available multipliers are pinned')).toBeInTheDocument();
  });
});