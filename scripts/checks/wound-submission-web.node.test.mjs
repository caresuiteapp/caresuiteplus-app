import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { MedicationRequestState } from '../../src/lib/pflege/medicationRequestState.ts';
import { woundEditorAccess as captureWoundEditorAccess,isKnownWoundEditorRole } from '../../src/lib/pflege/woundEditorRequestGuard.web.ts';
import { woundUuid } from '../../src/lib/pflege/woundCareDomain.ts';
import { woundEditorAccess } from '../../src/lib/pflege/woundEditorAccess.web.ts';

const id = n => `44444444-4444-4444-8444-${String(n).padStart(12, '0')}`;
const owner = { tenantId: id(1), profileId: id(2), role: 'business_admin' };
const read = name => readFileSync(new URL(`../../${name}`, import.meta.url), 'utf8');
const body = file => stripTypeScriptTypes(read(file).replace(/^import .*;\n/gm, '').replace('export function', 'function'));
const create = new Function('useRef','useState','useEffect','useUnsavedWebChanges','MedicationRequestState', `${body('src/hooks/useMedicationSubmission.web.ts')}\n${body('src/hooks/pflege/useWoundSubmission.web.ts')}\nreturn useWoundSubmission;`);
const payload = () => ({ action: 'dressing', woundId: id(3), dataJson: '{"original":"Unveränderte Dokumentation"}' });

