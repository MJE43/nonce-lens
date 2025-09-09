# Design Document

## Overview

This design document outlines the debugging and fixing approach for the run results display page where analysis run data is not loading properly. The issue appears to be in the data flow between the API, React Query hooks, and the RunDetail component. The design focuses on systematic debugging, error handling improvements, and ensuring robust data display.

Based on the code analysis, the RunDetail component relies on the `useRun` hook which calls `runsApi.get(id)` to fetch run details. The component expects a `RunDetail` interface with specific properties, but the data may not be loading correctly due to API issues, data format mismatches, or error handling problems.

## Architecture

### Debugging Strategy
- **API Layer Investigation**: Verify the backend API endpoints are working correctly
- **Data Flow Analysis**: Trace data from API response through React Query to component rendering
- **Error Handling Enhancement**: Improve error visibility and user feedback
- **Data Validation**: Add runtime validation to catch data format issues
- **Logging Enhancement**: Add comprehensive logging for debugging

### Component Architecture
- **RunDetail Component**: Main component displaying run results
- **API Client**: Axios-based client handling HTTP requests
- **React Query Hooks**: Data fetching and caching layer
- **Error Boundary**: Catch and display component-level errors

## Components and Interfaces

### 1. API Debugging Component
**Purpose**: Diagnose API connectivity and response issues
**Key Features**:
- Test API endpoint accessibility
- Validate response data structure
- Log detailed error information
- Check for CORS or network issues

### 2. Enhanced Error Handling
**Purpose**: Provide better error visibility and user feedback
**Key Features**:
- Detailed error messages for different failure types
- Network error detection and messaging
- Data validation error reporting
- Fallback UI for partial data loading

### 3. Data Validation Layer
**Purpose**: Ensure API response matches expected interface
**Key Features**:
- Runtime type checking for RunDetail interface
- Graceful handling of missing or malformed data
- Default values for optional fields
- Data transformation utilities

### 4. Debug Information Panel
**Purpose**: Display debugging information for development
**Key Features**:
- API response inspection
- Loading state visualization
- Error details display
- Network request timing

## Data Models

### Enhanced RunDetail Interface
```typescript
interface RunDetail {
  id: string;
  server_seed: string;
  client_seed: string;
  nonce_start: number;
  nonce_end: number;
  difficulty: string;
  targets: number[];
  duration_ms: number;
  engine_version: string;
  summary: {
    count: number;
    max_multiplier: number;
    median_multiplier: number;
    counts_by_target: Record<string, number>;
  };
}

// Add validation helper
interface RunDetailValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}
```

### API Error Response
```typescript
interface APIError {
  message: string;
  status: number;
  details?: any;
  timestamp: string;
}
```

### Debug Information
```typescript
interface DebugInfo {
  apiUrl: string;
  requestTime: number;
  responseTime: number;
  responseStatus: number;
  responseData: any;
  errors: string[];
}
```

## Error Handling

### API Error Categories
1. **Network Errors**: Connection failures, timeouts
2. **HTTP Errors**: 404 (run not found), 500 (server error)
3. **Data Format Errors**: Invalid JSON, missing required fields
4. **Validation Errors**: Data doesn't match expected interface

### Error Recovery Strategies
- **Retry Logic**: Automatic retry for transient network errors
- **Fallback Data**: Display partial data when available
- **User Actions**: Provide refresh button and navigation options
- **Error Reporting**: Log errors for debugging

## Testing Strategy

### API Testing
- **Endpoint Verification**: Test API endpoints directly
- **Response Validation**: Verify response format matches interface
- **Error Simulation**: Test various error conditions
- **Network Conditions**: Test under different network conditions

### Component Testing
- **Data Loading States**: Test loading, success, and error states
- **Error Boundaries**: Verify error boundary catches component errors
- **User Interactions**: Test refresh, navigation, and copy functions
- **Responsive Behavior**: Test on different screen sizes

### Integration Testing
- **End-to-End Flow**: Test complete user journey from navigation to data display
- **API Integration**: Test with real backend API
- **Error Scenarios**: Test various failure modes
- **Performance**: Verify loading times and responsiveness

## Implementation Details

### Debugging Approach
1. **API Endpoint Testing**: Verify backend API is accessible and returning data
2. **Network Request Inspection**: Check browser dev tools for failed requests
3. **Data Structure Validation**: Ensure API response matches expected format
4. **Component State Debugging**: Add logging to track component state changes
5. **Error Boundary Implementation**: Catch and display component errors

