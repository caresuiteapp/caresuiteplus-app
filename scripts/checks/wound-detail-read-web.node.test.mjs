import {isKnownWoundEditorRole} from '../../src/lib/pflege/woundEditorRequestGuard.web.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { woundUuid } from '../../src/lib/pflege/woundCareDomain.ts';
import { captureWoundComparisonOriginals, sameWoundComparisonOriginal } from '../../src/lib/pflege/woundAssessmentComparison.web.ts';
const id = n => `11111111-1111-4111-8111-${String(n).padStart(12, '0')}`;
const tenant = id(1), client = id(2), wound = id(3), actor = id(4);
const source = () => ({ row: { id: wound, tenant_id: tenant, client_id: client, status: 'active', created_at: '2026-10-08T10:00:00.123456Z', updated_at: '2026-10-09T10:00:00.123457Z', recorded_by: actor, recorded_by_name: 'Pflegekraft', body_location: 'Linker Unterschenkel' }, clientName: 'Erika Mustermann',
  assessments: [10, 11].map(n => ({ id: id(n), tenant_id: tenant, client_id: client, wound_case_id: wound, created_at: '2026-10-08T10:00:00.123456Z', observed_at: '2026-10-08T09:00:00.123457Z', recorded_by: actor, recorded_by_name: 'Pflegekraft', length_cm: 0, documentation_details: { original: ['  Rohtext  ', false] } })), lifecycle: [], corrections: [] });