// Actual new submission hook and existing request hook/controller in a local state adapter, not React.
function workspace() {
  const slots = [], cleanups = [], calls = []; let pointer = 0, confirmed = 0;
  const env = { allowed: true, next: { ok: false, uncertain: true, error: 'Bestätigung fehlt' }, deferred: null };
  const useRef = initial => { const i = pointer++; return slots[i] ??= { current: initial }; };
  const useState = initial => { const i = pointer++; if (!(i in slots)) slots[i] = initial; return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }]; };
  const useEffect = fn => { const i = pointer++; if (!(i in slots)) { slots[i] = true; cleanups.push(fn()); } };
  const use = create(useRef,useState,useEffect,(_dirty,locked) => async () => !locked,MedicationRequestState);
  function render() { pointer = 0; return use(true,env.allowed,async (requestId,original,replay) => { calls.push({ requestId, original, replay }); return env.deferred ? env.deferred() : env.next; },() => { confirmed++; }); }
  return { env, calls, render, dispose: () => cleanups.forEach(fn => fn?.()), get confirmed() { return confirmed; } };
}
test('Zurückbehaltener Speichern-Aufruf erzeugt nach Zugriffsentzug keine Anfrage', async () => {
  const w = workspace(), old = w.render(); w.env.allowed = false; w.render(); await old.submit(payload()); assert.deepEqual(w.calls,[]); assert.match(w.render().error,/Zugriff/);
});
test('Eine unbestätigte Anfrage bleibt über Leseverlust erhalten und wird mit identischer Kennung und Nutzlast wiederholt', async () => {
  const w = workspace(), original = payload(); await w.render().submit(original); const first = w.calls[0]; assert.equal(first.replay,false); assert.equal(w.render().uncertain,true);
  const old = w.render(); w.env.allowed = false; w.render(); await old.retry(); assert.equal(w.calls.length,1); assert.equal(w.render().uncertain,true); assert.equal(w.render().locked,true); assert.equal(await w.render().confirmLeave(),false);
  w.env.allowed = true; w.env.next = { ok:true,data:{id:id(9)} }; w.render(); await old.retry(); const again = w.calls[1]; assert.equal(again.requestId,first.requestId); assert.equal(again.original,first.original); assert.deepEqual(again.original,original); assert.equal(again.replay,true); assert.equal(w.confirmed,1); assert.equal(w.render().uncertain,false);
});
test('Neu übergebene Angaben ersetzen während einer unbestätigten Anfrage keinen Originalpayload', async () => {
  const w = workspace(); await w.render().submit(payload()); const first = w.calls[0]; await w.render().submit({ ...payload(),dataJson:'Geänderter späterer Text' }); assert.equal(w.calls[1].requestId,first.requestId); assert.equal(w.calls[1].original,first.original); assert.equal(w.calls[1].replay,true);
});
test('Bereits laufende Antwort wird bei vorübergehendem Leseverlust verarbeitet, ohne zweite Anfrage', async () => {
  const w = workspace(); let release; w.env.deferred = () => new Promise(resolve => { release = resolve; }); const pending = w.render().submit(payload()); assert.equal(w.calls.length,1);
  const old = w.render(); w.env.allowed = false; w.render(); await old.retry(); assert.equal(w.calls.length,1); release({ ok:true,data:{id:id(9)} }); await pending; assert.equal(w.confirmed,1); assert.equal(w.render().busy,false); assert.equal(w.render().uncertain,false);
});
test('Auch eine unklare ausstehende Antwort behält nach Leseverlust ihre ursprüngliche Kennung', async () => {
  const w = workspace(); let release; w.env.deferred = () => new Promise(resolve => { release = resolve; }); const pending = w.render().submit(payload()); const first = w.calls[0]; w.env.allowed = false; w.render(); release({ ok:false,uncertain:true,error:'Antwort fehlt' }); await pending;
  assert.equal(w.render().uncertain,true); w.env.allowed = true; w.env.deferred = null; w.env.next = { ok:true,data:{id:id(9)} }; await w.render().retry(); assert.equal(w.calls[1].requestId,first.requestId); assert.equal(w.calls[1].original,first.original);
});
test('Abgewiesener Wiederholungsversuch erklärt die ursprüngliche Anfrage nicht nachträglich für fehlgeschlagen', async () => {
  const w = workspace(); await w.render().submit(payload()); const first = w.calls[0]; w.env.next = { ok:false,error:'Aktueller Zugriff fehlt' }; await w.render().retry(); assert.equal(w.render().uncertain,true); assert.equal(w.render().locked,true);
  w.env.next = { ok:true,data:{id:id(9)} }; await w.render().retry(); assert.equal(w.calls[2].requestId,first.requestId); assert.equal(w.calls[2].original,first.original);
});
test('Nach Unmount beginnen alte Speichern-/Retry-Aufrufe keine weitere Anfrage', async () => {
  const w = workspace(); await w.render().submit(payload()); const old = w.render(); w.dispose(); await old.retry(); await old.submit(payload()); assert.equal(w.calls.length,1);
});
test('Ein echtes neues Formular übernimmt keine Patientendaten oder Anfrage aus einer früheren Instanz', async () => {
  const previous = workspace(); await previous.render().submit(payload()); previous.dispose(); const next = workspace(); await next.render().retry(); assert.deepEqual(next.calls,[]); assert.equal(next.render().uncertain,false);
});
test('Altes Schließen bleibt unmittelbar ab Beginn einer ausstehenden Anfrage vor dem Rerender gesperrt', async () => {
  const w=workspace(),old=w.render();let release;w.env.deferred=()=>new Promise(resolve=>{release=resolve;});const pending=old.submit(payload());
  assert.equal(await old.confirmLeave(),false);release({ok:true,data:{id:id(9)}});await pending;w.render();assert.equal(await old.confirmLeave(),true);
});
test('Altes Schließen wird nach einer unklaren Antwort am aktuellen eingefrorenen Zustand geprüft',async()=>{
  const w=workspace(),old=w.render();await old.submit(payload());w.render();assert.equal(await old.confirmLeave(),false);w.env.next={ok:true,data:{id:id(9)}};await w.render().retry();w.render();assert.equal(await old.confirmLeave(),true);
});

