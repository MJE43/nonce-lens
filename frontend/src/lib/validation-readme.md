# Data Validation Utilities

This module provides comprehensive runtime validation for RunDetail and Hit data structures, implementing the requirements for task 2 of the run-results-debug spec.

## Features Implemented

### 1. Runtime Validation for RunDetail Interface ✅

- **Complete type checking**: Validates all fields in the RunDetail interface
- **Field-specific validation**: Each field has appropriate validation rules
- **Nested object validation**: Validates the summary object and its properties
- **Array validation**: Validates targets array with item-level checking

### 2. Validation Helper Functions ✅

- **Type guards**: `isString`, `isNumber`, `isPositiveNumber`, `isArray`, `isObject`
- **Field validators**: `validateRequired`, `validateString`, `validateNumber`, `validateArray`
- **Specialized validators**: `validateRunDetail`, `validateRunDetailSummary`, `validateHit`
- **Safe access functions**: `safeGetRunDetail`, `safeGetHit`
- **Default merging**: `mergeWithDefaults` for partial data

### 3. Error and Warning Categorization ✅

- **Error severity levels**: `critical`, `error`
- **Warning system**: Non-blocking issues with suggestions
- **Structured error objects**: Include field, message, severity, and value
- **Formatted output**: `formatValidationErrors`, `formatValidationWarnings`

## Validation Rules Implemented

### RunDetail Validation

#### Required Fields (Critical Errors)
- `id`: Must be present and non-empty string
- `server_seed`: Must be present and non-empty string
- `client_seed`: Must be present and non-empty string
- `nonce_start`: Must be a non-negative integer
- `nonce_end`: Must be a non-negative integer
- `difficulty`: Must be one of: 'easy', 'medium', 'hard', 'expert'
- `targets`: Must be an array of positive numbers
- `duration_ms`: Must be a non-negative integer
- `summary`: Must be an object with required properties

#### Data Integrity Checks (Errors)
- **Nonce range**: `nonce_start` must be less than `nonce_end`
- **Target array**: Must contain only positive numbers
- **Summary counts**: All count values must be non-negative integers
- **Summary multipliers**: Must be non-negative numbers

#### Data Quality Warnings
- **ID format**: Warns if ID doesn't match UUID pattern
- **Seed length**: Warns if seeds are unusually short
- **Seed format**: Warns if server_seed isn't hexadecimal
- **Engine version**: Warns if missing (optional field)
- **Target sorting**: Warns if targets aren't sorted
- **Target duplicates**: Warns if duplicate targets found
- **Large ranges**: Warns about very large nonce ranges
- **Empty target counts**: Warns if no target counts found
- **Missing target counts**: Warns if targets have no corresponding counts
- **Data consistency**: Warns about inconsistent count/multiplier relationships

### Hit Validation

#### Required Fields
- `nonce`: Must be a non-negative integer
- `max_multiplier`: Must be a non-negative number

#### Data Quality Warnings
- **Extreme values**: Warns about unusually high multipliers

## Cross-Field Validation

The validation system performs cross-field checks to ensure data consistency:

1. **Nonce range validation**: Ensures start < end
2. **Target-count consistency**: Verifies all targets have corresponding counts
3. **Summary consistency**: Checks for logical consistency in summary data

## Integration with API

The validation utilities are integrated into the API client:

- **Automatic validation**: API responses are automatically validated in development
- **Console logging**: Validation results are logged to browser console
- **Error categorization**: API errors include validation context
- **Response validation**: `validateApiResponse` utilities for manual validation

## Usage Examples

### Basic Validation
```typescript
import { validateRunDetail, formatValidationErrors } from './validation';

const validation = validateRunDetail(apiResponse);
if (!validation.isValid) {
  console.error('Validation failed:', formatValidationErrors(validation.errors));
}
```

### Safe Data Access
```typescript
import { safeGetRunDetail } from './validation';

const runDetail = safeGetRunDetail(apiResponse);
if (runDetail) {
  // Data is validated and safe to use
  console.log('Run ID:', runDetail.id);
}
```

### Merge with Defaults
```typescript
import { mergeWithDefaults } from './validation';

const completeData = mergeWithDefaults(partialApiResponse);
// Missing fields are filled with sensible defaults
```

## Error Handling Strategy

The validation system implements a three-tier error handling approach:

1. **Critical Errors**: Data structure is fundamentally invalid (e.g., not an object)
2. **Errors**: Required fields missing or invalid types (blocks processing)
3. **Warnings**: Data quality issues that don't prevent usage (logged but non-blocking)

This approach allows the application to:
- Fail fast on critical issues
- Handle missing/invalid data gracefully
- Provide debugging information for data quality issues
- Continue operation with partial or imperfect data when possible

## Requirements Compliance

This implementation satisfies the requirements specified in the design document:

- **Requirement 6.2**: "WHEN data parsing fails THEN the specific parsing error SHALL be captured"
  - ✅ Detailed error messages with field-specific information
  - ✅ Error categorization by severity and type
  - ✅ Value capture for debugging

- **Requirement 6.3**: "WHEN the backend returns unexpected data format THEN the frontend SHALL handle it gracefully"
  - ✅ Runtime type checking prevents crashes
  - ✅ Safe data access functions return null for invalid data
  - ✅ Default value merging handles partial data
  - ✅ Warning system for non-critical issues

The validation utilities provide a robust foundation for debugging data loading issues and ensuring data integrity throughout the application.
