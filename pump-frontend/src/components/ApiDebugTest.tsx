import React, { useState } from 'react';
import { testApiConnection, getErrorDetails, runsApi } from '../lib/api';

// Simple component to test API debugging functionality
export const ApiDebugTest: React.FC = () => {
  const [testResult, setTestResult] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const handleTestConnection = async () => {
    setIsLoading(true);
    setTestResult('Testing API connection...');
    
    try {
      const result = await testApiConnection();
      
      if (result.success) {
        setTestResult(`✅ API connection successful! Response time: ${result.responseTime}ms`);
      } else {
        setTestResult(`❌ API connection failed: ${result.error} (Response time: ${result.responseTime}ms)`);
      }
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      setTestResult(`❌ Test failed: ${error.message}${errorDetails ? ` (Type: ${errorDetails.type})` : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestRunsApi = async () => {
    setIsLoading(true);
    setTestResult('Testing runs API...');
    
    try {
      const response = await runsApi.list({ limit: 1 });
      setTestResult(`✅ Runs API successful! Found ${response.data.total} runs`);
    } catch (error: any) {
      const errorDetails = getErrorDetails(error);
      setTestResult(`❌ Runs API failed: ${error.message}${errorDetails ? ` (Type: ${errorDetails.type}, Status: ${errorDetails.status})` : ''}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-gray-50">
      <h3 className="text-lg font-semibold mb-4">API Debug Test</h3>
      
      <div className="space-y-3">
        <button
          onClick={handleTestConnection}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Testing...' : 'Test API Connection'}
        </button>
        
        <button
          onClick={handleTestRunsApi}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 ml-2"
        >
          {isLoading ? 'Testing...' : 'Test Runs API'}
        </button>
      </div>
      
      {testResult && (
        <div className="mt-4 p-3 bg-white border rounded">
          <pre className="text-sm whitespace-pre-wrap">{testResult}</pre>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-600">
        <p>Open browser dev tools console to see detailed API debugging logs.</p>
      </div>
    </div>
  );
};