// Functional checks of the real sources; the hook/tree adapter has no layout engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import * as nodeModule from 'node:module';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = nodeModule.createRequire(path.join(root, 'package.json'));
let transform, parseSource;
try {
  const babel = require('@babel/core');
  const ts = require.resolve('@babel/plugin-transform-typescript');
  const jsx = require.resolve('@babel/plugin-transform-react-jsx');
  transform = (source, filename) => babel.transformSync(source, { filename, configFile: false, babelrc: false,
    plugins: [[ts, { isTSX: filename.endsWith('.tsx'), allExtensions: true }], [jsx, { runtime: 'automatic' }]] }).code;
  parseSource = (source,filename) => babel.parseSync(source,{ filename,configFile:false,babelrc:false,parserOpts:{ plugins:['typescript','jsx'] } });
} catch {
  if (process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES) {
    const babel = require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES, 'playwright/lib/transform/babelBundle.js'));
    transform = (source, filename) => babel.babelTransform(source, filename, true, [], []).code;
    parseSource = (source,filename) => babel.babelParse(source, filename, true);
  }
}
if (!vm.SourceTextModule) throw new Error('Bitte diese Prüfung mit node --experimental-vm-modules starten.');

async function loadSource(entry, mocks = {}, globals = {}) {
  const context = vm.createContext({ console, AbortController, setTimeout, clearTimeout, Uint8Array, crypto: webcrypto, ...globals });
  const cache = new Map();
  function get(filename) {
    if (cache.has(filename)) return cache.get(filename);
    const source = fs.readFileSync(filename, 'utf8');
    const code = filename.endsWith('.tsx') || !nodeModule.stripTypeScriptTypes
      ? transform?.(source, filename) : nodeModule.stripTypeScriptTypes(source);
    if (!code) throw new Error('Die vorhandene TypeScript/React-Umwandlung fehlt. Es werden keine Pakete installiert.');
    const module = new vm.SourceTextModule(code, { context, identifier: filename });
    cache.set(filename, module); return module;
  }
  const module = get(path.join(root, entry));
  await module.link((specifier, parent) => {
    if (Object.hasOwn(mocks, specifier)) {
      if (!cache.has(specifier)) {
        const values = mocks[specifier], names = Object.keys(values);
        cache.set(specifier, new vm.SyntheticModule(names, function() { for (const name of names) this.setExport(name, values[name]); }, { context }));
      }
      return cache.get(specifier);
    }
    const base = specifier.startsWith('@/') ? path.join(root, 'src', specifier.slice(2)) : path.resolve(path.dirname(parent.identifier), specifier);
    const filename = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!filename) throw new Error(`Unerwartete Abhängigkeit: ${specifier}`);
    return get(filename);
  });
  await module.evaluate(); return module.namespace;
}
const plain = value => JSON.parse(JSON.stringify(value));
const uid = n => `10000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const model = await loadSource('src/lib/portal/optionalVisitTasks.ts');
const draft = (title = 'Briefkasten leeren', n = 21) => ({ id: uid(n), title });
const task = (title = 'Briefkasten leeren', n = 21) => ({ ...draft(title,n), status: 'open', required: false, description: '', completionNote: null, requiresNote: true });

test('Vorlagen sind vorhanden, deutsch beschriftet und über mehrere Suchwörter auffindbar', () => {
  assert.ok(model.OPTIONAL_TASK_CHOICES.length > 10);
  const choice = model.OPTIONAL_TASK_CHOICES.find(item => /wäsche/i.test(item.title));
  assert.ok(choice); assert.ok(choice.category);
  assert.ok(model.searchOptionalTaskChoices('wasche').some(item => item.id === choice.id));
  assert.ok(model.searchOptionalTaskChoices(`${choice.title.split(' ')[0]} ${choice.category.split(' ')[0]}`).some(item => item.id === choice.id));
  assert.equal(model.searchOptionalTaskChoices('keinevorlagexyz').length, 0);
});
test('Manuelle Eingabe normalisiert Abstände und lässt zulässige Aufgaben zu', () => {
  assert.deepEqual(plain(model.validateOptionalTaskDrafts([draft('  Briefkasten\n  leeren  ')])), { ok: true, data: [draft()] });
});
test('Leere, zu lange, medizinische, doppelte und manipulierte Aufgaben werden abgewiesen', () => {
  for (const input of [[], [draft(' ')], [draft('x'.repeat(301))], [draft('Medikamentengabe')], [draft('Briefkasten leeren'), draft('briefkasten leeren',22)],
    [draft('Erste Aufgabe'), draft('Zweite Aufgabe')], [{ ...draft(), catalogId: 'erfundene-vorlage' }], Array.from({ length:26 }, (_,i) => draft(`Aufgabe ${i}`,i+30))])
    assert.equal(model.validateOptionalTaskDrafts(input).ok, false);
});
test('Bestehende Aufgaben behalten Status und Notiz; bestätigte neue Aufgaben werden einmal ergänzt', () => {
  const base = [{ ...task(), status: 'done', completionNote: 'Vorherige Notiz' }], added = [task(), task('Post sortieren',22), task('Post sortieren',22)];
  const merged = model.mergeConfirmedOptionalTasks(base,added);
  assert.equal(merged.length,2); assert.strictEqual(merged[0],base[0]); assert.equal(base.length,1);
});

async function serviceFixture(options = {}) {
  const calls = [], timers = new Set();
  const scope = { tenantId:uid(1), employeeId:uid(3), assignmentId:`${uid(9)}::2026-10-08`, portalSession:{ id:'portal-fixture' } };
  const source = options.source ?? 'assist_visits', parent = uid(source === 'assignments' ? 11 : 10);
  const response = options.response ?? { release:model.OPTIONAL_VISIT_TASKS_RELEASE, source, parentId:parent, inserted:1, tasks:[task()] };
  const service = await loadSource('src/lib/portal/optionalVisitTasks.web.ts', {
    '@/lib/services/mode':{ getServiceMode:() => options.mode ?? 'supabase' },
    '@/lib/auth/portalSupabaseAuth':{ ensurePortalWriteSession:async value => { calls.push(['session',value]); return options.session ?? { ok:true }; } },
    '@/lib/assist/visitService':{ resolveExecutableVisitId:async (...args) => { calls.push(['occurrence',...args]); return options.executable ?? { ok:true,data:{ visitId:uid(10) } }; } },
    '@/features/liveTracking/resolveLiveAssignment':{ resolveLiveAssignment:async args => { calls.push(['resolve',args]); return options.resolved ?? { ok:true,data:{ detail:{ tenantId:uid(1) }, employeeId:uid(3), visitId:uid(10), assignmentId:uid(11), persistenceSource:source } }; } },
    '@/lib/supabase/client':{ getSupabaseClient:() => options.noClient ? null : { rpc:(name,params) => { calls.push(['rpc',name,params]); return { abortSignal:signal => { calls.push(['signal',signal]); return options.reject ? Promise.reject(Error('network')) : Promise.resolve({ data:response,error:options.error ?? null }); } }; } } },
  }, { setTimeout:callback => { timers.add(callback); return callback; }, clearTimeout:timer => timers.delete(timer) });
  return { save:input => service.addEmployeeOptionalVisitTasks(scope,input ?? [draft()]), calls, timers };
}
test('Serientermin wird einzeln aufgelöst; nur bestätigte Serverdaten ergeben Erfolg', async () => {
  const f = await serviceFixture(), result = await f.save();
  assert.equal(result.ok,true); assert.equal(result.inserted,1);
  const call = f.calls.find(c => c[0] === 'rpc');
  assert.equal(call[1],'employee_add_optional_visit_tasks'); assert.equal(call[2].p_parent_id,uid(10));
  assert.equal(call[2].p_source,'assist_visits'); assert.equal(call[2].p_tenant_id,uid(1));
  assert.ok(f.calls.find(c => c[0] === 'signal')[1] instanceof AbortSignal); assert.equal(f.timers.size,0);
});
test('Älterer einzelner Einsatz verwendet seine richtige Aufgabenquelle', async () => {
  const f = await serviceFixture({ source:'assignments' }); assert.equal((await f.save()).ok,true);
  assert.equal(f.calls.find(c => c[0] === 'rpc')[2].p_parent_id,uid(11));
});
test('Demozugang, fehlende Anmeldung und falsche Mitarbeitendenzuordnung führen zu keiner Speicherung', async () => {
  for (const options of [{ mode:'demo' }, { session:{ ok:false,error:'Bitte erneut anmelden.' } },
    { resolved:{ ok:true,data:{ detail:{ tenantId:uid(1) }, employeeId:uid(99), visitId:uid(10), persistenceSource:'assist_visits' } } }]) {
    const f = await serviceFixture(options); assert.equal((await f.save()).ok,false); assert.ok(!f.calls.some(c => c[0] === 'rpc'));
  }
});
test('Ungültige Eingaben verlassen den Browser nicht', async () => {
  const f = await serviceFixture(); assert.equal((await f.save([draft('')])).ok,false); assert.equal(f.calls.length,0);
});
test('Fehlende Verbindung, Serverfehler und abweichende Antworten werden ehrlich gemeldet', async () => {
  for (const options of [{ noClient:true }, { reject:true }, { error:{ code:'42501' } }, { error:{ code:'55000' } }, { error:{ code:'PGRST202' } },
    { response:{ release:'alt' } }, { response:{ release:model.OPTIONAL_VISIT_TASKS_RELEASE,source:'assignments',parentId:uid(10),inserted:1,tasks:[task()] } }]) {
    const f = await serviceFixture(options); const result = await f.save(); assert.equal(result.ok,false); assert.ok(result.error); assert.equal(f.timers.size,0);
  }
});
test('Wiederholte Anfrage darf bereits gespeicherte Aufgabe mit bestehendem Status zurückgeben', async () => {
  const f = await serviceFixture({ response:{ release:model.OPTIONAL_VISIT_TASKS_RELEASE,source:'assist_visits',parentId:uid(10),inserted:0,tasks:[{ ...task(),id:uid(44),status:'done',completionNote:'Bestehende Notiz' }] } });
  const result = await f.save(); assert.equal(result.ok,true); assert.equal(result.tasks[0].status,'done'); assert.equal(result.tasks[0].completionNote,'Bestehende Notiz');
});

test('Bestätigte Aufgaben erreichen Einsatzkontext und Cache; ältere Statusantworten verlieren sie nicht', { skip:!parseSource }, async () => {
  const filename=path.join(root,'src/hooks/useEmployeePortalVisitExecution.ts'), source=fs.readFileSync(filename,'utf8'), ast=parseSource(source,filename), callbacks=new Map();
  function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit);
    if (node.type==='VariableDeclarator' && ['syncAfterWorkflow','acceptConfirmedTaskAdditions'].includes(node.id?.name)) callbacks.set(node.id.name,source.slice(node.init.arguments[0].start,node.init.arguments[0].end));
    for (const [key,value] of Object.entries(node)) if (!['loc','tokens','comments'].includes(key) && value && typeof value==='object') visit(value);
  }
  visit(ast); assert.equal(callbacks.size,2);
  const scope={ tenantId:uid(1),employeeId:uid(3),assignmentId:uid(10) }, current={ ...scope,assignmentStatus:'gestartet',derivedStatus:'gestartet',detail:{ tasks:[task('Alte Aufgabe',30)] },visitTimes:null,liveContext:null };
  const cache=[], data=[], refs={ executionContextRef:{ current },confirmedTaskAdditionsRef:{ current:null },signatureScopeRef:{ current:'scope-a' },skipContextRefreshRef:{ current:false } };
  const context=vm.createContext({ ...scope,...refs,signatureScopeKey:'scope-a',mergeConfirmedOptionalTasks:model.mergeConfirmedOptionalTasks,
    setExecutionContext:value => { refs.executionContextRef.current=value; },setLiveContext:() => {},
    query:{ setData:value => data.push(plain(value)) },writeExecutionDetailCache:async (...args) => { cache.push(plain(args)); } });
  async function callback(name) { const wrapped='export default '+callbacks.get(name); const code=nodeModule.stripTypeScriptTypes ? nodeModule.stripTypeScriptTypes(wrapped) : transform(wrapped,'hook-check.ts');
    const module=new vm.SourceTextModule(code,{ context }); await module.link(() => { throw Error('Unexpected import'); }); await module.evaluate(); return module.namespace.default;
  }
  const sync=await callback('syncAfterWorkflow');context.syncAfterWorkflow=sync;const accept=await callback('acceptConfirmedTaskAdditions');
  assert.equal(accept({ ...scope,assignmentId:uid(99) },[task()]),false);assert.equal(data.length,0);
  assert.equal(accept(scope,[task()]),true);assert.equal(refs.executionContextRef.current.detail.tasks.length,2);assert.equal(data.at(-1).tasks.length,2);assert.equal(cache.at(-1)[2].tasks.length,2);
  await sync({ ...current,detail:{ tasks:[{ ...task('Alte Aufgabe',30),status:'done',completionNote:'Neue Notiz' }] } });
  assert.equal(refs.executionContextRef.current.detail.tasks.length,2);assert.equal(refs.executionContextRef.current.detail.tasks[0].completionNote,'Neue Notiz');
});

function hookTreeFixture() {
  let state = [], cursor = 0, dirty = false, effects = [], props, component, tree;
  const dependenciesChanged = (a,b) => !a || !b || a.length !== b.length || a.some((value,i) => value !== b[i]);
  const react = {
    useState(initial) { const i=cursor++; if (!(i in state)) state[i]=typeof initial === 'function' ? initial() : initial; return [state[i],value => { state[i]=typeof value === 'function' ? value(state[i]) : value; dirty=true; }]; },
    useRef(initial) { const i=cursor++; return state[i] ?? (state[i]={ current:initial }); },
    useMemo(factory,deps) { const i=cursor++; if (!state[i] || dependenciesChanged(state[i].deps,deps)) state[i]={ deps,value:factory() }; return state[i].value; },
    useCallback(callback,deps) { const i=cursor++; if (!state[i] || dependenciesChanged(state[i].deps,deps)) state[i]={ deps,value:callback }; return state[i].value; },
    useEffect(callback,deps) { const i=cursor++; if (dependenciesChanged(state[i],deps)) { state[i]=deps; effects.push(callback); } },
  };
  return { react, set(componentValue,propsValue) { component=componentValue; props=propsValue; }, update(values) { props={ ...props,...values }; },
    render() { for (let i=0;i<20;i++) { cursor=0; dirty=false; effects=[]; tree=component(props); for (const effect of effects) effect(); if (!dirty) return tree; } throw Error('Hook adapter did not settle'); } };
}
function nodes(tree) { const result=[]; function visit(node) { if (!node || typeof node !== 'object') return; if (Array.isArray(node)) return node.forEach(visit); result.push(node); visit(node.props?.children); visit(node.props?.footerContent); } visit(tree); return result; }
const bodyText = tree => nodes(tree).filter(n => n.type === 'Text').map(n => Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children).join(' ');
const turn = async () => { await new Promise(resolve => setImmediate(resolve)); };
async function panelFixture(extra = {}) {
  const hooks = hookTreeFixture(), viewport={ width:1024,height:760 }, calls=[];
  const jsx = (type,props,key) => ({ type,props,key });
  const module = await loadSource('src/components/portal/EmployeePortalVisitTasksPanel.web.tsx', {
    react:hooks.react,'react/jsx-runtime':{ jsx,jsxs:jsx,Fragment:'Fragment' },
    'react-native':{ Platform:{ OS:'web' },Pressable:'Pressable',Text:'Text',View:'View',StyleSheet:{ create:x => x },useWindowDimensions:() => ({ width:1024,height:900 }) },
    '@/components/layout/platform/platformmodal':{ PlatformModal:'Modal' }, '@/components/ui':{ PremiumButton:'Button',PremiumInput:'Input' },
    '@/hooks/platform/useDeviceClass':{ useDeviceClass:() => viewport.width < 600 ? 'phone' : 'tablet' },
    '@/hooks/useWebVisualViewport.web':{ useWebVisualViewport:() => viewport },
    '@/lib/portal/employeePortalExecutionSurface':{ employeePortalExecutionSurface:{ border:'#ddd',background:'#fff',subtleBackground:'#eee' },employeePortalExecutionText:{ primary:'#111',secondary:'#333',muted:'#555' } },
    '@/theme':{ colors:{ amber:'#f90' },spacing:{ xs:4,sm:8,md:16,lg:24 },typography:{ body:{},bodyStrong:{},caption:{} } },
  });
  hooks.set(module.EmployeePortalVisitTasksPanel,{ tasks:[],visible:true,canAdd:true,onUpdateTask:async () => ({ ok:true }),
    onAddTasks:async drafts => { calls.push(plain(drafts)); return { ok:true,inserted:drafts.length,tasks:drafts.map(d => ({ ...task(),...d })) }; },...extra });
  return { ...hooks,viewport,calls, find:id => nodes(hooks.render()).find(n => n.props?.testID === id), footer:() => hooks.render().props.footerActions[0],text:() => bodyText(hooks.render()) };
}
test('Leerer Einsatz zeigt Auswahl, Suche, manuelle Eingabe und eine sichtbare Speicheraktion', { skip:!transform }, async () => {
  const f=await panelFixture(); assert.ok(f.find('optional-tasks-empty')); assert.ok(f.find('optional-task-search'));
  assert.ok(f.find('optional-tasks-mode-manual')); assert.equal(f.footer().disabled,true);
  f.find('optional-tasks-mode-manual').props.onPress(); assert.ok(f.find('optional-task-manual-title'));
});
test('Suche filtert; Mehrfachauswahl bleibt über Suchwechsel erhalten und wird gespeichert', { skip:!transform }, async () => {
  const f=await panelFixture(), choices=model.OPTIONAL_TASK_CHOICES;
  f.find(`optional-task-choice-${choices[0].id}`).props.onPress(); f.render();
  f.find('optional-task-search').props.onChangeText(choices[1].title); f.render();
  f.find(`optional-task-choice-${choices[1].id}`).props.onPress();
  f.footer().onPress(); await turn(); assert.equal(f.calls[0].length,2); assert.equal(f.footer().disabled,true);
});
test('Keine Suchtreffer führen zur verständlichen Alternative einer eigenen Aufgabe', { skip:!transform }, async () => {
  const f=await panelFixture(); f.find('optional-task-search').props.onChangeText('keinevorlagexyz');
  assert.match(f.text(),/Keine passende Vorlage/); f.find('optional-tasks-mode-manual').props.onPress(); assert.ok(f.find('optional-task-manual-title'));
});
test('Manuelle Aufgabe wird gespeichert; Doppelklick löst nur eine Speicherung aus', { skip:!transform }, async () => {
  let resolve; const calls=[]; const f=await panelFixture({ onAddTasks:input => { calls.push(plain(input)); return new Promise(r => { resolve=r; }); } });
  f.find('optional-tasks-mode-manual').props.onPress(); f.find('optional-task-manual-title').props.onChangeText('Briefkasten leeren');
  const action=f.footer(); action.onPress(); action.onPress(); assert.equal(calls.length,1); assert.equal(f.footer().loading,true);
  resolve({ ok:true,inserted:1,tasks:[task()] }); await turn(); assert.equal(f.find('optional-task-manual-title').props.value,''); assert.match(f.text(),/im Einsatz gespeichert/);
});
test('Fehlschlag erhält manuelle Eingabe und gleiche Anfragekennung beim Wiederholen', { skip:!transform }, async () => {
  const calls=[]; const f=await panelFixture({ onAddTasks:async input => { calls.push(plain(input)); return { ok:false,error:'Verbindung unterbrochen.' }; } });
  f.find('optional-tasks-mode-manual').props.onPress(); f.find('optional-task-manual-title').props.onChangeText('Briefkasten leeren');
  f.footer().onPress(); await turn(); assert.equal(f.find('optional-task-manual-title').props.value,'Briefkasten leeren'); assert.match(f.text(),/Verbindung unterbrochen/);
  f.footer().onPress(); await turn(); assert.equal(calls.length,2); assert.equal(calls[0][0].id,calls[1][0].id);
});
test('Bereits vorhandene Vorlagen und gesperrte Einsätze lassen keine neue Speicherung zu', { skip:!transform }, async () => {
  const choice=model.OPTIONAL_TASK_CHOICES[0], f=await panelFixture({ tasks:[task(choice.title)] });
  f.find('optional-tasks-mode-catalog').props.onPress();
  assert.equal(f.find(`optional-task-choice-${choice.id}`).props.disabled,true);
  f.update({ disabled:true,canAdd:false }); f.find('optional-tasks-mode-manual').props.onPress();
  assert.equal(f.find('optional-task-manual-title').props.editable,false); assert.equal(f.footer().disabled,true);
});
test('Fenster hat feste begrenzte Höhe und passt seine Höhe bei Drehung/Tastatur an', { skip:!transform }, async () => {
  const f=await panelFixture(); let modal=f.render(); assert.ok(modal.props.sheetStyle.height > 200 && modal.props.sheetStyle.height < 760);
  f.viewport.height=360; f.viewport.width=390; modal=f.render(); assert.ok(modal.props.sheetStyle.height > 100 && modal.props.sheetStyle.height < 360); assert.equal(modal.props.variant,'bottomSheet'); assert.ok(modal.props.footerActions.length);
});
test('Ungespeicherte Auswahl wird beim Schließen erkannt', { skip:!transform }, async () => {
  const f=await panelFixture(); f.find(`optional-task-choice-${model.OPTIONAL_TASK_CHOICES[0].id}`).props.onPress(); assert.equal(f.render().props.isDirty,true);
  f.update({ visible:false }); assert.equal(f.render().props.isDirty,false);
});
test('Bei vorhandenen Aufgaben führen feste Aktionen direkt zur Auswahl oder manuellen Eingabe', { skip:!transform }, async () => {
  const f=await panelFixture({ tasks:Array.from({ length:30 },(_,i) => task(`Aufgabe ${i}`,i+40)) });
  assert.equal(f.render().props.footerActions[0].title,'Vorlagen auswählen');f.render().props.footerActions[1].onPress();assert.ok(f.find('optional-task-manual-title'));
  f.find('optional-tasks-mode-existing').props.onPress();f.render().props.footerActions[0].onPress();assert.ok(f.find('optional-task-search'));
});
