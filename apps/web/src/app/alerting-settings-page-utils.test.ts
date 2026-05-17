import * as assert from 'node:assert/strict';
import {
  ALERTING_TABS,
  buildAlertingSettingsSummary,
  createDefaultAlertingSettingsSnapshot,
  filterAlertRulesByCategory,
  getNextAlertingTab,
  readAlertingSettingsSnapshot,
  serializeAlertingSettingsSnapshot,
  toggleAlertRule,
  validateAlertingSettingsSnapshot,
} from './alerting-settings-page-utils';

const referenceTime = new Date('2026-04-27T12:00:00.000Z');

function testDefaultSnapshotShape(): void {
  const snapshot = createDefaultAlertingSettingsSnapshot(referenceTime);

  assert.equal(snapshot.alertRules.length, 5);
  assert.equal(snapshot.channels.length, 4);
  assert.equal(snapshot.history.length, 3);
  assert.equal(snapshot.lastUpdated, referenceTime.toISOString());

  const summary = buildAlertingSettingsSummary(snapshot);
  assert.equal(summary.totalRules, 5);
  assert.equal(summary.activeRules, 4);
  assert.equal(summary.enabledChannels, 3);
  assert.equal(summary.criticalRules, 2);
  assert.equal(summary.recentHistoryEntries, 3);
}

function testSnapshotPersistenceRoundTrip(): void {
  const snapshot = createDefaultAlertingSettingsSnapshot(referenceTime);
  const serialized = serializeAlertingSettingsSnapshot(snapshot);
  const result = readAlertingSettingsSnapshot(serialized, referenceTime);

  assert.equal(result.status, 'success');
  assert.ok(result.snapshot);
  assert.equal(result.snapshot?.alertRules.length, snapshot.alertRules.length);
  assert.equal(result.snapshot?.channels.length, snapshot.channels.length);
  assert.equal(result.snapshot?.history.length, snapshot.history.length);
}

function testInvalidSnapshotHandling(): void {
  const invalidJson = readAlertingSettingsSnapshot('{ not valid json }', referenceTime);
  assert.equal(invalidJson.status, 'error');
  assert.match(invalidJson.error ?? '', /valid JSON/i);

  const missingChannelData = readAlertingSettingsSnapshot(
    JSON.stringify({
      alertRules: [],
      channels: [],
      history: [],
      lastUpdated: referenceTime.toISOString(),
    }),
    referenceTime,
  );
  assert.equal(missingChannelData.status, 'success');

  const corruptedShape = readAlertingSettingsSnapshot(
    JSON.stringify({
      alertRules: [
        {
          id: 'broken',
          name: 'Broken',
          description: 'Broken',
          category: 'reliability',
          enabled: true,
          severity: 'high',
          condition: 'threshold',
          threshold: 15,
          unit: '%',
          channels: ['email'],
          cooldown: 30,
          tags: ['broken'],
          createdAt: referenceTime.toISOString(),
        },
      ],
      channels: 'invalid',
      history: [],
      lastUpdated: referenceTime.toISOString(),
    }),
    referenceTime,
  );
  assert.equal(corruptedShape.status, 'error');
  assert.match(corruptedShape.error ?? '', /incomplete or outdated/i);
}

function testKeyboardTabNavigation(): void {
  assert.equal(getNextAlertingTab('rules', 'ArrowRight'), 'channels');
  assert.equal(getNextAlertingTab('channels', 'ArrowRight'), 'history');
  assert.equal(getNextAlertingTab('history', 'ArrowRight'), 'rules');
  assert.equal(getNextAlertingTab('rules', 'ArrowLeft'), 'history');
  assert.equal(getNextAlertingTab('channels', 'Home'), 'rules');
  assert.equal(getNextAlertingTab('channels', 'End'), 'history');
  assert.deepEqual(ALERTING_TABS, ['rules', 'channels', 'history']);
}

function testValidationEdgeCases(): void {
  const snapshot = createDefaultAlertingSettingsSnapshot(referenceTime);
  const disabledChannelSnapshot = {
    ...snapshot,
    channels: snapshot.channels.map((channel) => ({
      ...channel,
      enabled: false,
    })),
  };

  assert.equal(
    validateAlertingSettingsSnapshot(disabledChannelSnapshot),
    'Enable at least one notification channel before saving.',
  );

  const disabledRuleSnapshot = toggleAlertRule(snapshot, 'security-violation');
  const savedDisabledRuleSnapshot = {
    ...disabledRuleSnapshot,
    alertRules: disabledRuleSnapshot.alertRules.map((rule) =>
      rule.id === 'security-violation'
        ? { ...rule, threshold: 250 }
        : rule,
    ),
  };

  assert.equal(validateAlertingSettingsSnapshot(savedDisabledRuleSnapshot), null);

  const filteredRules = filterAlertRulesByCategory(
    snapshot.alertRules,
    'security',
  );
  assert.equal(filteredRules.length, 1);
  assert.equal(filteredRules[0].category, 'security');
}

testDefaultSnapshotShape();
testSnapshotPersistenceRoundTrip();
testInvalidSnapshotHandling();
testKeyboardTabNavigation();
testValidationEdgeCases();

console.log('alerting-settings-page-utils.test.ts: all assertions passed');
