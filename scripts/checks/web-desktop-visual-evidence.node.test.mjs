import assert from 'node:assert/strict';
import test from 'node:test';
import { projectWebDesktopVisualEvidence } from '../../src/lib/visualQa/webDesktopVisualEvidence.web.ts';

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const at = (n) => `2026-10-14T23:30:00.${String(n).padStart(6, '0')}Z`;
const sha = (c) => c.repeat(64);
const profiles = ['wide', 'narrow', 'wide_navigation_open', 'narrow_long_text'];
const action = (n, overrides = {}) => ({ actionId: id(10 + n), tenantId: id(1), releaseCandidateId: id(2), route: n ? '/pflege/vitalwerte' : '/pflege/medikamente', labelSha256: sha(String(n + 2)), ...overrides });
const observation = (a, profile, n, overrides = {}) => ({ observationId: id(100 + n), tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), routeSetSha256: sha('b'), actionId: a.actionId, route: a.route, profile, browserEngine: 'chromium', browserVersion: '142.0.7444.2', viewportWidth: profile.startsWith('wide') ? 1440 : 390, viewportHeight: profile.startsWith('wide') ? 900 : 844, deviceScaleFactor: 1, zoomPercent: 200, fontScalePercent: 200, navigationOpen: profile === 'wide_navigation_open', longTextFixtureSha256: profile === 'narrow_long_text' ? sha('f') : null, renderedAt: at(2 + n), screenshotSha256: sha('c'), interactionTraceSha256: sha('d'), visible: true, reachable: true, notClipped: true, notObscured: true, contrastChecked: true, keyboardReachable: true, ...overrides });
const base = (overrides = {}) => { const actions = [action(0), action(1)]; const observations = actions.flatMap((a, ai) => profiles.map((profile, pi) => observation(a, profile, ai * 4 + pi))); return { tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), routeSetSha256: sha('b'), actions, observations, review: { reviewId: id(90), tenantId: id(1), releaseCandidateId: id(2), buildSha256: sha('a'), routeSetSha256: sha('b'), reviewerProfileId: id(91), permissionKey: 'design.browser.review', permissionEvidenceId: id(92), reviewedAt: at(20), decision: 'approved', observationCount: observations.length }, evaluatedAt: at(21), ...overrides }; };

test('complete real-browser profiles bind every mandatory action without inferring acceptance', () => {
  const result = projectWebDesktopVisualEvidence(base());
  assert.equal(result.status, 'browser_evidence_complete');
  assert.equal(result.requiredActionCoverageComplete, true);
  assert.deepEqual([result.designAcceptanceInferred, result.functionalAcceptanceInferred, result.careAcceptanceInferred, result.legalAcceptanceInferred], [false, false, false, false]);
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.actions)); assert.ok(Object.isFrozen(result.observations));
});

test('missing profiles remain incomplete and cannot be approved', () => {
  const b = base(); const observations = b.observations.slice(0, -1);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations, review: { ...b.review, observationCount: observations.length } }), /Unvollstaendige Browserbelege/);
  const result = projectWebDesktopVisualEvidence({ ...b, observations, review: null });
  assert.deepEqual([result.status, result.requiredActionCoverageComplete], ['browser_evidence_incomplete', false]);
});

test('tenant candidate build route set action and route bindings fail closed', () => {
  const b = base();
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, tenantId: id(99) }) }), /nicht exakt/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, buildSha256: sha('e') }) }), /nicht exakt/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, route: '/pflege/wunden' }) }), /nicht exakt/);
});

test('wide narrow navigation and long-text profiles require exact viewport fixtures', () => {
  const b = base();
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, viewportWidth: 800 }) }), /Breites Profil/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o) => o.profile === 'wide_navigation_open' ? { ...o, navigationOpen: false } : o) }), /geoeffneter Navigation/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o) => o.profile === 'narrow_long_text' ? { ...o, longTextFixtureSha256: null } : o) }), /SHA-256/);
});

test('visible reachable unclipped unobscured contrast and keyboard gates must all be true', () => {
  for (const gate of ['visible', 'reachable', 'notClipped', 'notObscured', 'contrastChecked', 'keyboardReachable']) {
    const b = base();
    assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, [gate]: false }) }), new RegExp(gate));
  }
});

test('browser engine version artifacts and scaling are concrete and bounded', () => {
  const b = base();
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, browserEngine: 'jsdom' }) }), /Browserengine/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, browserVersion: 'latest' }) }), /Browserversion/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, zoomPercent: 99 }) }), /Skalierung/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, observations: b.observations.map((o, i) => i ? o : { ...o, screenshotSha256: 'bad' }) }), /Bildsumme/);
});

test('review remains separate permission-bound and causally after every render', () => {
  const b = base();
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, review: { ...b.review, permissionKey: 'design.read' } }), /Pruefberechtigung/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, review: { ...b.review, observationCount: 7 } }), /nicht exakt/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, review: { ...b.review, reviewedAt: at(1) } }), /kausalen/);
});

test('native identities exact shapes own values unique actions and valid times are required', () => {
  const b = base();
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, releaseCandidateId: 'candidate' }), /native UUID/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, extra: true }), /nicht erlaubte Felder/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, actions: [b.actions[0], { ...b.actions[1], actionId: b.actions[0].actionId }] }), /doppelte Kennungen/);
  const getter = { ...b }; Object.defineProperty(getter, 'buildSha256', { enumerable: true, get: () => sha('a') });
  assert.throws(() => projectWebDesktopVisualEvidence(getter), /Originalwert/);
  assert.throws(() => projectWebDesktopVisualEvidence({ ...b, evaluatedAt: '2026-02-30T00:00:00.000001Z' }), /Kalenderdatum/);
});
