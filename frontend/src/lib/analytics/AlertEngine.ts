/**
 * Alert engine for detecting significant events in betting data.
 * Supports gap alerts, cluster alerts, and threshold alerts with rate limiting.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import type { BetRecord } from '@/lib/api';

export interface AlertRule {
  id: string;
  multiplier: number;
  type: 'gap' | 'cluster' | 'threshold';
  config: GapAlertConfig | ClusterAlertConfig | ThresholdAlertConfig;
  enabled: boolean;
}

export interface GapAlertConfig {
  threshold: 'p95' | 'mean_plus_z';
  zScore?: number; // for mean_plus_z (default 2)
}

export interface ClusterAlertConfig {
  windowNonces: number; // default 2000
  windowSeconds: number; // default 60
  minCount: number; // default 3
  minMultiplier: number;
}

export interface ThresholdAlertConfig {
  targetMultiplier: number;
}

export interface AlertEvent {
  id: string;
  rule_id: string;
  multiplier: number;
  type: 'gap' | 'cluster' | 'threshold';
  message: string;
  nonce: number;
  timestamp: Date;
  acknowledged: boolean;
}

export interface MultiplierStatsCalculator {
  count: number;
  lastGap: number;
  meanGap: number;
  stdGap: number;
  p90Gap: number;
}

export class AlertEngine {
  private rules: Map<string, AlertRule> = new Map();
  private lastAlertTimes: Map<string, Date> = new Map();
  private slidingWindows: Map<string, Array<{nonce: number, multiplier: number, timestamp: Date}>> = new Map();
  private readonly rateLimitMs: number = 10000; // 10 seconds

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
    this.lastAlertTimes.delete(ruleId);
    this.slidingWindows.delete(ruleId);
  }

  /**
   * Update an existing alert rule
   */
  updateRule(rule: AlertRule): void {
    if (this.rules.has(rule.id)) {
      this.rules.set(rule.id, rule);
    }
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get a specific rule by ID
   */
  getRule(ruleId: string): AlertRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Check alerts for a new bet
   */
  checkAlerts(bet: BetRecord, multiplierStats: Map<number, MultiplierStatsCalculator>): AlertEvent[] {
    const alerts: AlertEvent[] = [];
    const now = new Date();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const shouldFire = this.evaluateRule(rule, bet, multiplierStats, now);
      if (shouldFire && this.canFireAlert(rule.id, now)) {
        alerts.push(this.createAlertEvent(rule, bet, now));
        this.lastAlertTimes.set(rule.id, now);
      }
    }

    return alerts;
  }

  /**
   * Evaluate a specific rule against a bet
   */
  private evaluateRule(
    rule: AlertRule,
    bet: BetRecord,
    multiplierStats: Map<number, MultiplierStatsCalculator>,
    now: Date
  ): boolean {
    switch (rule.type) {
      case 'gap':
        return this.evaluateGapAlert(rule, bet, multiplierStats);
      case 'cluster':
        return this.evaluateClusterAlert(rule, bet, now);
      case 'threshold':
        return this.evaluateThresholdAlert(rule, bet);
      default:
        return false;
    }
  }

  /**
   * Evaluate gap alert rule
   */
  private evaluateGapAlert(
    rule: AlertRule,
    bet: BetRecord,
    multiplierStats: Map<number, MultiplierStatsCalculator>
  ): boolean {
    const stats = multiplierStats.get(rule.multiplier);
    if (!stats || stats.count < 2) return false;

    const config = rule.config as GapAlertConfig;
    const currentGap = stats.lastGap;

    if (config.threshold === 'p95') {
      // Use p90 as approximation for p95
      return currentGap > stats.p90Gap;
    } else if (config.threshold === 'mean_plus_z') {
      const zScore = config.zScore || 2;
      const threshold = stats.meanGap + zScore * stats.stdGap;
      return currentGap > threshold;
    }

    return false;
  }

  /**
   * Evaluate cluster alert rule
   */
  private evaluateClusterAlert(rule: AlertRule, bet: BetRecord, now: Date): boolean {
    const config = rule.config as ClusterAlertConfig;
    const windowKey = `cluster_${rule.id}`;

    if (!this.slidingWindows.has(windowKey)) {
      this.slidingWindows.set(windowKey, []);
    }

    const window = this.slidingWindows.get(windowKey)!;

    // Add current bet if it meets minimum multiplier
    if (bet.round_result >= config.minMultiplier) {
      window.push({
        nonce: bet.nonce,
        multiplier: bet.round_result,
        timestamp: now
      });
    }

    // Prune window by both nonce and time
    const cutoffTime = new Date(now.getTime() - config.windowSeconds * 1000);
    const cutoffNonce = bet.nonce - config.windowNonces;

    const prunedWindow = window.filter(item =>
      item.timestamp >= cutoffTime && item.nonce >= cutoffNonce
    );

    this.slidingWindows.set(windowKey, prunedWindow);

    return prunedWindow.length >= config.minCount;
  }

  /**
   * Evaluate threshold alert rule
   */
  private evaluateThresholdAlert(rule: AlertRule, bet: BetRecord): boolean {
    const config = rule.config as ThresholdAlertConfig;
    return bet.round_result >= config.targetMultiplier;
  }

  /**
   * Check if an alert can be fired (rate limiting)
   */
  private canFireAlert(ruleId: string, now: Date): boolean {
    const lastAlert = this.lastAlertTimes.get(ruleId);
    if (!lastAlert) return true;

    const timeSinceLastAlert = now.getTime() - lastAlert.getTime();
    return timeSinceLastAlert >= this.rateLimitMs;
  }

  /**
   * Create an alert event
   */
  private createAlertEvent(rule: AlertRule, bet: BetRecord, timestamp: Date): AlertEvent {
    return {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      rule_id: rule.id,
      multiplier: bet.round_result,
      type: rule.type,
      message: this.generateAlertMessage(rule, bet),
      nonce: bet.nonce,
      timestamp,
      acknowledged: false
    };
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, bet: BetRecord): string {
    switch (rule.type) {
      case 'gap':
        return `Gap alert: ${bet.round_result}x at nonce ${bet.nonce} exceeded threshold`;
      case 'cluster':
        const config = rule.config as ClusterAlertConfig;
        return `Cluster alert: ${config.minCount}+ hits ≥${config.minMultiplier}x detected`;
      case 'threshold':
        return `Threshold alert: ${bet.round_result}x hit at nonce ${bet.nonce}`;
      default:
        return `Alert triggered for ${bet.round_result}x`;
    }
  }

  /**
   * Clear all sliding windows (for stream reset)
   */
  reset(): void {
    this.slidingWindows.clear();
    this.lastAlertTimes.clear();
  }

  /**
   * Get alert statistics
   */
  getStats(): {
    totalRules: number;
    enabledRules: number;
    recentAlerts: number;
  } {
    const enabledRules = Array.from(this.rules.values()).filter(rule => rule.enabled).length;
    const now = new Date();
    const recentAlerts = Array.from(this.lastAlertTimes.values())
      .filter(alertTime => now.getTime() - alertTime.getTime() < 60000) // Last minute
      .length;

    return {
      totalRules: this.rules.size,
      enabledRules,
      recentAlerts
    };
  }
}
