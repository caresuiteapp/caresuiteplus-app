import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { validateCatalogue, summarizeCatalogue, requirementKey } from '../../scripts/lib/gkv-approval-catalogue.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = name => JSON.parse(readFileSync(resolve(root, 'docs/gkv/approval', name), 'utf8'));
const fixture = () => ({ lock: read('source-lock.json'), register: read('kim-register.json'), plan: read('workplan.json') });
const check = f => validateCatalogue(f.lock, f.register, f.plan, p => existsSync(resolve(root, p)));

test('all pinned references, candidate files and complete ITSG case identities remain present', () => {
  const f = fixture(); assert.deepEqual(check(f), []);
  const summary = summarizeCatalogue(f.register, f.plan);
  assert.equal(summary.normativeReferences, 744);
  assert.equal(summary.profileScopedIds, 711);
  assert.equal(summary.itsgCases, 14);
  assert.equal(summary.productionReady, false);
  assert.equal(summary.unresolvedVariantReferences.length, 2);
});
test('same requirement in separate normative sources or proof methods is retained', () => {
  const f = fixture();
  const rows = f.register.profiles.find(p => p.sourceId === 'icm').requirements.filter(r => r.id === 'A_27744');
  assert.equal(rows.length, 2); assert.notEqual(requirementKey('icm', rows[0]), requirementKey('icm', rows[1]));
  assert.deepEqual(check(f), []);
});
test('dropping or duplicating a normative row cannot pass as a full register', () => {
  for (const mutate of [p => p.requirements.pop(), p => p.requirements.push({ ...p.requirements[0] }),
    p => { p.requirements[1] = { ...p.requirements[0] }; }]) {
    const f = fixture(); mutate(f.register.profiles[0]); assert.ok(check(f).length);
  }
});
test('a changed spec version, floating URL or foreign anchor is rejected', () => {
  for (const mutate of [r => { r.version = '0.0.0'; }, r => { r.url = r.url.replace(/_V[^/]+\//, '/latest/'); },
    r => { r.url += '-99'; }, r => { r.url = r.url.replace('gemspec.gematik.de', 'example.org'); }]) {
    const f = fixture(); mutate(f.register.profiles[0].requirements[0]); assert.ok(check(f).length);
  }
});
test('source hashes and profile versions cannot be omitted', () => {
  const f = fixture(); f.lock.sources[0].sha256 = null; assert.ok(check(f).length);
  const g = fixture(); g.register.profiles.pop(); assert.ok(check(g).length);
});
test('missing ITSG cases and unsupported pass claims fail closed', () => {
  for (const mutate of [p => p.itsgCases.pop(), p => { p.itsgCases[0].status = 'passed'; },
    p => { p.productionReady = true; }, p => { p.scopeComplete = true; },
    p => { p.profiles.fd.defaultAssessment = 'verified'; },
    p => { p.legacyEvidence.use = 'accept_without_version_review'; },
    p => p.requirementAssessments.push({ id: 'A_21383', status: 'approved' })]) {
    const f = fixture(); mutate(f.plan); assert.ok(check(f).length);
  }
});
test('missing, traversing and absolute evidence paths cannot be accepted', () => {
  for (const path of ['src/not-existing-proof.ts', 'docs/../../secret', '/tmp/proof', 'docs/%2e%2e/file', 'docs\\proof']) {
    const f = fixture(); f.plan.packages[0].code.push(path); assert.ok(check(f).length);
  }
});
test('unknown package assignments and dependency cycles are reported', () => {
  const f = fixture(); f.plan.specPackages.gemSpec_CM_KOMLE = 'unknown'; assert.ok(check(f).length);
  const g = fixture(); g.plan.packages[0].dependsOn.push('proof-capture'); assert.ok(check(g).some(e => e.includes('cycle')));
});
test('unresolved provider references cannot be silently marked resolved', () => {
  const f = fixture();
  const row = f.register.profiles.find(p => p.sourceId === 'provider').variantReferences.find(v => !v.listedInPrimaryTables);
  row.listedInPrimaryTables = true; assert.ok(check(f).some(e => e.includes('applicability')));
});
