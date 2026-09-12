// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn(), leave: vi.fn(), write: true }));
vi.mock('expo-router', () => ({ useRouter: () => ({ push: vi.fn() }), useLocalSearchParams: () => ({}) }));
vi.mock('@/components/platformConsole/PlatformShellLayout.web', () => ({ PlatformShellLayout: ({children}: any) => <div>{children}</div> }));
vi.mock('@/lib/platformConsole/PlatformAuthProvider', () => ({ usePlatformAuth: () => ({ platformUser: {role: 'platform_owner'} }) }));
vi.mock('@/lib/platformConsole', () => ({ platformRoleHasCapability: (_role: string, capability: string) => !capability.endsWith('.write') || state.write }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'live' }));
vi.mock('@/hooks/useUnsavedWebChanges.web', () => ({ useUnsavedWebChanges: () => state.leave }));
vi.mock('@/lib/platformConsole/consoleWorkspaceService', () => ({
  CONSOLE_SECTIONS: { modules: {title:'Module',subtitle:'Produktkatalog',description:'Katalog verwalten',empty:'Keine Module',capability:'modules.read',columns:[{key:'module_name',label:'Name'}]} },
  loadConsoleData: state.load,
  consoleActions: () => [{key:'module',title:'Modul anlegen',description:'Katalogeintrag',capability:'modules.write',fields:[{key:'name',label:'Name',required:true}],run:state.save}],
  formatConsoleCell: (row: any, column: any) => row[column.key],
}));
import { PlatformConsoleWorkspace } from '@/screens/platformConsole/PlatformConsoleWorkspace.web';
import { PlatformConfirmModal } from '@/components/platformConsole/PlatformConfirmModal.web';

let root: Root; let host: HTMLDivElement;
const empty = {rows:[],tenants:[],related:[],warnings:[],hasMore:false};
const button = (text: string) => [...host.querySelectorAll('button')].find(node => node.textContent?.includes(text));
const render = async (node: React.ReactNode) => { await act(async () => root.render(node)); };
const click = async (text: string) => { await act(async () => button(text)!.click()); };
const write = async (selector: string, value: string) => {
  const node = host.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement;
  await act(async () => {
    const prototype = node.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype,'value')!.set!.call(node,value);
    node.dispatchEvent(new Event('input',{bubbles:true}));
  });
};
const deferred = () => { let resolve!: (value: any) => void; const promise = new Promise<any>(r => {resolve=r;}); return {promise,resolve}; };
const openEditor = async () => {
  await render(<PlatformConsoleWorkspace section="modules"/>);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  await click('Modul anlegen');
  await write('#console-action-form input','Terminplanung');
  await write('#console-action-form textarea','Freigabe nach Prüfung');
};
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers(); vi.clearAllMocks(); state.write=true;
  state.load.mockResolvedValue(empty); state.leave.mockResolvedValue(true); state.save.mockResolvedValue(undefined);
  // happy-dom checks interaction only; this deliberately supplies no layout evidence.
  HTMLDialogElement.prototype.showModal = function(){this.open=true;};
  HTMLDialogElement.prototype.close = function(){this.open=false;};
  host=document.createElement('div');document.body.appendChild(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();});

it('keeps creation locked until the required directory has loaded',async()=>{
  const pending=deferred();state.load.mockReturnValue(pending.promise);
  await render(<PlatformConsoleWorkspace section="modules"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
  expect(button('Modul anlegen')!.disabled).toBe(true);
  await act(async()=>pending.resolve(empty));
  expect(button('Modul anlegen')!.disabled).toBe(false);
});
it('retains rejected input and reason, then refreshes after a successful retry',async()=>{
  state.save.mockRejectedValueOnce(new Error('Speicherung abgelehnt'));
  await openEditor();await click('Speichern');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Speicherung abgelehnt');
  expect((host.querySelector('#console-action-form input') as HTMLInputElement).value).toBe('Terminplanung');
  expect((host.querySelector('#console-action-form textarea') as HTMLTextAreaElement).value).toBe('Freigabe nach Prüfung');
  await click('Speichern');
  expect(state.save).toHaveBeenCalledTimes(2);
  expect(state.save).toHaveBeenLastCalledWith({name:'Terminplanung'},'Freigabe nach Prüfung');
  expect(host.querySelector('dialog')).toBeNull();expect(state.load).toHaveBeenCalledTimes(2);
});
it('locks pending submission and honors a cancelled discard',async()=>{
  await openEditor();state.leave.mockResolvedValue(false);await click('Abbrechen');
  expect(host.querySelector('dialog')).not.toBeNull();
  const pending=deferred();state.save.mockReturnValue(pending.promise);
  await act(async()=>{
    const form=host.querySelector('form')!;
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  });
  expect(state.save).toHaveBeenCalledTimes(1);
  expect(button('Abbrechen')!.disabled).toBe(true);
  expect((host.querySelector('textarea') as HTMLTextAreaElement).disabled).toBe(true);
  await act(async()=>pending.resolve(undefined));
});
it('does not offer catalog changes to a reader',async()=>{
  state.write=false;await render(<PlatformConsoleWorkspace section="modules"/>);
  await act(async()=>{await vi.advanceTimersByTimeAsync(1);});
  expect(button('Modul anlegen')).toBeUndefined();
});
it('retains confirmation inputs across an error and unlocks a retry after loading',async()=>{
  const confirm=vi.fn();const cancel=vi.fn();
  const view=(loading=false,error?:string)=><PlatformConfirmModal visible title="Sperren" description="Zugriff ändern" requireTypedConfirmation="SPERREN" loading={loading} error={error} onCancel={cancel} onConfirm={confirm}/>;
  await render(view());await write('textarea','Prüfung abgeschlossen');await write('input','SPERREN');
  await click('Bestätigen');await render(view(true));
  expect(button('Abbrechen')!.disabled).toBe(true);
  await render(view(false,'Netzwerkfehler'));
  expect((host.querySelector('textarea') as HTMLTextAreaElement).value).toBe('Prüfung abgeschlossen');
  expect((host.querySelector('input') as HTMLInputElement).value).toBe('SPERREN');
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Netzwerkfehler');
  await click('Bestätigen');expect(confirm).toHaveBeenCalledTimes(2);
});