### Enhanced Error Handling
```typescript
// Enhanced API client with better error handling
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000, // 10 second timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Enhanced response interceptor
apiClient.interceptors.response.use(
  (response) => {
    console.log('API Response:', response);
    return response;
  },
  (error) => {
    console.error('API Error:', error);
    
    if (error.code === 'NETWORK_ERROR') {
      throw new Error('Network connection failed. Please check your internet connection.');
    }
    
    if (error.response?.status === 404) {
      throw new Error('Run not found. The analysis run may have been deleted.');
    }
    
    if (error.response?.status >= 500) {
      throw new Error('Server error. Please try again later.');
    }
    
    const message = error.response?.data?.error?.message || error.message || "An error occurred";
    throw new Error(message);
  }
);
```

### Data Validation Utility
```typescript
const validateRunDetail = (data: any): RunDetailValidation => {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required fields validation
  if (!data.id) errors.push('Missing run ID');
  if (!data.server_seed) errors.push('Missing server seed');
  if (!data.client_seed) errors.push('Missing client seed');
  if (typeof data.nonce_start !== 'number') errors.push('Invalid nonce start');
  if (typeof data.nonce_end !== 'number') errors.push('Invalid nonce end');
  if (!data.difficulty) errors.push('Missing difficulty');
  if (!Array.isArray(data.targets)) errors.push('Invalid targets format');
  if (typeof data.duration_ms !== 'number') errors.push('Invalid duration');
  if (!data.engine_version) warnings.push('Missing engine version');
  
  // Summary validation
  if (!data.summary) {
    errors.push('Missing summary data');
  } else {
    if (typeof data.summary.count !== 'number') errors.push('Invalid summary count');
    if (typeof data.summary.max_multiplier !== 'number') errors.push('Invalid max multiplier');
    if (typeof data.summary.median_multiplier !== 'number') errors.push('Invalid median multiplier');
    if (!data.summary.counts_by_target) errors.push('Missing target counts');
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};
```

### Enhanced RunDetail Component
```typescript
const RunDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [debugMode, setDebugMode] = useState(false);
  
  const { data: run, isLoading: runLoading, error: runError } = useRun(id!);
  
  // Add debug information
  useEffect(() => {
    if (run) {
      console.log('Run data loaded:', run);
      const validation = validateRunDetail(run);
      if (!validation.isValid) {
        console.error('Data validation errors:', validation.errors);
      }
      if (validation.warnings.length > 0) {
        console.warn('Data validation warnings:', validation.warnings);
      }
    }
  }, [run]);
  
  // Enhanced error handling
  if (runError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-6">
        <div className="text-red-800 mb-4">
          <h2 className="text-lg font-semibold mb-2">Error Loading Run</h2>
          <p>{runError.message}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
          <Link to="/" className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700">
            Back to Runs
          </Link>
          <button
            onClick={() => setDebugMode(!debugMode)}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            {debugMode ? 'Hide' : 'Show'} Debug Info
          </button>
        </div>
        {debugMode && (
          <div className="mt-4 p-4 bg-gray-100 rounded">
            <h3 className="font-semibold mb-2">Debug Information</h3>
            <pre className="text-sm overflow-auto">
              {JSON.stringify({ error: runError, runId: id }, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  }
  
  // Rest of component...
};
```

## Design Decisions and Rationales

### Comprehensive Error Handling
- **User-Friendly Messages**: Convert technical errors into understandable messages
- **Actionable Feedback**: Provide clear next steps for users
- **Debug Information**: Include detailed debugging info for developers

### Data Validation
- **Runtime Validation**: Catch data format issues at runtime
- **Graceful Degradation**: Display partial data when possible
- **Warning System**: Distinguish between critical errors and warnings

### Debugging Tools
- **Console Logging**: Comprehensive logging for development debugging
- **Debug Mode**: Toggle detailed debugging information display
- **Network Inspection**: Encourage use of browser dev tools

### Performance Considerations
- **Request Timeout**: Prevent hanging requests
- **Error Boundaries**: Prevent component crashes from affecting entire app
- **Efficient Re-renders**: Minimize unnecessary component updates

The design focuses on systematic debugging and robust error handling to identify and fix the root cause of the data loading issue while providing a better user experience during error conditions.