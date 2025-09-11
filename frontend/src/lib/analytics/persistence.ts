/**
 * Persistence utilities for analytics state.
 * Manages pinned multipliers and other session-based state.
 *
 * Requirements: 2.2, 1.8
 */

const STORAGE_KEYS = {
  PINNED_MULTIPLIERS: 'pump_analytics_pinned_multipliers',
  ANALYTICS_SETTINGS: 'pump_analytics_settings'
} as const;

export interface PinnedMultiplierData {
  streamId: string;
  multipliers: number[];
  tolerance: number;
  createdAt: string;
}

export interface AnalyticsSettings {
  densityBucketSize: number;
  rollingWindowType: 'time' | 'count';
  rollingWindowSize: number;
  alertSettings: {
    gapAlertThreshold: 'p95' | 'mean_plus_z';
    gapAlertZScore: number;
    clusterWindowNonces: number;
    clusterWindowSeconds: number;
    clusterMinCount: number;
  };
}

const DEFAULT_SETTINGS: AnalyticsSettings = {
  densityBucketSize: 1000,
  rollingWindowType: 'time',
  rollingWindowSize: 60,
  alertSettings: {
    gapAlertThreshold: 'p95',
    gapAlertZScore: 2,
    clusterWindowNonces: 2000,
    clusterWindowSeconds: 60,
    clusterMinCount: 3
  }
};

/**
 * Save pinned multipliers for a stream
 */
export function savePinnedMultipliers(streamId: string, multipliers: number[], tolerance: number = 1e-9): void {
  try {
    const data: PinnedMultiplierData = {
      streamId,
      multipliers,
      tolerance,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem(`${STORAGE_KEYS.PINNED_MULTIPLIERS}_${streamId}`, JSON.stringify(data));
  } catch (error) {
    console.warn('Failed to save pinned multipliers:', error);
  }
}

/**
 * Load pinned multipliers for a stream
 */
export function loadPinnedMultipliers(streamId: string): { multipliers: number[], tolerance: number } {
  try {
    const stored = localStorage.getItem(`${STORAGE_KEYS.PINNED_MULTIPLIERS}_${streamId}`);
    if (!stored) {
      return { multipliers: [], tolerance: 1e-9 };
    }

    const data: PinnedMultiplierData = JSON.parse(stored);

    // Validate data structure
    if (!Array.isArray(data.multipliers) || typeof data.tolerance !== 'number') {
      return { multipliers: [], tolerance: 1e-9 };
    }

    return {
      multipliers: data.multipliers,
      tolerance: data.tolerance
    };
  } catch (error) {
    console.warn('Failed to load pinned multipliers:', error);
    return { multipliers: [], tolerance: 1e-9 };
  }
}

/**
 * Clear pinned multipliers for a stream
 */
export function clearPinnedMultipliers(streamId: string): void {
  try {
    localStorage.removeItem(`${STORAGE_KEYS.PINNED_MULTIPLIERS}_${streamId}`);
  } catch (error) {
    console.warn('Failed to clear pinned multipliers:', error);
  }
}

/**
 * Get all stream IDs that have pinned multipliers
 */
export function getStreamsWithPinnedMultipliers(): string[] {
  try {
    const streamIds: string[] = [];
    const prefix = `${STORAGE_KEYS.PINNED_MULTIPLIERS}_`;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const streamId = key.slice(prefix.length);
        streamIds.push(streamId);
      }
    }

    return streamIds;
  } catch (error) {
    console.warn('Failed to get streams with pinned multipliers:', error);
    return [];
  }
}

/**
 * Save analytics settings
 */
export function saveAnalyticsSettings(settings: Partial<AnalyticsSettings>): void {
  try {
    const currentSettings = loadAnalyticsSettings();
    const updatedSettings = { ...currentSettings, ...settings };
    localStorage.setItem(STORAGE_KEYS.ANALYTICS_SETTINGS, JSON.stringify(updatedSettings));
  } catch (error) {
    console.warn('Failed to save analytics settings:', error);
  }
}

/**
 * Load analytics settings
 */
export function loadAnalyticsSettings(): AnalyticsSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.ANALYTICS_SETTINGS);
    if (!stored) {
      return DEFAULT_SETTINGS;
    }

    const settings = JSON.parse(stored);

    // Merge with defaults to handle missing properties
    return {
      ...DEFAULT_SETTINGS,
      ...settings,
      alertSettings: {
        ...DEFAULT_SETTINGS.alertSettings,
        ...(settings.alertSettings || {})
      }
    };
  } catch (error) {
    console.warn('Failed to load analytics settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Clear analytics settings
 */
export function clearAnalyticsSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.ANALYTICS_SETTINGS);
  } catch (error) {
    console.warn('Failed to clear analytics settings:', error);
  }
}

/**
 * Clear all analytics data
 */
export function clearAllAnalyticsData(): void {
  try {
    // Clear all pinned multipliers
    const streamIds = getStreamsWithPinnedMultipliers();
    streamIds.forEach(streamId => clearPinnedMultipliers(streamId));

    // Clear settings
    clearAnalyticsSettings();
  } catch (error) {
    console.warn('Failed to clear all analytics data:', error);
  }
}

/**
 * Export analytics data for backup
 */
export function exportAnalyticsData(): string {
  try {
    const data = {
      settings: loadAnalyticsSettings(),
      pinnedMultipliers: {} as Record<string, PinnedMultiplierData>
    };

    const streamIds = getStreamsWithPinnedMultipliers();
    streamIds.forEach(streamId => {
      const stored = localStorage.getItem(`${STORAGE_KEYS.PINNED_MULTIPLIERS}_${streamId}`);
      if (stored) {
        data.pinnedMultipliers[streamId] = JSON.parse(stored);
      }
    });

    return JSON.stringify(data, null, 2);
  } catch (error) {
    console.warn('Failed to export analytics data:', error);
    return '{}';
  }
}

/**
 * Import analytics data from backup
 */
export function importAnalyticsData(jsonData: string): boolean {
  try {
    const data = JSON.parse(jsonData);

    // Import settings
    if (data.settings) {
      saveAnalyticsSettings(data.settings);
    }

    // Import pinned multipliers
    if (data.pinnedMultipliers) {
      Object.entries(data.pinnedMultipliers).forEach(([streamId, pinnedData]) => {
        const typedData = pinnedData as PinnedMultiplierData;
        if (Array.isArray(typedData.multipliers)) {
          savePinnedMultipliers(streamId, typedData.multipliers, typedData.tolerance);
        }
      });
    }

    return true;
  } catch (error) {
    console.warn('Failed to import analytics data:', error);
    return false;
  }
}
