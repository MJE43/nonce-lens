import React, { useState } from 'react';
import { 
  validateRunDetail, 
  validateHit,
  formatValidationErrors,
  formatValidationWarnings,
  safeGetRunDetail,
  mergeWithDefaults
} from '../../lib/validation';
import { validateApiResponse } from '../../lib/api';

// Example component to demonstrate validation utilities
export const ValidationExample: React.FC = () => {
  const [validationResult, setValidationResult] = useState<string>('');

  // Example valid RunDetail data
  const validRunDetail = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    server_seed: 'abcdef1234567890abcdef1234567890',
    client_seed: 'client123456789',
    nonce_start: 0,
    nonce_end: 1000,
    difficulty: 'medium',
    targets: [2, 5, 10],
    duration_ms: 5000,
    engine_version: '1.0.0',
    summary: {
      count: 10,
      max_multiplier: 15.5,
      median_multiplier: 3.2,
      counts_by_target: {
        '2': 5,
        '5': 3,
        '10': 2,
      },
    },
  };

  // Example invalid RunDetail data
  const invalidRunDetail = {
    id: 'not-a-uuid',
    server_seed: '', // Empty seed
    client_seed: 'abc', // Too short
    nonce_start: 1000,
    nonce_end: 500, // Invalid range
    difficulty: 'invalid', // Invalid difficulty
    targets: 'not-an-array', // Wrong type
    duration_ms: -100, // Negative duration
    summary: {
      count: 'not-a-number', // Wrong type
      max_multiplier: -5, // Negative multiplier
      median_multiplier: 'invalid', // Wrong type
      counts_by_target: null, // Wrong type
    },
  };

  // Example Hit data
  const validHit = {
    nonce: 12345,
    max_multiplier: 5.5,
  };

  const invalidHit = {
    nonce: 'not-a-number',
    max_multiplier: -1,
  };

  const testValidRunDetail = () => {
    const validation = validateRunDetail(validRunDetail);
    let result = `Valid RunDetail Test:\n`;
    result += `Is Valid: ${validation.isValid}\n`;
    result += `Errors: ${validation.errors.length}\n`;
    result += `Warnings: ${validation.warnings.length}\n`;
    
    if (validation.warnings.length > 0) {
      result += `\nWarnings:\n${formatValidationWarnings(validation.warnings)}\n`;
    }
    
    setValidationResult(result);
  };

  const testInvalidRunDetail = () => {
    const validation = validateRunDetail(invalidRunDetail);
    let result = `Invalid RunDetail Test:\n`;
    result += `Is Valid: ${validation.isValid}\n`;
    result += `Errors: ${validation.errors.length}\n`;
    result += `Warnings: ${validation.warnings.length}\n`;
    
    if (validation.errors.length > 0) {
      result += `\nErrors:\n${formatValidationErrors(validation.errors)}\n`;
    }
    
    if (validation.warnings.length > 0) {
      result += `\nWarnings:\n${formatValidationWarnings(validation.warnings)}\n`;
    }
    
    setValidationResult(result);
  };

  const testValidHit = () => {
    const validation = validateHit(validHit);
    let result = `Valid Hit Test:\n`;
    result += `Is Valid: ${validation.isValid}\n`;
    result += `Errors: ${validation.errors.length}\n`;
    result += `Warnings: ${validation.warnings.length}\n`;
    
    setValidationResult(result);
  };

  const testInvalidHit = () => {
    const validation = validateHit(invalidHit);
    let result = `Invalid Hit Test:\n`;
    result += `Is Valid: ${validation.isValid}\n`;
    result += `Errors: ${validation.errors.length}\n`;
    result += `Warnings: ${validation.warnings.length}\n`;
    
    if (validation.errors.length > 0) {
      result += `\nErrors:\n${formatValidationErrors(validation.errors)}\n`;
    }
    
    setValidationResult(result);
  };

  const testSafeAccess = () => {
    const safeValid = safeGetRunDetail(validRunDetail);
    const safeInvalid = safeGetRunDetail(invalidRunDetail);
    
    let result = `Safe Access Test:\n`;
    result += `Valid data result: ${safeValid ? 'Success' : 'Failed'}\n`;
    result += `Invalid data result: ${safeInvalid ? 'Success' : 'Failed (expected)'}\n`;
    
    setValidationResult(result);
  };

  const testMergeDefaults = () => {
    const partialData = {
      id: 'test-id',
      server_seed: 'test-seed',
      summary: {
        count: 5,
        max_multiplier: 0,
        median_multiplier: 0,
        counts_by_target: {},
      },
    };

    const merged = mergeWithDefaults(partialData);
    
    let result = `Merge Defaults Test:\n`;
    result += `ID: ${merged.id}\n`;
    result += `Server Seed: ${merged.server_seed}\n`;
    result += `Client Seed: ${merged.client_seed} (default)\n`;
    result += `Difficulty: ${merged.difficulty} (default)\n`;
    result += `Summary Count: ${merged.summary.count}\n`;
    
    setValidationResult(result);
  };

  const testApiValidation = () => {
    // Test API validation utilities
    const validation1 = validateApiResponse.runDetailWithLogging(validRunDetail, 'Test Context');
    const validation2 = validateApiResponse.hitWithLogging(validHit, 'Test Context');
    
    let result = `API Validation Test:\n`;
    result += `RunDetail validation: ${validation1.isValid ? 'Valid' : 'Invalid'}\n`;
    result += `Hit validation: ${validation2.isValid ? 'Valid' : 'Invalid'}\n`;
    result += `Check console for detailed logging output.\n`;
    
    setValidationResult(result);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Data Validation Utilities Demo</h2>
      
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={testValidRunDetail}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test Valid RunDetail
        </button>
        
        <button
          onClick={testInvalidRunDetail}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Test Invalid RunDetail
        </button>
        
        <button
          onClick={testValidHit}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Test Valid Hit
        </button>
        
        <button
          onClick={testInvalidHit}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Test Invalid Hit
        </button>
        
        <button
          onClick={testSafeAccess}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Test Safe Access
        </button>
        
        <button
          onClick={testMergeDefaults}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Test Merge Defaults
        </button>
        
        <button
          onClick={testApiValidation}
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 col-span-2"
        >
          Test API Validation (Check Console)
        </button>
      </div>
      
      {validationResult && (
        <div className="bg-gray-100 p-4 rounded-lg">
          <h3 className="font-semibold mb-2">Validation Result:</h3>
          <pre className="whitespace-pre-wrap text-sm">{validationResult}</pre>
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-600">
        <h3 className="font-semibold mb-2">Available Validation Features:</h3>
        <ul className="list-disc list-inside space-y-1">
          <li>Runtime type checking with comprehensive error messages</li>
          <li>Field-specific validation with severity levels (critical, error, warning)</li>
          <li>Cross-field validation (e.g., nonce range consistency)</li>
          <li>Data integrity checks (e.g., target counts consistency)</li>
          <li>Safe data access with automatic validation</li>
          <li>Default value merging for partial data</li>
          <li>API response validation with logging</li>
          <li>Formatted error and warning messages</li>
        </ul>
      </div>
    </div>
  );
};