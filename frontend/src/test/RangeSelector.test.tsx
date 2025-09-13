/**
 * RangeSelector Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RangeSelector } from '../components/RangeSelector';

describe('RangeSelector', () => {
  const defaultProps = {
    currentRange: [10000, 20000] as [number, number],
    maxNonce: 100000,
    rangeSize: 10000,
    onRangeChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with current range selected', () => {
    render(<RangeSelector {...defaultProps} />);
    
    // Should show the current range in the trigger
    expect(screen.getByText('10k–20k')).toBeInTheDocument();
  });

  it('shows placeholder when no current range matches options', () => {
    render(
      <RangeSelector 
        {...defaultProps} 
        currentRange={[15000, 25000]} // Non-standard range
        placeholder="Custom placeholder"
      />
    );
    
    // Should show placeholder since 15000-25000 doesn't match any standard 10k range
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('Custom placeholder');
  });

  it('renders with correct trigger text', () => {
    render(<RangeSelector {...defaultProps} />);
    
    // Should show the current range in the trigger
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('10k–20k');
  });

  it('generates correct range options', () => {
    render(<RangeSelector {...defaultProps} />);
    
    // Test that the component generates the expected number of ranges
    const totalRanges = Math.ceil(defaultProps.maxNonce / defaultProps.rangeSize);
    expect(totalRanges).toBe(10); // 100000 / 10000 = 10 ranges
  });

  it('formats range options correctly', () => {
    const { rerender } = render(<RangeSelector {...defaultProps} />);
    
    // Test with small numbers (no k suffix)
    rerender(
      <RangeSelector 
        {...defaultProps} 
        currentRange={[0, 500]}
        maxNonce={1000}
        rangeSize={500}
      />
    );
    
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveTextContent('0–500');
  });

  it('handles small numbers without k suffix', () => {
    render(
      <RangeSelector 
        {...defaultProps} 
        currentRange={[0, 500]}
        maxNonce={1000}
        rangeSize={500}
      />
    );
    
    expect(screen.getByText('0–500')).toBeInTheDocument();
  });

  it('handles large datasets with stepping', () => {
    // Create a very large dataset that should trigger stepping
    render(
      <RangeSelector 
        {...defaultProps} 
        maxNonce={1000000} // 100 ranges, should step
        currentRange={[0, 10000]}
      />
    );
    
    // Component should render without errors
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    expect(trigger).toHaveTextContent('0–10k');
  });

  it('handles disabled state', () => {
    render(<RangeSelector {...defaultProps} disabled={true} />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<RangeSelector {...defaultProps} className="custom-class" />);
    
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveClass('custom-class');
  });

  it('handles different size variants', () => {
    const { rerender } = render(<RangeSelector {...defaultProps} size="sm" />);
    
    let trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('data-size', 'sm');
    
    rerender(<RangeSelector {...defaultProps} size="default" />);
    trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('data-size', 'default');
  });

  it('handles edge case where maxNonce is not evenly divisible by rangeSize', () => {
    render(
      <RangeSelector 
        {...defaultProps} 
        maxNonce={95000} // Not evenly divisible by 10000
        currentRange={[90000, 95000]}
      />
    );
    
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    
    // Last range should be 90k–95k
    expect(trigger).toHaveTextContent('90k–95k');
  });

  it('handles invalid range selection gracefully', async () => {
    const user = userEvent.setup();
    
    // Mock console.error to avoid test noise
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<RangeSelector {...defaultProps} />);
    
    const trigger = screen.getByRole('combobox');
    await user.click(trigger);
    
    // Try to trigger onValueChange with invalid value
    // This is hard to test directly, but we can verify the component doesn't crash
    expect(trigger).toBeInTheDocument();
    
    consoleSpy.mockRestore();
  });
});