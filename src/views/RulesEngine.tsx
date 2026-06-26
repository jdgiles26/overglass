/* ─── Alert Rules Engine ─── */
import { useState, useCallback } from 'react';
import { v4 as uuid } from 'uuid';
import { useAppStore } from '../store';
import type { AlertRule, AlertRuleCondition, AlertRuleAction } from '../types';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MetricCard } from '../components/MetricCard';

const CONDITION_FIELDS: { value: AlertRuleCondition['field']; label: string }[] = [
  { value: 'connector.status', label: 'Connector Status' },
  { value: 'connector.httpStatus', label: 'HTTP Status Code' },
  { value: 'connector.latency', label: 'Latency (ms)' },
  { value: 'connector.errorRate', label: 'Error Rate (%)' },
  { value: 'threat.match', label: 'Threat Intel Match' },
  { value: 'screenshot.changed', label: 'Screenshot Changed' },
  { value: 'schedule', label: 'Schedule (cron)' },
];

const OPERATORS: { value: AlertRuleCondition['operator']; label: string }[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Not equals' },
  { value: 'gt', label: 'Greater than' },
  { value: 'lt', label: 'Less than' },
  { value: 'contains', label: 'Contains' },
  { value: 'changes', label: 'Changes from' },
  { value: 'cron', label: 'Cron match' },
];

const ACTION_TYPES: { value: AlertRuleAction['type']; label: string; icon: string }[] = [
  { value: 'browser_notification', label: 'Browser Notification', icon: '🔔' },
  { value: 'webhook', label: 'Webhook POST', icon: '🌐' },
  { value: 'sound', label: 'Sound Alert', icon: '🔊' },
  { value: 'log', label: 'Log Only', icon: '📝' },
];

