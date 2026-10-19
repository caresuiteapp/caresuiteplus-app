import assert from 'node:assert/strict';
import test from 'node:test';
import { projectWebDesktopAccessibilityEvidence } from '../../src/lib/accessibility/webDesktopAccessibilityEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-15T00:10:00.${String(n).padStart(6, '0')}Z`;
const sha = (c) => c.repeat(64);
const profiles = ['keyboard_default', 'zoom_200', 'reflow_320', 'screen_reader'];
const action = (n, overrides = {}) => ({ actionId: id(10 + n), tenantId: id(1), releaseCandidateId: id(2), route: n ? '/pflege/vitalwerte' : '/pflege/medikamente', requiredFieldSetSha256: sha(String(n + 2)), ...overrides });
const observation = (a, profile, n, overrides = {}) => ({
  observationId: id(100 + n), tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), actionInventorySha256: sha('b'),
  actionId: a.actionId, route: a.route, requiredFieldSetSha256: a.requiredFieldSetSha256, profile, browserEngine: 'chromium',
  browserVersion: '142.0.7444.2', viewportWidth: profile === 'reflow_320' ? 320 : 1440, viewportHeight: 900,
  zoomPercent: profile === 'zoom_200' ? 200 : 100, assistiveTechnology: profile === 'screen_reader' ? 'NVDA' : null,
  assistiveTechnologyVersion: profile === 'screen_reader' ? '2026.2' : null, observedAt: at(2 + n),
  keyboardTraceSha256: sha('c'), accessibilityTreeSha256: sha('d'), speechTranscriptSha256: profile === 'screen_reader' ? sha('e') : null,
  screenshotSha256: sha('f'), focusOrderComplete: true, focusVisible: true, noKeyboardTrap: true,
  accessibleNameRoleStateComplete: true, errorsProgrammaticallyAssociated: true, errorsAnnounced: true,
  requiredFieldsReachable: true, requiredFieldsNotClipped: true, reflowWithoutTwoDimensionalScrolling: true, ...overrides,
});
const base = (overrides = {}) => {
  const actions = [action(0), action(1)];
  const observations = actions.flatMap((a, ai) => profiles.map((profile, pi) => observation(a, profile, ai * 4 + pi)));
  return { tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), actionInventorySha256: sha('b'), actions, observations,
    review: { reviewId: id(90), tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), actionInventorySha256: sha('b'),
      reviewerProfileId: id(91), permissionKey: 'accessibility.browser.review', permissionEvidenceId: id(92), reviewedAt: at(20),
      decision: 'approved', observationCount: observations.length }, evaluatedAt: at(21), ...overrides };
};

test('all four profiles cover every mandatory action without inferring acceptance', () => {
  const result = projectWebDesktopAccessibilityEvidence(base());
  assert.equal(result.status, 'accessibility_evidence_complete');
  assert.equal(result.requiredActionCoverageComplete, true);
  assert.deepEqual([result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.designAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false]);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.actions)); assert.ok(Object.isFrozen(result.observations));
});

test('missing action profile remains incomplete and cannot be approved', () => {
  const b = base(); const observations = b.observations.slice(0, -1);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations, review: { ...b.review, observationCount: observations.length } }), /Unvollstaendige/);
  assert.deepEqual(projectWebDesktopAccessibilityEvidence({ ...b, observations, review: null }).status, 'accessibility_evidence_incomplete');
});

test('tenant candidate build inventory route and required fields bind fail closed', () => {
  for (const change of [{ tenantId: id(99) }, { buildSha256: sha('9') }, { actionInventorySha256: sha('8') }, { route: '/pflege/wunden' }, { requiredFieldSetSha256: sha('7') }]) {
    const b = base();
    assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, ...change }) }), /nicht exakt/);
  }
});

test('keyboard zoom and 320 pixel reflow profiles enforce their concrete geometry', () => {
  const b = base();
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, viewportWidth: 800 }) }), /Tastaturprofil/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o) => o.profile === 'zoom_200' ? { ...o, zoomPercent: 175 } : o) }), /Zoomprofil/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o) => o.profile === 'reflow_320' ? { ...o, viewportWidth: 321 } : o) }), /Reflowprofil/);
});

test('every keyboard focus semantics error field clipping and reflow gate is mandatory', () => {
  for (const gate of ['focusOrderComplete', 'focusVisible', 'noKeyboardTrap', 'accessibleNameRoleStateComplete', 'errorsProgrammaticallyAssociated', 'errorsAnnounced', 'requiredFieldsReachable', 'requiredFieldsNotClipped', 'reflowWithoutTwoDimensionalScrolling']) {
    const b = base();
    assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, [gate]: false }) }), new RegExp(gate));
  }
});

test('screen reader profile requires named versioned technology and bound speech trace', () => {
  const b = base();
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o) => o.profile === 'screen_reader' ? { ...o, assistiveTechnology: null } : o) }), /Screenreaderprofil/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o) => o.profile === 'keyboard_default' ? { ...o, assistiveTechnology: 'NVDA' } : o) }), /Nicht-Screenreaderprofil/);
});

test('independent review permission count decision and microsecond order fail closed', () => {
  const b = base();
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, review: { ...b.review, permissionKey: 'design.browser.review' } }), /Pruefberechtigung/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, review: { ...b.review, observationCount: 7 } }), /Pruefberechtigung/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, review: { ...b.review, reviewedAt: at(1) } }), /kausalen Ereignisfolge/);
  assert.equal(projectWebDesktopAccessibilityEvidence({ ...b, review: { ...b.review, decision: 'rejected' } }).status, 'independent_accessibility_review_required');
});

test('native identities exact shapes own values hashes and duplicate keys are enforced', () => {
  const b = base();
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, tenantId: 'tenant-1' }), /native UUID/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, extra: true }), /nicht erlaubte/);
  const inherited = Object.create({ buildSha256: sha('a') }); Object.assign(inherited, b); delete inherited.buildSha256;
  assert.throws(() => projectWebDesktopAccessibilityEvidence(inherited), /Originaldatensatz/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, keyboardTraceSha256: 'nope' }) }), /SHA-256/);
  assert.throws(() => projectWebDesktopAccessibilityEvidence({ ...b, observations: [...b.observations, { ...b.observations[0], observationId: id(999) }] }), /doppeltes Aktionsprofil/);
});
