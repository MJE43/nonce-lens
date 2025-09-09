import { RunDetail, Hit } from './api';

// Validation result interfaces
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'critical' | 'error';
  value?: unknown;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: unknown;
  suggestion?: string;
}

// Type guards for runtime type checking
export const isString = (value: unknown): value is string => {
  return typeof value === 'string';
};

export const isNumber = (value: unknown): value is number => {
  return typeof value === 'number' && !isNaN(value);
};

export const isPositiveNumber = (value: unknown): value is number => {
  return isNumber(value) && value >= 0;
};

export const isArray = (value: unknown): value is unknown[] => {
  return Array.isArray(value);
};

export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

// Validation helper functions
export const validateRequired = (
  value: unknown,
  fieldName: string
): ValidationError | null => {
  if (value === undefined || value === null || value === '') {
    return {
      field: fieldName,
      message: `${fieldName} is required but is missing or empty`,
      severity: 'critical',
      value,
    };
  }
  return null;
};

export const validateString = (
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; pattern?: RegExp } = {}
): ValidationError | null => {
  if (!isString(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a string`,
      severity: 'error',
      value,
    };
  }

  if (options.minLength && value.length < options.minLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${options.minLength} characters long`,
      severity: 'error',
      value,
    };
  }

  if (options.maxLength && value.length > options.maxLength) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${options.maxLength} characters long`,
      severity: 'error',
      value,
    };
  }

  if (options.pattern && !options.pattern.test(value)) {
    return {
      field: fieldName,
      message: `${fieldName} format is invalid`,
      severity: 'error',
      value,
    };
  }

  return null;
};

export const validateNumber = (
  value: unknown,
  fieldName: string,
  options: { min?: number; max?: number; integer?: boolean } = {}
): ValidationError | null => {
  if (!isNumber(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a number`,
      severity: 'error',
      value,
    };
  }

  if (options.integer && !Number.isInteger(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be an integer`,
      severity: 'error',
      value,
    };
  }

  if (options.min !== undefined && value < options.min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${options.min}`,
      severity: 'error',
      value,
    };
  }

  if (options.max !== undefined && value > options.max) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${options.max}`,
      severity: 'error',
      value,
    };
  }

  return null;
};

export const validateArray = (
  value: unknown,
  fieldName: string,
  options: { minLength?: number; maxLength?: number; itemValidator?: (item: unknown, index: number) => ValidationError | null } = {}
): ValidationError[] => {
  const errors: ValidationError[] = [];

  if (!isArray(value)) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must be an array`,
      severity: 'error',
      value,
    });
    return errors;
  }

  if (options.minLength && value.length < options.minLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must have at least ${options.minLength} items`,
      severity: 'error',
      value,
    });
  }

  if (options.maxLength && value.length > options.maxLength) {
    errors.push({
      field: fieldName,
      message: `${fieldName} must have no more than ${options.maxLength} items`,
      severity: 'error',
      value,
    });
  }

  if (options.itemValidator) {
    value.forEach((item, index) => {
      const itemError = options.itemValidator!(item, index);
      if (itemError) {
        errors.push({
          ...itemError,
          field: `${fieldName}[${index}]`,
        });
      }
    });
  }

  return errors;
};

// RunDetail validation functions
export const validateRunDetailSummary = (summary: unknown): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!isObject(summary)) {
    errors.push({
      field: 'summary',
      message: 'Summary must be an object',
      severity: 'critical',
      value: summary,
    });
    return { isValid: false, errors, warnings };
  }

  // Validate count
  const countError = validateNumber(summary.count, 'summary.count', { min: 0, integer: true });
  if (countError) errors.push(countError);

  // Validate max_multiplier
  const maxMultiplierError = validateNumber(summary.max_multiplier, 'summary.max_multiplier', { min: 0 });
  if (maxMultiplierError) errors.push(maxMultiplierError);

  // Validate median_multiplier
  const medianMultiplierError = validateNumber(summary.median_multiplier, 'summary.median_multiplier', { min: 0 });
  if (medianMultiplierError) errors.push(medianMultiplierError);

  // Validate counts_by_target
  if (!isObject(summary.counts_by_target)) {
    errors.push({
      field: 'summary.counts_by_target',
      message: 'counts_by_target must be an object',
      severity: 'error',
      value: summary.counts_by_target,
    });
  } else {
    // Validate each target count
    Object.entries(summary.counts_by_target).forEach(([target, count]) => {
      const targetError = validateNumber(parseFloat(target), `summary.counts_by_target.${target}`, { min: 0 });
      if (targetError) {
        warnings.push({
          field: `summary.counts_by_target.${target}`,
          message: `Target key "${target}" should be a valid number`,
          value: target,
          suggestion: 'Ensure target keys are numeric strings',
        });
      }

      const countError = validateNumber(count, `summary.counts_by_target.${target}`, { min: 0, integer: true });
      if (countError) errors.push(countError);
    });

    // Check if counts_by_target is empty
    if (Object.keys(summary.counts_by_target).length === 0) {
      warnings.push({
        field: 'summary.counts_by_target',
        message: 'No target counts found',
        value: summary.counts_by_target,
        suggestion: 'This may indicate no hits were found for any targets',
      });
    }
  }

  // Cross-validation warnings
  if (isNumber(summary.count) && isNumber(summary.max_multiplier)) {
    if (summary.count === 0 && summary.max_multiplier > 0) {
      warnings.push({
        field: 'summary',
        message: 'Count is 0 but max_multiplier is greater than 0',
        suggestion: 'This may indicate inconsistent data',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

export const validateRunDetail = (data: unknown): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!isObject(data)) {
    errors.push({
      field: 'root',
      message: 'RunDetail must be an object',
      severity: 'critical',
      value: data,
    });
    return { isValid: false, errors, warnings };
  }

  // Validate required string fields
  const requiredStringFields = ['id', 'server_seed', 'client_seed', 'difficulty'];
  requiredStringFields.forEach(field => {
    const requiredError = validateRequired(data[field], field);
    if (requiredError) {
      errors.push(requiredError);
      return;
    }

    const stringError = validateString(data[field], field, { minLength: 1 });
    if (stringError) errors.push(stringError);
  });

  // Validate ID format (should be UUID-like)
  if (isString(data.id)) {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(data.id)) {
      warnings.push({
        field: 'id',
        message: 'ID does not match expected UUID format',
        value: data.id,
        suggestion: 'Ensure the ID is a valid UUID',
      });
    }
  }

  // Validate seeds (should be hex strings)
  if (isString(data.server_seed)) {
    const hexPattern = /^[0-9a-f]+$/i;
    if (!hexPattern.test(data.server_seed)) {
      warnings.push({
        field: 'server_seed',
        message: 'Server seed should be a hexadecimal string',
        value: data.server_seed,
        suggestion: 'Ensure the seed contains only hexadecimal characters',
      });
    }
    if (data.server_seed.length < 10) {
      warnings.push({
        field: 'server_seed',
        message: 'Server seed seems unusually short',
        value: data.server_seed,
        suggestion: 'Typical seeds are longer for security',
      });
    }
  }

  if (isString(data.client_seed)) {
    if (data.client_seed.length < 10) {
      warnings.push({
        field: 'client_seed',
        message: 'Client seed seems unusually short',
        value: data.client_seed,
        suggestion: 'Typical seeds are longer for security',
      });
    }
  }

  // Validate difficulty
  if (isString(data.difficulty)) {
    const validDifficulties = ['easy', 'medium', 'hard', 'expert'];
    if (!validDifficulties.includes(data.difficulty)) {
      errors.push({
        field: 'difficulty',
        message: `Difficulty must be one of: ${validDifficulties.join(', ')}`,
        severity: 'error',
        value: data.difficulty,
      });
    }
  }

  // Validate numeric fields
  const nonceStartError = validateNumber(data.nonce_start, 'nonce_start', { min: 0, integer: true });
  if (nonceStartError) errors.push(nonceStartError);

  const nonceEndError = validateNumber(data.nonce_end, 'nonce_end', { min: 0, integer: true });
  if (nonceEndError) errors.push(nonceEndError);

  const durationError = validateNumber(data.duration_ms, 'duration_ms', { min: 0, integer: true });
  if (durationError) errors.push(durationError);

  // Validate nonce range
  if (isNumber(data.nonce_start) && isNumber(data.nonce_end)) {
    if (data.nonce_start >= data.nonce_end) {
      errors.push({
        field: 'nonce_range',
        message: 'nonce_start must be less than nonce_end',
        severity: 'error',
        value: { start: data.nonce_start, end: data.nonce_end },
      });
    }

    const range = data.nonce_end - data.nonce_start;
    if (range > 1000000) {
      warnings.push({
        field: 'nonce_range',
        message: 'Very large nonce range detected',
        value: range,
        suggestion: 'Large ranges may indicate performance issues',
      });
    }
  }

  // Validate targets array
  const targetErrors = validateArray(data.targets, 'targets', {
    minLength: 1,
    itemValidator: (item, index) => validateNumber(item, `targets[${index}]`, { min: 0 })
  });
  errors.push(...targetErrors);

  // Validate targets are sorted and unique
  if (isArray(data.targets) && data.targets.every(isNumber)) {
    const sortedTargets = [...data.targets].sort((a, b) => a - b);
    const uniqueTargets = [...new Set(data.targets)];
    
    if (JSON.stringify(data.targets) !== JSON.stringify(sortedTargets)) {
      warnings.push({
        field: 'targets',
        message: 'Targets are not sorted in ascending order',
        suggestion: 'Targets should be sorted for consistency',
      });
    }

    if (uniqueTargets.length !== data.targets.length) {
      warnings.push({
        field: 'targets',
        message: 'Duplicate targets found',
        suggestion: 'Remove duplicate target values',
      });
    }
  }

  // Validate optional engine_version
  if (data.engine_version !== undefined) {
    const engineVersionError = validateString(data.engine_version, 'engine_version', { minLength: 1 });
    if (engineVersionError) errors.push(engineVersionError);
  } else {
    warnings.push({
      field: 'engine_version',
      message: 'Engine version is missing',
      suggestion: 'Include engine version for better debugging',
    });
  }

  // Validate summary
  const summaryValidation = validateRunDetailSummary(data.summary);
  errors.push(...summaryValidation.errors);
  warnings.push(...summaryValidation.warnings);

  // Cross-field validation
  if (isArray(data.targets) && isObject(data.summary) && isObject(data.summary.counts_by_target)) {
    const targetKeys = Object.keys(data.summary.counts_by_target).map(k => parseFloat(k));
    const missingTargets = (data.targets as number[]).filter(target => !targetKeys.includes(target));
    
    if (missingTargets.length > 0) {
      warnings.push({
        field: 'summary.counts_by_target',
        message: `Missing counts for targets: ${missingTargets.join(', ')}`,
        suggestion: 'All targets should have corresponding counts',
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// Hit validation
export const validateHit = (data: unknown): ValidationResult => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  if (!isObject(data)) {
    errors.push({
      field: 'root',
      message: 'Hit must be an object',
      severity: 'critical',
      value: data,
    });
    return { isValid: false, errors, warnings };
  }

  // Validate nonce
  const nonceError = validateNumber(data.nonce, 'nonce', { min: 0, integer: true });
  if (nonceError) errors.push(nonceError);

  // Validate max_multiplier
  const multiplierError = validateNumber(data.max_multiplier, 'max_multiplier', { min: 0 });
  if (multiplierError) errors.push(multiplierError);

  // Warning for very high multipliers
  if (isNumber(data.max_multiplier) && data.max_multiplier > 1000000) {
    warnings.push({
      field: 'max_multiplier',
      message: 'Extremely high multiplier detected',
      value: data.max_multiplier,
      suggestion: 'Verify this multiplier is correct',
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// Utility functions for error handling
export const formatValidationErrors = (errors: ValidationError[]): string => {
  if (errors.length === 0) return '';
  
  const criticalErrors = errors.filter(e => e.severity === 'critical');
  const regularErrors = errors.filter(e => e.severity === 'error');
  
  let message = '';
  
  if (criticalErrors.length > 0) {
    message += 'Critical errors:\n';
    message += criticalErrors.map(e => `• ${e.field}: ${e.message}`).join('\n');
  }
  
  if (regularErrors.length > 0) {
    if (message) message += '\n\n';
    message += 'Errors:\n';
    message += regularErrors.map(e => `• ${e.field}: ${e.message}`).join('\n');
  }
  
  return message;
};

export const formatValidationWarnings = (warnings: ValidationWarning[]): string => {
  if (warnings.length === 0) return '';
  
  let message = 'Warnings:\n';
  message += warnings.map(w => {
    let line = `• ${w.field}: ${w.message}`;
    if (w.suggestion) {
      line += ` (${w.suggestion})`;
    }
    return line;
  }).join('\n');
  
  return message;
};

// Safe data access with validation
export const safeGetRunDetail = (data: unknown): Partial<RunDetail> | null => {
  const validation = validateRunDetail(data);
  
  if (!validation.isValid) {
    console.error('RunDetail validation failed:', formatValidationErrors(validation.errors));
    return null;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('RunDetail validation warnings:', formatValidationWarnings(validation.warnings));
  }
  
  return data as RunDetail;
};

export const safeGetHit = (data: unknown): Hit | null => {
  const validation = validateHit(data);
  
  if (!validation.isValid) {
    console.error('Hit validation failed:', formatValidationErrors(validation.errors));
    return null;
  }
  
  if (validation.warnings.length > 0) {
    console.warn('Hit validation warnings:', formatValidationWarnings(validation.warnings));
  }
  
  return data as Hit;
};

// Default/fallback values for missing data
export const getRunDetailDefaults = (): Partial<RunDetail> => ({
  id: '',
  server_seed: '',
  client_seed: '',
  nonce_start: 0,
  nonce_end: 0,
  difficulty: 'medium',
  targets: [],
  duration_ms: 0,
  engine_version: 'unknown',
  summary: {
    count: 0,
    max_multiplier: 0,
    median_multiplier: 0,
    counts_by_target: {},
  },
});

export const mergeWithDefaults = (data: Partial<RunDetail>): RunDetail => {
  const defaults = getRunDetailDefaults();
  return {
    ...defaults,
    ...data,
    summary: {
      ...defaults.summary!,
      ...data.summary,
    },
  } as RunDetail;
};