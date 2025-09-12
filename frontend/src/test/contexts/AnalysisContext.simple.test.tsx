/**
 * Simple test for AnalysisContext basic functionality
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalysisProvider, useAnalysis } from '@/contexts/AnalysisContext';

// Simple test component
const SimpleTestComponent = () => {
  const analysis = useAnalysis();
  
  return (
    <div>
      <div data-testid="mode">{analysis.mode}</div>
      <div data-testid="stream-id">{analysis.streamId}</div>
      <div data-testid="scope-label">{analysis.scopeLabel}</div>
    </div>
  );
};

describe('AnalysisContext - Basic Functionality', () => {
  it('provides initial state correctly', () => {
    render(
      <AnalysisProvider streamId="test-stream-123">
        <SimpleTestComponent />
      </AnalysisProvider>
    );

    expect(screen.getByTestId('mode')).toHaveTextContent('live');
    expect(screen.getByTestId('stream-id')).toHaveTextContent('test-stream-123');
    expect(screen.getByTestId('scope-label')).toHaveTextContent('Live Mode');
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = () => {};

    expect(() => {
      render(<SimpleTestComponent />);
    }).toThrow('useAnalysis must be used within an AnalysisProvider');

    console.error = originalError;
  });
});