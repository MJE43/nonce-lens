/**
 * RangeNavigator Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RangeNavigator } from '../components/RangeNavigator';

describe('RangeNavigator', () => {
  const defaultProps = {
    currentRange: [10000, 20000] as [number, number],
    maxNonce: 100000,
    onRangeChange: vi.fn(),
    rangeSize: 10000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders current range display correctly', () => {
    render(<RangeNavigator {...defaultProps} />);
    
    expect(screen.getByText('Range: 10k–20k')).toBeInTheDocument();
    expect(screen.getByText('(2/10)')).toBeInTheDocument();
  });

  it('handles previous range navigation', async () => {
    const user = userEvent.setup();
    render(<RangeNavigator {...defaultProps} />);
    
    const prevButton = screen.getByTitle('Previous range (← or Page Up)');
    await user.click(prevButton);
    
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([0, 10000]);
  });

  it('handles next range navigation', async () => {
    const user = userEvent.setup();
    render(<RangeNavigator {...defaultProps} />);
    
    const nextButton = screen.getByTitle('Next range (→ or Page Down)');
    await user.click(nextButton);
    
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([20000, 30000]);
  });

  it('handles first range navigation', async () => {
    const user = userEvent.setup();
    render(<RangeNavigator {...defaultProps} />);
    
    const firstButton = screen.getByTitle('Go to first range (Home)');
    await user.click(firstButton);
    
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([0, 10000]);
  });

  it('handles last range navigation', async () => {
    const user = userEvent.setup();
    render(<RangeNavigator {...defaultProps} />);
    
    const lastButton = screen.getByTitle('Go to last range (End)');
    await user.click(lastButton);
    
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([90000, 100000]);
  });

  it('disables previous buttons when at first range', () => {
    render(<RangeNavigator {...defaultProps} currentRange={[0, 10000]} />);
    
    const firstButton = screen.getByTitle('Go to first range (Home)');
    const prevButton = screen.getByTitle('Previous range (← or Page Up)');
    
    expect(firstButton).toBeDisabled();
    expect(prevButton).toBeDisabled();
  });

  it('disables next buttons when at last range', () => {
    render(<RangeNavigator {...defaultProps} currentRange={[90000, 100000]} />);
    
    const lastButton = screen.getByTitle('Go to last range (End)');
    const nextButton = screen.getByTitle('Next range (→ or Page Down)');
    
    expect(lastButton).toBeDisabled();
    expect(nextButton).toBeDisabled();
  });

  it('handles jump to nonce input', async () => {
    const user = userEvent.setup();
    render(<RangeNavigator {...defaultProps} />);
    
    const jumpInput = screen.getByPlaceholderText('Nonce');
    const jumpButton = screen.getByTitle('Jump to nonce');
    
    await user.type(jumpInput, '45000');
    await user.click(jumpButton);
    
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([40000, 50000]);
  });

  it('handles jump to nonce form submission', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(<RangeNavigator {...defaultProps} onRangeChange={onRangeChange} />);
    
    const jumpInput = screen.getByPlaceholderText('Nonce');
    
    // Test form submission by pressing Enter
    await user.type(jumpInput, '25000');
    
    // Find the form and submit it directly
    const form = jumpInput.closest('form');
    expect(form).toBeInTheDocument();
    
    if (form) {
      fireEvent.submit(form);
      expect(onRangeChange).toHaveBeenCalledWith([20000, 30000]);
    }
  });

  it('clamps jump to nonce within valid range', async () => {
    const user = userEvent.setup();
    const onRangeChange = vi.fn();
    render(<RangeNavigator {...defaultProps} onRangeChange={onRangeChange} />);
    
    const jumpInput = screen.getByPlaceholderText('Nonce');
    const jumpButton = screen.getByTitle('Jump to nonce');
    
    // Test upper bound - nonce 150000 should clamp to 99999 and go to range [90000, 100000]
    await user.type(jumpInput, '150000');
    await user.click(jumpButton);
    expect(onRangeChange).toHaveBeenCalledWith([90000, 100000]);
    
    // Clear input
    await user.clear(jumpInput);
    
    // Test lower bound - negative nonce should clamp to 0 and go to range [0, 10000]
    await user.type(jumpInput, '-5000');
    await user.click(jumpButton);
    expect(onRangeChange).toHaveBeenCalledWith([0, 10000]);
  });

  it('renders range size selector when onRangeSizeChange is provided', () => {
    const onRangeSizeChange = vi.fn();
    
    render(
      <RangeNavigator 
        {...defaultProps} 
        onRangeSizeChange={onRangeSizeChange}
        rangeSizeOptions={[5000, 10000, 20000]}
      />
    );
    
    // Should render both the range size selector and quick range selector
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes).toHaveLength(2); // Range size selector + Quick range selector
    
    // Check that one of them shows the range size
    const rangeSizeSelector = comboboxes.find(cb => cb.textContent?.includes('10k') && !cb.textContent?.includes('–'));
    expect(rangeSizeSelector).toBeInTheDocument();
  });

  it('shows progress indicator correctly', () => {
    render(<RangeNavigator {...defaultProps} currentRange={[30000, 40000]} />);
    
    // Range 4 out of 10 should be at ~33% progress
    const progressBar = document.querySelector('.bg-primary');
    expect(progressBar).toHaveStyle({ width: '33.33333333333333%' });
  });

  it('handles keyboard shortcuts', async () => {
    render(<RangeNavigator {...defaultProps} />);
    
    // Test arrow left (previous)
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([0, 10000]);
    
    // Test arrow right (next)
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([20000, 30000]);
    
    // Test Home (first)
    fireEvent.keyDown(window, { key: 'Home' });
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([0, 10000]);
    
    // Test End (last)
    fireEvent.keyDown(window, { key: 'End' });
    expect(defaultProps.onRangeChange).toHaveBeenCalledWith([90000, 100000]);
  });

  it('ignores keyboard shortcuts when jump input is focused', async () => {
    const user = userEvent.setup();
    render(<RangeNavigator {...defaultProps} />);
    
    const jumpInput = screen.getByPlaceholderText('Nonce');
    await user.click(jumpInput);
    
    // Keyboard shortcuts should be ignored when input is focused
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(defaultProps.onRangeChange).not.toHaveBeenCalled();
  });

  it('handles disabled state correctly', () => {
    render(<RangeNavigator {...defaultProps} disabled={true} />);
    
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
    
    const jumpInput = screen.getByPlaceholderText('Nonce');
    expect(jumpInput).toBeDisabled();
  });

  it('formats ranges correctly for different sizes', () => {
    // Test small numbers (no k suffix)
    render(<RangeNavigator {...defaultProps} currentRange={[0, 500]} maxNonce={1000} />);
    expect(screen.getByText('Range: 0–500')).toBeInTheDocument();
    
    // Test large numbers (with k suffix)
    render(<RangeNavigator {...defaultProps} currentRange={[50000, 60000]} />);
    expect(screen.getByText('Range: 50k–60k')).toBeInTheDocument();
  });

  it('generates appropriate quick range options for large datasets', () => {
    const user = userEvent.setup();
    
    // Test with very large dataset (should step through ranges)
    render(
      <RangeNavigator 
        {...defaultProps} 
        maxNonce={1000000} // 100 ranges, should step
      />
    );
    
    // The quick selector should be present
    expect(screen.getByText('Quick:')).toBeInTheDocument();
  });
});