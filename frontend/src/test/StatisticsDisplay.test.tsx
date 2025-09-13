/**
 * Tests for StatisticsDisplay component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { StatisticsDisplay } from '../components/StatisticsDisplay';
import { BucketStats } from '@/lib/analysisMath';

const mockStats: BucketStats = {
  count: 43,
  median: 1250,
  mean: 1180,
  min: 45,
  max: 8900,
  method: 'exact'
};

describe('StatisticsDisplay', () => {
  it('renders null stats as "No hits"', () => {
    render(<StatisticsDisplay stats={null} />);
    expect(screen.getByText('No hits')).toBeInTheDocument();
  });

  it('renders zero count stats as "No hits"', () => {
    const zeroStats: BucketStats = {
      count: 0,
      median: null,
      mean: null,
      min: null,
      max: null,
      method: 'exact'
    };
    
    render(<StatisticsDisplay stats={zeroStats} />);
    expect(screen.getByText('No hits')).toBeInTheDocument();
  });

  it('renders compact statistics', () => {
    render(<StatisticsDisplay stats={mockStats} compact />);
    
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Median: 1.3k')).toBeInTheDocument();
    expect(screen.getByText('Mean: 1.2k')).toBeInTheDocument();
  });

  it('renders full statistics', () => {
    render(<StatisticsDisplay stats={mockStats} />);
    
    expect(screen.getByText('Count:')).toBeInTheDocument();
    expect(screen.getByText('43')).toBeInTheDocument();
    expect(screen.getByText('Median:')).toBeInTheDocument();
    expect(screen.getByText('1,250')).toBeInTheDocument();
    expect(screen.getByText('Mean:')).toBeInTheDocument();
    expect(screen.getByText('1,180')).toBeInTheDocument();
    expect(screen.getByText('Min:')).toBeInTheDocument();
    expect(screen.getByText('45')).toBeInTheDocument();
    expect(screen.getByText('Max:')).toBeInTheDocument();
    expect(screen.getByText('8,900')).toBeInTheDocument();
  });

  it('shows method indicator when requested', () => {
    render(<StatisticsDisplay stats={mockStats} showMethod />);
    expect(screen.getByText('exact')).toBeInTheDocument();
  });

  it('shows approximate method indicator', () => {
    const approximateStats: BucketStats = {
      ...mockStats,
      method: 'approximate'
    };
    
    render(<StatisticsDisplay stats={approximateStats} compact showMethod />);
    expect(screen.getByText('~')).toBeInTheDocument();
  });

  it('handles null values gracefully', () => {
    const nullStats: BucketStats = {
      count: 5,
      median: null,
      mean: null,
      min: null,
      max: null,
      method: 'exact'
    };
    
    render(<StatisticsDisplay stats={nullStats} />);
    
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getAllByText('N/A')).toHaveLength(4); // median, mean, min, max
  });
});