const screens = [
  ['WoundCareScreen','CareForm','src/screens/pflege/WoundCareScreen.web.tsx',{mode:'dressing'}],
  ['WoundLifecycleScreen','LifecycleForm','src/screens/pflege/WoundLifecycleScreen.web.tsx',{}],
  ['WoundAssessmentCorrectionScreen','CorrectionForm','src/screens/pflege/WoundAssessmentCorrectionScreen.web.tsx',{woundId:id(3),assessmentId:id(4)}],
  ['TreatmentCorrectionScreen','CorrectionForm','src/screens/pflege/TreatmentCorrectionScreen.web.tsx',{executionId:id(5)}]
];
for (const [name,form,file,args] of screens) {
  const source = read(file), start = source.indexOf(`export function ${name}(`), stop = source.indexOf(` return <${form}`,start);
  assert.ok(start>=0&&stop>start,name);
  const fragment = stripTypeScriptTypes(source.slice(start,stop).replace('export ','') + 'return access;}');
  const wrapper = new Function('useLocalSearchParams','useServiceTenantId','useAuth','usePermissions','woundEditorAccess','captureWoundEditorAccess','useRef','woundUuid','isKnownWoundEditorRole',`${fragment};return ${name};`);
  const returnLine = source.slice(stop,source.indexOf('\n}',stop)), keyExpression = /key=\{(`[^`]+`)\}/.exec(returnLine)?.[1]; assert.ok(keyExpression,name);
  const key = new Function('access','id','mode','woundId','assessmentId','executionId',`return ${keyExpression};`);
  function wrapperAccess(env,ownerInput=owner,slot={}) { let cursor=0;slot.refs??=[];const fn = wrapper(() => ({id:id(3)}),() => env.serviceTenant,() => ({profile:env.profile}),() => ({tenantId:env.runtimeTenant,roleKey:env.runtimeRole,can:right => !env.denied.has(right)}),woundEditorAccess,captureWoundEditorAccess,value=>{const index=cursor++;return slot.refs[index]??={current:value};},woundUuid,isKnownWoundEditorRole); const access = fn({...args,sessionOwner:ownerInput==='standalone'?undefined:ownerInput,accessBlocked:env.blocked,onClose:()=>{}}); return {...access,formKey:key(access,id(3),args.mode,args.woundId,args.assessmentId,args.executionId)}; }
  const env = () => ({serviceTenant:owner.tenantId,profile:{tenantId:owner.tenantId,id:owner.profileId,roleKey:owner.role},runtimeTenant:owner.tenantId,runtimeRole:owner.role,denied:new Set(),blocked:false});
  test(`${name}: tatsächlicher Formschlüssel bleibt bei Dienst-/Rollenleseverlust unverändert und Zugriff ist gesperrt`, () => {
    const i = env(), before = wrapperAccess(i); assert.equal(before.canManage,true); i.runtimeRole = null; i.serviceTenant = null; const denied = wrapperAccess(i); assert.equal(denied.formKey,before.formKey); assert.equal(denied.canView,false); assert.equal(denied.canManage,false); assert.deepEqual(denied.owner,owner);
  });
  test(`${name}: Elternsperre pausiert die vorhandene Formularinstanz bis zum selben Zugriff`, () => {
    const i = env(), before = wrapperAccess(i); i.blocked = true; assert.equal(wrapperAccess(i).canView,false); assert.equal(wrapperAccess(i).formKey,before.formKey); i.blocked = false; assert.deepEqual(wrapperAccess(i),before);
  });
  test(`${name}: fehlendes natives Profil ersetzt keinen eingefrorenen Eigentümer durch die Laufzeitrolle`, () => {
    const i = env(), before = wrapperAccess(i); i.profile = null; assert.equal(wrapperAccess(i).canView,false); assert.equal(wrapperAccess(i).formKey,before.formKey);
  });
  test(`${name}: standalone actual wrapper retains native owner through missing profile and blocks invalid roles`,()=>{const i=env(),slot={},before=wrapperAccess(i,'standalone',slot),profile=i.profile;i.profile=null;i.serviceTenant=null;i.runtimeRole=null;const denied=wrapperAccess(i,'standalone',slot);assert.equal(denied.formKey,before.formKey);assert.equal(denied.canView,false);i.profile=profile;i.serviceTenant=owner.tenantId;i.runtimeRole=owner.role;assert.equal(wrapperAccess(i,'standalone',slot).formKey,before.formKey);i.profile={...profile,roleKey:'foo'};i.runtimeRole='foo';assert.equal(wrapperAccess(i,'standalone',slot).formKey,before.formKey);i.profile={...profile,id:id(99)};i.runtimeRole=owner.role;assert.notEqual(wrapperAccess(i,'standalone',slot).formKey,before.formKey);});

}
