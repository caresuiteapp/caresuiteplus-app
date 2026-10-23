// Planning integrity only. This module cannot grant a software or TI approval.
const hash = /^[a-f0-9]{64}$/;
const unique = values => new Set(values).size === values.length;
export const requirementKey = (profileId, row) => `${profileId}:${row.section}:${row.spec}:${row.id}`;
export const ITSG_CASES = ['3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8','3.9','3.10','3.11','4.1','4.2','5.1'];

export function validateCatalogue(lock, register, plan, exists = () => true) {
  const errors = [];
  const require = (condition, message) => { if (!condition) errors.push(message); };
  require([lock, register, plan].every(x => x?.schemaVersion === 1), 'Unsupported catalogue schema');
  if (!Array.isArray(lock?.sources) || !Array.isArray(register?.profiles) || !Array.isArray(plan?.packages)
      || !Array.isArray(plan?.itsgCases) || !Array.isArray(plan?.requirementAssessments)) return ['Missing catalogue arrays'];
  require(plan.productionReady === false && plan.scopeComplete === false, 'This planning baseline cannot declare readiness or complete normative coverage');
  require(/^[a-f0-9]{40}$/.test(plan.baselineCommit), 'A full implementation baseline commit is required');
  require(Array.isArray(plan.scopeGaps) && plan.scopeGaps.length > 0, 'Unresolved scope gaps must remain visible');
  require(unique(lock.sources.map(s => s.id)), 'Duplicate source ID');
  const sources = new Map(lock.sources.map(s => [s.id, s]));
  for (const source of lock.sources) {
    let url; try { url = new URL(source.url); } catch { errors.push(`Invalid source URL: ${source.id}`); continue; }
    require(url.protocol === 'https:' && ['gemspec.gematik.de','fachportal.gematik.de','www.gkv-datenaustausch.de'].includes(url.hostname)
      && !url.username && !url.password, `Untrusted source origin: ${source.id}`);
    require(hash.test(source.sha256) && typeof source.version === 'string' && source.version.length > 0, `Unpinned source: ${source.id}`);
    require(!url.pathname.includes('/latest/'), `Floating source version: ${source.id}`);
  }
  require(unique(plan.packages.map(p => p.id)), 'Duplicate work package');
  const packages = new Map(plan.packages.map(p => [p.id, p]));
  const pathOkay = path => typeof path === 'string' && /^(src|api|services|tests|docs|supabase)\//.test(path)
    && !/[\\\x00-\x20%?#]/.test(path) && !path.split('/').some(x => !x || x === '.' || x === '..');
  for (const p of plan.packages) {
    require(Number.isInteger(p.priority) && p.priority >= 0 && p.priority <= 4, `Invalid priority: ${p.id}`);
    require(['open','partial'].includes(p.implementation) && p.verification === 'open', `Unsupported acceptance claim: ${p.id}`);
    require(p.owner && p.title && p.nextStep && p.acceptance, `Incomplete work package: ${p.id}`);
    require(p.sources?.length && p.sources.every(id => sources.has(id)), `Unknown work package source: ${p.id}`);
    require(p.dependsOn?.every(id => packages.has(id)), `Unknown dependency: ${p.id}`);
    require(Array.isArray(p.evidence) && p.evidence.length === 0, `This baseline has no external acceptance evidence: ${p.id}`);
    for (const path of [...p.code, ...p.tests]) require(pathOkay(path) && exists(path), `Missing or unsafe candidate evidence: ${path}`);
  }
  const visited = new Set(), active = new Set();
  function visit(id) {
    if (active.has(id)) { errors.push(`Dependency cycle: ${id}`); return; }
    if (visited.has(id) || !packages.has(id)) return;
    active.add(id); for (const next of packages.get(id).dependsOn ?? []) visit(next);
    active.delete(id); visited.add(id);
  }
  for (const p of plan.packages) visit(p.id);
  require(unique(register.profiles.map(p => p.sourceId)), 'Duplicate profile');
  const expectedProfiles = lock.sources.filter(s => s.kind === 'gematik_profile').map(s => s.id).sort();
  require(JSON.stringify(register.profiles.map(p => p.sourceId).sort()) === JSON.stringify(expectedProfiles), 'Missing or extra profile');
  const keys = new Set();
  for (const profile of register.profiles) {
    const source = sources.get(profile.sourceId);
    require(source?.kind === 'gematik_profile', `Unknown profile source: ${profile.sourceId}`);
    require(plan.profiles?.[profile.sourceId]?.defaultAssessment === 'unassessed', `Default acceptance is prohibited: ${profile.sourceId}`);
    require(profile.requirements.length === source?.expectedOccurrences, `Requirement count changed: ${profile.sourceId}`);
    require(new Set(profile.requirements.map(r => r.id)).size === source?.expectedUniqueIds, `Unique ID count changed: ${profile.sourceId}`);
    for (const r of profile.requirements) {
      const key = requirementKey(profile.sourceId, r);
      require(!keys.has(key), `Duplicate normative reference: ${key}`); keys.add(key);
      require(/^(?:[A-Z0-9]+-)*A_\d+(?:-\d+)?$/.test(r.id) && /^3\.\d+(?:\.\d+)?$/.test(r.section), `Invalid requirement identity: ${key}`);
      require(['MUSS','SOLL','KANN','DARF NICHT'].includes(r.level), `Missing obligation level: ${key}`);
      require(packages.has(plan.specPackages?.[r.spec]), `Unassigned specification: ${r.spec}`);
      let url; try { url = new URL(r.url); } catch { errors.push(`Invalid normative URL: ${key}`); continue; }
      require(url.origin === 'https://gemspec.gematik.de' && !url.username && !url.password && url.hash === `#${r.id}`
        && r.version === profile.documentVersions[r.spec] && url.pathname.includes(`/${r.spec}_V${r.version}/`), `Normative version/reference mismatch: ${key}`);
    }
    for (const v of profile.variantReferences) require(v.listedInPrimaryTables === profile.requirements.some(r => r.id === v.id), `Hidden applicability gap: ${v.id}`);
  }
  require(plan.requirementAssessments.length === 0, 'Individual normative acceptance is not supported by this unreviewed baseline');
  require(unique(plan.itsgCases.map(c => c.section)) && JSON.stringify(plan.itsgCases.map(c => c.section).sort()) === JSON.stringify([...ITSG_CASES].sort()), 'ITSG catalogue coverage changed');
  for (const c of plan.itsgCases) require(c.sourceId === 'itsg-catalog' && packages.has(c.packageId)
    && c.status === 'not_executed' && c.evidence.length === 0 && ['required','requires_review'].includes(c.applicability), `Unsubstantiated ITSG result: ${c.id}`);
  require(plan.legacyEvidence?.use === 'candidate_only_requires_version_review', 'Historical evidence must not become current acceptance');
  require(pathOkay(plan.legacyEvidence?.path) && exists(plan.legacyEvidence.path), 'Missing historical evidence inventory');
  return errors;
}

export function summarizeCatalogue(register, plan) {
  return {
    normativeReferences: register.profiles.reduce((n, p) => n + p.requirements.length, 0),
    profileScopedIds: register.profiles.reduce((n, p) => n + new Set(p.requirements.map(r => r.id)).size, 0),
    itsgCases: plan.itsgCases.length,
    workPackages: plan.packages.length,
    unresolvedVariantReferences: register.profiles.flatMap(p => p.variantReferences.filter(v => !v.listedInPrimaryTables).map(v => ({profile: p.sourceId, ...v}))),
    submissionDossierComplete: false,
    productionReady: false,
  };
}
