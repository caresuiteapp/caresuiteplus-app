import { readFile } from 'node:fs/promises';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
const url = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;
const stub=url(`export const createContext=()=>({Provider:'provider'}); export const createElement=(type,props)=>props; export const useCallback=fn=>fn; export const useMemo=fn=>fn(); export const useContext=()=>null; export function useState(initial){const r=globalThis.modalTestRuntime,i=r.cursor++;if(!(i in r.states))r.states[i]=initial;return[r.states[i],v=>{r.states[i]=typeof v==='function'?v(r.states[i]):v}]} export function useRef(initial){const [value]=useState({current:initial});return value}`);
const code=stripTypeScriptTypes(await readFile(new URL('../src/hooks/useModalStack.ts',import.meta.url),'utf8')).replace("'react'",JSON.stringify(stub));
const {ModalStackProvider}=await import(url(code));
function setup(){globalThis.modalTestRuntime={cursor:0,states:[]};}
function render(scope='account-a'){modalTestRuntime.cursor=0;return ModalStackProvider({children:null,scope}).value;}
test('opening B preserves A; closing B returns A rather than empty menu',()=>{setup();let c=render();c.openModal({title:'A',modalKey:'settings.profile'});c=render();const first=c.topModal;c.openModal({title:'B',modalKey:'settings.tenant'});c=render();assert.equal(c.modalStack.length,2);assert.equal(c.modalStack[0],first);c.closeTopModal();c=render();assert.equal(c.topModal,first);});
test('Back pops one page and explicitly closing all clears every page',()=>{setup();let c=render();c.openModal({title:'A'});c=render();c.pushModal({title:'B'});c=render();c.goBackModal();assert.equal(render().topModal.title,'A');render().closeAllModals();assert.equal(render().modalStack.length,0);render().closeTopModal();assert.equal(render().modalStack.length,0);});
test('account change hides old pages and rejects delayed old close action',()=>{setup();let old=render();old.openModal({title:'A'});old=render();assert.equal(render('account-b').modalStack.length,0);render('account-b').openModal({title:'B'});old.closeTopModal();assert.equal(render('account-b').topModal.title,'B');});
