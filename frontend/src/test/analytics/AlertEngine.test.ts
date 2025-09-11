import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AlertEngine } from '../../lib/analytics/AlertEngine';
import type { AlertRule, BetRecord, MultiplierStatsCalculator } from '../../lib/analytics/types';

describe('AlertEngine', () => {
  let alertEngine: AlertEngine;
  let mockBet: BetRecord;
  let mockStats: Map<number, MultiplierStatsCalculator>;

  beforeEach(() => {
    alertEngine = new AlertEngine();
    
    mockBet = {
      id: 1,
      nonce: 1000,
      payout_multiplier: 5.0,
      date_time: '2024-01-01T00:00:00Z',
      amount: 100,
      payout: 500,
      difficulty: 'medium',
      round_target: 'target',
      round_result: 'result'
    };

    mockStats = new Map();
    mockStats.set(5.0, {
      count: 10,
      lastGap: 150,
      meanGap: 100,
      stdGap: 20,
      p90Gap: 140
    });
  });

  describe('Rule Management', () => {
    it('should add and retrieve rules', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 10.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      const rules = alertEngine.getRules();
      
      expect(rules).toHaveLength(1);
      expect(rules[0]).toEqual(rule);
    });

    it('should remove rules', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 10.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      alertEngine.removeRule('test-rule');
      
      expect(alertEngine.getRules()).toHaveLength(0);
    });

    it('should update existing rules', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 10.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      
      const updatedRule = { ...rule, enabled: false };
      alertEngine.updateRule(updatedRule);
      
      const rules = alertEngine.getRules();
      expect(rules[0].enabled).toBe(false);
    });
  });

  describe('Gap Alerts', () => {
    it('should trigger gap alert when using p95 threshold', () => {
      const rule: AlertRule = {
        id: 'gap-rule',
        multiplier: 5.0,
        type: 'gap',
        config: { threshold: 'p95' },
        enabled: true
      };

      alertEngine.addRule(rule);
      
      // Set last gap higher than p90 (which approximates p95)
      mockStats.set(5.0, {
        count: 10,
        lastGap: 150, // > p90Gap (140)
        meanGap: 100,
        stdGap: 20,
        p90Gap: 140
      });

      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('gap');
    });

    it('should trigger gap alert when using mean_plus_z threshold', () => {
      const rule: AlertRule = {
        id: 'gap-rule',
        multiplier: 5.0,
        type: 'gap',
        config: { threshold: 'mean_plus_z', zScore: 2 },
        enabled: true
      };

      alertEngine.addRule(rule);
      
      // Set last gap higher than mean + 2*std (100 + 2*20 = 140)
      mockStats.set(5.0, {
        count: 10,
        lastGap: 150, // > 140
        meanGap: 100,
        stdGap: 20,
        p90Gap: 140
      });

      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('gap');
    });

    it('should not trigger gap alert for different multiplier', () => {
      const rule: AlertRule = {
        id: 'gap-rule',
        multiplier: 10.0, // Different from bet multiplier (5.0)
        type: 'gap',
        config: { threshold: 'p95' },
        enabled: true
      };

      alertEngine.addRule(rule);
      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Threshold Alerts', () => {
    it('should trigger threshold alert when multiplier exceeds target', () => {
      const rule: AlertRule = {
        id: 'threshold-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 4.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      
      expect(alerts).toHaveLength(1);
      expect(alerts[0].type).toBe('threshold');
      expect(alerts[0].message).toContain('5x hit');
    });

    it('should not trigger threshold alert when multiplier is below target', () => {
      const rule: AlertRule = {
        id: 'threshold-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 10.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Cluster Alerts', () => {
    it('should trigger cluster alert when enough hits in window', () => {
      const rule: AlertRule = {
        id: 'cluster-rule',
        multiplier: 5.0,
        type: 'cluster',
        config: {
          windowNonces: 2000,
          windowSeconds: 60,
          minCount: 2,
          minMultiplier: 3.0
        },
        enabled: true
      };

      alertEngine.addRule(rule);
      
      // First bet
      const alerts1 = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts1).toHaveLength(0); // Not enough hits yet
      
      // Second bet within window
      const secondBet = { ...mockBet, id: 2, nonce: 1100 };
      const alerts2 = alertEngine.checkAlerts(secondBet, mockStats);
      expect(alerts2).toHaveLength(1);
      expect(alerts2[0].type).toBe('cluster');
    });

    it('should not trigger cluster alert for low multipliers', () => {
      const rule: AlertRule = {
        id: 'cluster-rule',
        multiplier: 5.0,
        type: 'cluster',
        config: {
          windowNonces: 2000,
          windowSeconds: 60,
          minCount: 1,
          minMultiplier: 10.0 // Higher than bet multiplier
        },
        enabled: true
      };

      alertEngine.addRule(rule);
      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Rate Limiting', () => {
    it('should rate limit alerts for same multiplier', async () => {
      const rule: AlertRule = {
        id: 'threshold-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 4.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      
      // First alert should fire
      const alerts1 = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts1).toHaveLength(1);
      
      // Second alert immediately should be rate limited
      const alerts2 = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts2).toHaveLength(0);
    });

    it('should allow alerts for different multipliers', () => {
      const rule: AlertRule = {
        id: 'threshold-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 4.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      
      // First alert for 5.0x (should trigger)
      const alerts1 = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts1).toHaveLength(1);
      
      // Immediate second alert for same multiplier should be rate limited
      const alerts2 = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts2).toHaveLength(0);
      
      // Alert for different multiplier should work because it's a different multiplier value
      const higherBet = { ...mockBet, payout_multiplier: 8.0 };
      const alerts3 = alertEngine.checkAlerts(higherBet, mockStats);
      expect(alerts3).toHaveLength(1); // Should trigger because 8.0 >= 4.0 and different multiplier
    });
  });

  describe('Disabled Rules', () => {
    it('should not trigger alerts for disabled rules', () => {
      const rule: AlertRule = {
        id: 'disabled-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 4.0 },
        enabled: false
      };

      alertEngine.addRule(rule);
      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('Statistics', () => {
    it('should provide accurate statistics', () => {
      const rule1: AlertRule = {
        id: 'rule1',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 4.0 },
        enabled: true
      };

      const rule2: AlertRule = {
        id: 'rule2',
        multiplier: 10.0,
        type: 'threshold',
        config: { targetMultiplier: 15.0 },
        enabled: false
      };

      alertEngine.addRule(rule1);
      alertEngine.addRule(rule2);
      
      const stats = alertEngine.getStats();
      expect(stats.totalRules).toBe(2);
      expect(stats.enabledRules).toBe(1);
    });
  });

  describe('Clear State', () => {
    it('should clear all alert state', () => {
      const rule: AlertRule = {
        id: 'test-rule',
        multiplier: 5.0,
        type: 'threshold',
        config: { targetMultiplier: 4.0 },
        enabled: true
      };

      alertEngine.addRule(rule);
      alertEngine.checkAlerts(mockBet, mockStats); // Trigger an alert
      
      alertEngine.clear();
      
      // Should be able to trigger same alert again after clear
      const alerts = alertEngine.checkAlerts(mockBet, mockStats);
      expect(alerts).toHaveLength(1);
    });
  });
});