function RuleCard({ rule, onToggle, onDelete, onTest }: {
  rule: AlertRule;
  onToggle: () => void;
  onDelete: () => void;
  onTest: () => void;
}) {
  return (
    <div className={`bg-surface-900/30 border rounded-xl p-4 ${rule.enabled ? 'border-surface-800' : 'border-surface-800/50 opacity-60'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold">{rule.name}</h3>
          <span className={`px-2 py-0.5 text-[10px] rounded-full ${rule.enabled ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
            {rule.enabled ? 'ENABLED' : 'DISABLED'}
          </span>
          {rule.lastTriggered && (
            <span className="text-[10px] text-gray-500">
              Last: {new Date(rule.lastTriggered).toLocaleTimeString()}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onTest} className="px-2 py-1 text-xs text-brand-400 hover:bg-brand-500/10 rounded">Test</button>
          <button onClick={onToggle} className="px-2 py-1 text-xs text-yellow-400 hover:bg-yellow-500/10 rounded">
            {rule.enabled ? 'Disable' : 'Enable'}
          </button>
          <button onClick={onDelete} className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded">Delete</button>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-1 mb-3">
        <div className="text-xs text-gray-500 mb-1">Conditions (AND):</div>
        {rule.conditions.map((c, i) => (
          <div key={i} className="flex items-center gap-2 text-xs bg-surface-800/50 rounded px-2 py-1">
            <span className="text-brand-400 font-mono">{c.field}</span>
            <span className="text-gray-500">{c.operator}</span>
            <span className="text-green-400 font-mono">{String(c.value)}</span>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500 mb-1">Actions:</div>
        <div className="flex gap-2 flex-wrap">
          {rule.actions.map((a, i) => (
            <span key={i} className="px-2 py-0.5 text-[10px] bg-surface-800 rounded-full text-gray-400">
              {ACTION_TYPES.find(at => at.value === a.type)?.icon} {a.type}
              {a.config.url && <span className="text-gray-600 ml-1">→ {a.config.url}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Cooldown */}
      <div className="text-[10px] text-gray-600 mt-2">
        Cooldown: {rule.cooldown}s · Created: {new Date(rule.createdAt).toLocaleDateString()}
      </div>
    </div>
  );
}

const emptyCondition = (): AlertRuleCondition => ({
  field: 'connector.status',
  operator: 'equals',
  value: '',
});

const emptyAction = (): AlertRuleAction => ({
  type: 'log',
  config: {},
});

export function RulesEngineView() {
  const rules = useAppStore(s => s.rules);
  const addRule = useAppStore(s => s.addRule);
  const updateRule = useAppStore(s => s.updateRule);
  const removeRule = useAppStore(s => s.removeRule);
  const addTimelineEvent = useAppStore(s => s.addTimelineEvent);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [conditions, setConditions] = useState<AlertRuleCondition[]>([emptyCondition()]);
  const [actions, setActions] = useState<AlertRuleAction[]>([emptyAction()]);
  const [cooldown, setCooldown] = useState(60);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [soundFreq, setSoundFreq] = useState('800');

  const resetForm = useCallback(() => {
    setName('');
    setConditions([emptyCondition()]);
    setActions([emptyAction()]);
    setCooldown(60);
    setWebhookUrl('');
    setSoundFreq('800');
    setEditingId(null);
    setShowForm(false);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!name.trim() || conditions.length === 0 || actions.length === 0) return;

    // Apply config to actions
    const finalActions = actions.map(a => {
      if (a.type === 'webhook') return { ...a, config: { url: webhookUrl } };
      if (a.type === 'sound') return { ...a, config: { frequency: soundFreq } };
      return a;
    });

    const rule: AlertRule = {
      id: editingId || uuid(),
      name: name.trim(),
      enabled: true,
      conditions,
      actions: finalActions,
      cooldown,
      createdAt: new Date().toISOString(),
    };

    if (editingId) {
      updateRule(editingId, rule);
    } else {
      addRule(rule);
      // Log
      const { createEvent } = require('../utils/timeline');
      addTimelineEvent(createEvent(
        'rule.triggered',
        `Rule created: ${rule.name}`,
        `${rule.conditions.length} conditions, ${rule.actions.length} actions`,
        { severity: 'info' },
      ));
    }

    resetForm();
  }, [name, conditions, actions, cooldown, webhookUrl, soundFreq, editingId, addRule, updateRule, addTimelineEvent, resetForm]);

  const handleTest = useCallback(async (rule: AlertRule) => {
    const { executeRuleActions } = await import('../utils/rulesEngine');
    const results = await executeRuleActions(rule.actions, `[TEST] ${rule.name}`, 'This is a test alert from OverGlass Rules Engine.');
    alert(`Rule test results:\n${results.join('\n')}`);
  }, []);

  const addCondition = () => setConditions(c => [...c, emptyCondition()]);
  const removeCondition = (i: number) => setConditions(c => c.filter((_, idx) => idx !== i));
  const updateCondition = (i: number, updates: Partial<AlertRuleCondition>) =>
    setConditions(c => c.map((cond, idx) => idx === i ? { ...cond, ...updates } : cond));

  const addAction = () => setActions(a => [...a, emptyAction()]);
  const removeAction = (i: number) => setActions(a => a.filter((_, idx) => idx !== i));
  const updateAction = (i: number, updates: Partial<AlertRuleAction>) =>
    setActions(a => a.map((act, idx) => idx === i ? { ...act, ...updates } : act));

  const enabledCount = rules.filter(r => r.enabled).length;
  const totalTriggers = rules.filter(r => r.lastTriggered).length;

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">⚡ Rules Engine</h1>
          <p className="text-xs text-gray-500 mt-1">Automated alert rules — "when X happens, do Y"</p>
        </div>
        <button
          onClick={() => { if (showForm) resetForm(); else setShowForm(true); }}
          className="px-4 py-2 bg-brand-500/20 text-brand-400 rounded-lg hover:bg-brand-500/30 text-sm"
        >
          {showForm ? 'Cancel' : '+ New Rule'}
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Rules" value={rules.length} />
        <MetricCard label="Enabled" value={enabledCount} />
        <MetricCard label="Triggered" value={totalTriggers} />
        <MetricCard label="Conditions" value={rules.reduce((sum, r) => sum + r.conditions.length, 0)} />
      </div>

      {/* Rule form */}
      {showForm && (
        <ErrorBoundary>
          <div className="bg-surface-900/30 border border-surface-800 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-lg">{editingId ? 'Edit Rule' : 'Create New Rule'}</h2>

            <div>
              <label className="block text-xs text-gray-500 mb-1">Rule Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                placeholder="e.g. Alert when connector goes offline"
              />
            </div>

            {/* Conditions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Conditions (all must match)</label>
                <button onClick={addCondition} className="text-xs text-brand-400 hover:text-brand-300">+ Add condition</button>
              </div>
              <div className="space-y-2">
                {conditions.map((c, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={c.field}
                      onChange={e => updateCondition(i, { field: e.target.value as AlertRuleCondition['field'] })}
                      className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {CONDITION_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                    <select
                      value={c.operator}
                      onChange={e => updateCondition(i, { operator: e.target.value as AlertRuleCondition['operator'] })}
                      className="w-28 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input
                      type="text"
                      value={String(c.value)}
                      onChange={e => updateCondition(i, { value: c.field === 'connector.latency' || c.field === 'connector.httpStatus' || c.field === 'connector.errorRate' ? Number(e.target.value) : e.target.value })}
                      className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs"
                      placeholder={c.operator === 'cron' ? '0 9 * * 1-5' : 'value'}
                    />
                    {conditions.length > 1 && (
                      <button onClick={() => removeCondition(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-500">Actions</label>
                <button onClick={addAction} className="text-xs text-brand-400 hover:text-brand-300">+ Add action</button>
              </div>
              <div className="space-y-2">
                {actions.map((a, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <select
                      value={a.type}
                      onChange={e => updateAction(i, { type: e.target.value as AlertRuleAction['type'] })}
                      className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs"
                    >
                      {ACTION_TYPES.map(at => <option key={at.value} value={at.value}>{at.icon} {at.label}</option>)}
                    </select>
                    {a.type === 'webhook' && (
                      <input
                        type="text"
                        value={webhookUrl}
                        onChange={e => setWebhookUrl(e.target.value)}
                        className="flex-1 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs"
                        placeholder="https://hooks.example.com/..."
                      />
                    )}
                    {a.type === 'sound' && (
                      <input
                        type="text"
                        value={soundFreq}
                        onChange={e => setSoundFreq(e.target.value)}
                        className="w-20 bg-surface-800 border border-surface-700 rounded-lg px-2 py-1.5 text-xs"
                        placeholder="Hz"
                      />
                    )}
                    {actions.length > 1 && (
                      <button onClick={() => removeAction(i)} className="text-red-400 hover:text-red-300 text-xs px-1">✕</button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Cooldown */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">Cooldown (seconds between triggers)</label>
              <input
                type="number"
                value={cooldown}
                onChange={e => setCooldown(Number(e.target.value))}
                className="w-32 bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm"
                min="0"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSubmit} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 text-sm">
                {editingId ? 'Update Rule' : 'Create Rule'}
              </button>
              <button onClick={resetForm} className="px-4 py-2 bg-surface-800 text-gray-400 rounded-lg hover:bg-surface-700 text-sm">
                Cancel
              </button>
            </div>
          </div>
        </ErrorBoundary>
      )}

      {/* Rule list */}
      <div className="space-y-3">
        {rules.length === 0 && !showForm && (
          <div className="text-center text-gray-500 py-12">
            <div className="text-4xl mb-4">⚡</div>
            <p>No rules configured</p>
            <p className="text-sm text-gray-600 mt-1">Create rules to automate alerts based on connector states, threat matches, or schedules.</p>
          </div>
        )}
        {rules.map(rule => (
          <RuleCard
            key={rule.id}
            rule={rule}
            onToggle={() => updateRule(rule.id, { enabled: !rule.enabled })}
            onDelete={() => { if (confirm(`Delete rule "${rule.name}"?`)) removeRule(rule.id); }}
            onTest={() => handleTest(rule)}
          />
        ))}
      </div>
    </div>
  );
}
