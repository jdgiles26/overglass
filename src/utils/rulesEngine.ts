/* ─── Rules Engine ─── */
import type { AlertRule, AlertRuleAction, TimelineEvent, IngestionPoint, ThreatIndicator } from '../types';

/* Condition field values from connector state */
export function getFieldValue(
  field: AlertRuleCondition['field'],
  connector?: IngestionPoint,
  threatMatch?: boolean,
  screenshotChanged?: boolean,
): string | number | boolean {
  switch (field) {
    case 'connector.status':
      return connector?.status ?? '';
    case 'connector.httpStatus':
      return connector?.httpStatus ?? 0;
    case 'connector.latency':
      return connector?.responseTime ?? connector?.metrics.latency ?? 0;
    case 'connector.errorRate':
      return connector?.errorRate ?? 0;
    case 'threat.match':
      return threatMatch ?? false;
    case 'screenshot.changed':
      return screenshotChanged ?? false;
    case 'schedule':
      return new Date().toISOString();
    default:
      return '';
  }
}

export type AlertRuleCondition = {
  field: 'connector.status' | 'connector.httpStatus' | 'connector.latency' | 'connector.errorRate' | 'threat.match' | 'screenshot.changed' | 'schedule';
  operator: 'equals' | 'not_equals' | 'gt' | 'lt' | 'contains' | 'changes' | 'cron';
  value: string | number;
};

/* Evaluate a single condition */
function evaluateCondition(
  condition: AlertRuleCondition,
  actualValue: string | number | boolean,
  previousValue?: string | number | boolean,
): boolean {
  const { operator, value } = condition;
  const actual = typeof actualValue === 'string' ? actualValue.toLowerCase() : actualValue;
  const expected = typeof value === 'string' ? value.toLowerCase() : value;

  switch (operator) {
    case 'equals':
      return actual === expected;
    case 'not_equals':
      return actual !== expected;
    case 'gt':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected;
    case 'lt':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected;
    case 'contains':
      return typeof actual === 'string' && typeof expected === 'string' && actual.includes(expected);
    case 'changes':
      if (previousValue === undefined) return false;
      return actual !== previousValue;
    case 'cron':
      // Simple cron check — compare minute/hour of day
      if (typeof expected !== 'string') return false;
      const now = new Date();
      const parts = expected.split(' ');
      if (parts.length >= 2) {
        const minuteMatch = parts[0] === '*' || parseInt(parts[0]) === now.getMinutes();
        const hourMatch = parts[1] === '*' || parseInt(parts[1]) === now.getHours();
        return minuteMatch && hourMatch;
      }
      return false;
    default:
      return false;
  }
}

/* Evaluate all conditions for a rule (AND logic) */
export function evaluateRule(
  rule: AlertRule,
  context: {
    connector?: IngestionPoint;
    threatMatch?: boolean;
    screenshotChanged?: boolean;
    previousValues?: Record<string, string | number | boolean>;
  },
): boolean {
  if (!rule.enabled) return false;

  // Check cooldown
  if (rule.lastTriggered) {
    const elapsed = (Date.now() - new Date(rule.lastTriggered).getTime()) / 1000;
    if (elapsed < rule.cooldown) return false;
  }

  return rule.conditions.every(condition => {
    const actual = getFieldValue(condition.field, context.connector, context.threatMatch, context.screenshotChanged);
    const previous = context.previousValues?.[condition.field];
    return evaluateCondition(condition, actual, previous);
  });
}

/* Execute rule actions */
export async function executeRuleActions(
  actions: AlertRuleAction[],
  ruleName: string,
  eventDescription: string,
): Promise<string[]> {
  const results: string[] = [];

  for (const action of actions) {
    try {
      switch (action.type) {
        case 'browser_notification':
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`OverGlass Rule: ${ruleName}`, {
              body: eventDescription,
              icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
            });
            results.push('notification_sent');
          } else if ('Notification' in window) {
            const perm = await Notification.requestPermission();
            if (perm === 'granted') {
              new Notification(`OverGlass Rule: ${ruleName}`, {
                body: eventDescription,
              });
              results.push('notification_sent');
            } else {
              results.push('notification_denied');
            }
          } else {
            results.push('notification_unavailable');
          }
          break;

        case 'webhook': {
          const url = action.config.url;
          if (!url) { results.push('webhook_no_url'); break; }
          try {
            await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                rule: ruleName,
                description: eventDescription,
                timestamp: new Date().toISOString(),
              }),
              signal: AbortSignal.timeout(5000),
            });
            results.push('webhook_sent');
          } catch {
            results.push('webhook_failed');
          }
          break;
        }

        case 'sound': {
          try {
            const ctx = new AudioContext();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = parseInt(action.config.frequency ?? '800') || 800;
            gain.gain.value = 0.3;
            osc.start();
            osc.stop(ctx.currentTime + 0.3);
            results.push('sound_played');
          } catch {
            results.push('sound_failed');
          }
          break;
        }

        case 'log':
          console.log(`[OverGlass Rule] ${ruleName}: ${eventDescription}`);
          results.push('logged');
          break;
      }
    } catch (err) {
      results.push(`error: ${String(err)}`);
    }
  }

  return results;
}