const screen = readFileSync(new URL('../../src/screens/pflege/WoundDocumentationDetailScreen.web.tsx', import.meta.url), 'utf8');
const marker = 'function WoundDocumentationWorkspace(){', start = screen.indexOf(marker) + marker.length;
const prefix = stripTypeScriptTypes(screen.slice(start, screen.indexOf(' if(activeEditor){', start)));
// Replace JSX returns with component-name sentinels while executing the actual branch conditions.
const branch = screen.slice(screen.indexOf(' if(activeEditor){',start),screen.indexOf(" if(!permissions.can('pflege.wounds.view'))",start));
const expression = branch.match(/const editor=([^\n]+);/)[1].replace(/<(TreatmentCorrectionScreen|WoundAssessmentCorrectionScreen|WoundCareScreen|WoundLifecycleScreen)[^\n]*?\/>/g,(_,name)=>JSON.stringify(name));
const branchSource=`if(activeEditor)return ${expression};if(!nativeRead)return "denied";`;
const makeWorkspace = new Function('useEffect', 'useRef', 'useState', 'useLocalSearchParams', 'useServiceTenantId', 'useAuth', 'usePermissions', 'useRouter', 'useStyles', 'useAsyncQuery', 'fetchWoundWithCorrections', 'woundUuid', 'captureWoundComparisonOriginals', 'sameWoundComparisonOriginal','isKnownWoundEditorRole', `${prefix}\nreturn {readComparisonContext,currentDetail,refreshDetail,openDetailEditor,closeDetailEditor,activeEditor,nativeRead,editorBranch(){${branchSource};return null;}};`);
// Source-extracted caller logic with local hook/query adapters. This is not a React, browser, layout or database execution.
function workspace() {
  const slots = [], cleanups = [], routes = [];
  let index = 0, reads = 0, refreshes = 0;
  const env = { tenant, wound, profile: { id: actor, tenantId: tenant, roleKey: 'business_admin' }, runtimeTenant: tenant, role: 'business_admin', rights: { 'pflege.wounds.view': true, 'pflege.wounds.manage': true, 'pflege.orders.view': true, 'pflege.treatment.view': true, 'pflege.treatment.manage': true }, data: null, original: source(), flags: { loading: false, refreshing: false, error: null, refreshError: null, previewData: false, tableMissing: false, cacheMeta: { fromCache: false } } };
  function useRef(value) { const i = index++; return slots[i] ??= { current: value }; }
  function useState(value) { const i = index++; if (!(i in slots)) slots[i] = value; return [slots[i], v => { slots[i] = typeof v === 'function' ? v(slots[i]) : v; }]; }
  function useEffect(fn) { const i = index++; if (!(i in slots)) { slots[i] = true; cleanups.push(fn()); } }
  function render() {
    index = 0;
    return makeWorkspace(useEffect, useRef, useState, () => ({ id: env.wound }), () => env.tenant, () => ({ profile: env.profile }),
      () => ({ tenantId: env.runtimeTenant, roleKey: env.role, can: key => env.rights[key] === true }), () => ({ push: route => routes.push(route) }), () => ({}),
      () => ({ data: env.data, ...env.flags, refresh: () => { refreshes++; return Promise.resolve(); } }), async () => { reads++; return { ok: true, data: structuredClone(env.original) }; },
      woundUuid, captureWoundComparisonOriginals, sameWoundComparisonOriginal,isKnownWoundEditorRole);
  }
  async function read() { const result = await render().readComparisonContext(); if (result.ok) env.data = result.data; return result; }
  return { env, routes, render, read, dispose: () => cleanups.forEach(fn => fn?.()), get reads() { return reads; }, get refreshes() { return refreshes; } };
}
async function ready() { const w = workspace(); assert.equal((await w.read()).ok, true); assert.ok(w.render().currentDetail()); return w; }
test('Die echte Detailaktion öffnet ausschließlich das eigene Assessment', async () => {
  const w = await ready(), r = w.render(); r.openDetailEditor('assessment_correction', id(99)); assert.equal(w.render().activeEditor, null);
  r.openDetailEditor('assessment_correction', id(10)); assert.equal(w.render().activeEditor, `assessment:${id(10)}`);
});
test('Aktualisieren sperrt alle alten Detailöffnungen unmittelbar vor dem Rerender', async () => {
  const w = await ready(), r = w.render(); r.refreshDetail(); assert.equal(w.refreshes, 1); assert.equal(r.currentDetail(), null);
  for (const kind of ['assessment', 'lifecycle', 'plan', 'dressing', 'assessment_correction', 'treatment_correction']) r.openDetailEditor(kind, id(10));
  assert.deepEqual(w.routes, []); assert.equal(w.render().activeEditor, null);
});
for (const flag of ['loading', 'refreshing', 'error', 'refreshError', 'previewData', 'tableMissing']) test(`Aktueller ${flag}-Zustand verhindert alte Assessment-/Plan-/Abschlussaktionen`, async () => {
  const w = await ready(), old = w.render(); w.env.flags[flag] = flag.endsWith('Error') || flag === 'error' ? 'Abfrage fehlgeschlagen' : true; w.render();
  old.openDetailEditor('assessment'); old.openDetailEditor('lifecycle'); old.openDetailEditor('plan'); assert.deepEqual(w.routes, []); assert.equal(w.render().activeEditor, null);
});
for (const right of ['pflege.wounds.manage', 'pflege.orders.view', 'pflege.treatment.view', 'pflege.treatment.manage']) test(`Entzogenes ${right} wird beim tatsächlichen Öffnen erneut geprüft`, async () => {
  const w = await ready(), old = w.render(); w.env.rights[right] = false; w.render(); old.openDetailEditor(right === 'pflege.orders.view' ? 'plan' : 'dressing'); assert.equal(w.render().activeEditor, null);
});
test('Ein Abschlussstatus erlaubt Wiederöffnung, aber keine neue aktive Planung oder Assessmentnavigation', async () => {
  const w = await ready(); w.env.original.row.status = 'healed'; await w.read(); let r = w.render(); r.openDetailEditor('plan'); r.openDetailEditor('assessment'); assert.deepEqual(w.routes, []); assert.equal(w.render().activeEditor, null);
  r.openDetailEditor('lifecycle'); assert.equal(w.render().activeEditor, 'lifecycle');
});
test('Verdeckte Änderung eines Originalassessments sperrt sämtliche Detailaktionen', async () => {
  const w = await ready(), old = w.render(); w.env.data.assessments[1].documentation_details.original[0] = 'Geändert'; old.openDetailEditor('lifecycle'); assert.equal(old.currentDetail(), null); assert.equal(w.render().activeEditor, null);
});
test('Benutzer- und Mandantenwechsel sperren retained Öffnen- und Aktualisieren-Callbacks', async () => {
  for (const mutate of [e => { e.profile = { ...e.profile, id: id(99) }; }, e => { e.runtimeTenant = id(99); }, e => { e.wound = id(99); }]) {
    const w = await ready(), old = w.render(); mutate(w.env); w.render(); old.openDetailEditor('assessment'); old.openDetailEditor('plan'); old.refreshDetail(); assert.deepEqual(w.routes, []); assert.equal(w.refreshes, 0);
  }
});
test('Leserechtverlust und Wiederkehr beleben keine alten Detailöffnungen oder Retry-Closures', async () => {
  const w = await ready(), old = w.render(); w.env.rights['pflege.wounds.view'] = false; w.render(); w.env.rights['pflege.wounds.view'] = true; w.render(); await w.read(); old.openDetailEditor('lifecycle'); old.refreshDetail(); assert.equal(w.render().activeEditor, null); assert.equal(w.refreshes, 0);
});
test('Retained Schließen eines früheren Planeditors kann keinen neuen Planeditor schließen', async () => {
  const w = await ready(); w.render().openDetailEditor('plan'); const old = w.render(); old.closeDetailEditor('plan'); await w.read(); w.render().openDetailEditor('plan'); old.closeDetailEditor('plan'); assert.equal(w.render().activeEditor, 'plan');
});
test('Zweite Öffnung während bereits gestarteter lokaler Bearbeitung bleibt gesperrt', async () => {
  const w = await ready(), r = w.render(); r.openDetailEditor('plan'); r.openDetailEditor('lifecycle'); assert.equal(w.render().activeEditor, 'plan');
});
test('Unmount verwirft alte Detailaktionen, ohne neue Abfrage oder Navigation', async () => {
  const w = await ready(), old = w.render(); w.dispose(); old.openDetailEditor('assessment'); old.refreshDetail(); assert.equal(old.currentDetail(), null); assert.deepEqual(w.routes, []); assert.equal(w.refreshes, 0);
});
test('Ganze sichtbare Akte wird erst nach aktuellem Vollread angezeigt; eigener Editor bleibt beim Nachladen erhalten', () => {
  const gate = screen.indexOf('if(!currentDetail()||!q.data)'); assert.ok(gate > screen.indexOf('if(activeEditor){')); assert.ok(gate < screen.indexOf(' const w=q.data.row'));
  assert.match(screen, /WoundDocumentationWorkspace key=\{JSON.stringify\(\[id,workspaceOwner.current\]\)\}/);
});
for (const [kind, component, target] of [['plan','WoundCareScreen'],['dressing','WoundCareScreen'],['lifecycle','WoundLifecycleScreen'],['assessment_correction','WoundAssessmentCorrectionScreen',id(10)],['treatment_correction','TreatmentCorrectionScreen',id(99)]]) test(`Laufender ${kind}-Editor bleibt bei vorübergehendem Leseverlust derselbe Renderzweig`, async () => {
  const w = await ready(); w.render().openDetailEditor(kind,target); const active = w.render().activeEditor; assert.equal(w.render().editorBranch(),component);
  w.env.rights['pflege.wounds.view']=false; const denied = w.render(); assert.equal(denied.nativeRead,false); assert.equal(denied.editorBranch(),component); assert.equal(denied.activeEditor,active); assert.equal(denied.currentDetail(),null);
  w.env.rights['pflege.wounds.view']=true; assert.equal(w.render().editorBranch(),component); assert.equal(w.render().activeEditor,active); assert.equal(w.render().currentDetail(),null);
});
test('Ein reiner Leseverlust bei gleichem Eigentümer entwertet keinen bestätigten Schließen-Aufruf desselben Editors', async () => {
  const w = await ready(); w.render().openDetailEditor('plan'); const before = w.render(); w.env.rights['pflege.wounds.view']=false; w.render(); w.env.rights['pflege.wounds.view']=true; w.render();
  before.closeDetailEditor('plan'); assert.equal(w.render().activeEditor,null); assert.equal(w.refreshes,1);
});
test('Ein tatsächlich geänderter nativer Eigentümer entwertet alte Schließen-Aufrufe', async () => {
  const w = await ready(); w.render().openDetailEditor('plan'); const before = w.render(); w.env.profile={...w.env.profile,id:id(99)}; w.render(); before.closeDetailEditor('plan'); assert.equal(w.render().activeEditor,'plan'); assert.equal(w.refreshes,0);
});
const rootStart=screen.indexOf('export function WoundDocumentationDetailScreen(){'), rootEnd=screen.indexOf(' return <WoundDocumentationWorkspace',rootStart);
const rootPrefix=stripTypeScriptTypes(screen.slice(rootStart,rootEnd).replace('export ','')+'return JSON.stringify([id,workspaceOwner.current]);}');
const makeRoot=new Function('useLocalSearchParams','useAuth','useRef','woundUuid','isKnownWoundEditorRole',`${rootPrefix};return WoundDocumentationDetailScreen;`);
function rootWorkspace(){const slot={current:undefined},env={id:wound,profile:{tenantId:tenant,id:actor,roleKey:'business_admin'}};let initial=true;
 const run=makeRoot(()=>({id:env.id}),()=>({profile:env.profile}),value=>{if(initial){slot.current=value;initial=false;}return slot;},woundUuid,isKnownWoundEditorRole);return{env,key:run};}
test('Vorübergehend fehlendes Profil behält den bekannten äußeren Formulareigentümer',()=>{const w=rootWorkspace(),key=w.key(),profile=w.env.profile;w.env.profile=null;assert.equal(w.key(),key);w.env.profile=profile;assert.equal(w.key(),key);});
test('Ein tatsächlich anderer Benutzer erhält auch außen eine neue Formularinstanz',()=>{const w=rootWorkspace(),key=w.key();w.env.profile={...w.env.profile,id:id(99)};assert.notEqual(w.key(),key);});
test('Ein anderer Wundfall erhält auch bei vorübergehend fehlendem Profil eine eigene Instanz',()=>{const w=rootWorkspace(),key=w.key();w.env.profile=null;w.env.id=id(99);assert.notEqual(w.key(),key);});

test('Vorübergehend ungültige Authrolle ersetzt den bekannten nativen Formulareigentümer nicht',()=>{const w=rootWorkspace(),key=w.key(),profile=w.env.profile;w.env.profile={...profile,roleKey:'foo'};assert.equal(w.key(),key);w.env.profile=profile;assert.equal(w.key(),key);});
