// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { DeleteIntakeDraftButton } from '@/components/office/DeleteIntakeDraftButton.web';
const h=vi.hoisted(()=>({load:vi.fn(),remove:vi.fn(),clear:vi.fn(),confirm:vi.fn(),done:vi.fn()}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({user:{id:'actor'}})}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=> 'tenant'}));
vi.mock('@/lib/platform/confirmAction',()=>({confirmAction:h.confirm}));
vi.mock('@/lib/clients/clientIntakeDraftStorage',()=>({clearClientIntakeDraft:h.clear}));
vi.mock('@/lib/clients/repositories/clientIntakeDraftRepository.supabase',()=>({loadServerClientIntakeDraft:h.load,deleteClientIntakeDraft:h.remove}));
let host:HTMLDivElement,root:Root;
beforeEach(async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.resetAllMocks();
  h.load.mockResolvedValue({ok:true,data:{status:'draft',revision:4}});h.remove.mockResolvedValue({ok:true});h.confirm.mockResolvedValue(true);
  host=document.createElement('div');document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<DeleteIntakeDraftButton clientId="draft" name="Maria Beispiel" onDeleted={h.done}/>));
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const click=()=>act(async()=>host.querySelector('button')!.click());
it('cancels without deleting or clearing a local draft',async()=>{
  h.confirm.mockResolvedValueOnce(false);await click();
  expect(h.confirm).toHaveBeenCalledWith(expect.objectContaining({message:expect.stringContaining('Maria Beispiel')}));
  expect(h.remove).not.toHaveBeenCalled();expect(h.clear).not.toHaveBeenCalled();expect(h.done).not.toHaveBeenCalled();
});
it('deletes the reviewed revision before clearing its local copy and refreshing',async()=>{
  await click();expect(h.remove).toHaveBeenCalledWith('tenant','draft',4);
  expect(h.clear).toHaveBeenCalledWith('actor','tenant','draft');expect(h.done).toHaveBeenCalledOnce();
  expect(h.remove.mock.invocationCallOrder[0]).toBeLessThan(h.clear.mock.invocationCallOrder[0]);
});
it('keeps local data and displays a server conflict',async()=>{
  h.remove.mockResolvedValueOnce({ok:false,error:'Der Entwurf wurde inzwischen geändert.'});await click();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('inzwischen geändert');expect(h.clear).not.toHaveBeenCalled();expect(h.done).not.toHaveBeenCalled();
});
it('does not offer deletion after a concurrent completion',async()=>{
  h.load.mockResolvedValueOnce({ok:true,data:{status:'completed',revision:4}});await click();
  expect(h.confirm).not.toHaveBeenCalled();expect(h.remove).not.toHaveBeenCalled();expect(host.textContent).toContain('bereits abgeschlossen');
});
