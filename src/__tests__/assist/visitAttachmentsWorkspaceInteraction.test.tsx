// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableIframePageLoading":true}}
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const h=vi.hoisted(()=>({tenant:'tenant-a',paths:['tenant-a/photo.png','tenant-a/report.pdf'],resolve:vi.fn()}));
vi.mock('@/hooks/useTenantId',()=>({useServiceTenantId:()=>h.tenant}));
vi.mock('@/lib/auth/context',()=>({useAuth:()=>({profile:{id:'actor-a',roleKey:'business_admin'}})}));
vi.mock('@/components/assist/AssignmentsWorkspaceShell.web',()=>({AssignmentsWorkspaceStyles:()=>null}));
vi.mock('@/components/layout/platform',()=>({PlatformModal:({visible,children,title,onClose}:any)=>visible?<div role="dialog" aria-label={title}>{children}<button onClick={onClose}>Schließen</button></div>:null}));
vi.mock('@/lib/assist/visitInternalAttachmentService',async original=>({...await original<any>(),resolveVisitInternalAttachmentUrl:h.resolve}));
import { VisitInternalAttachmentsPanel } from '@/components/assist/VisitInternalAttachmentsPanel.web';
let root:Root,host:HTMLDivElement;
const render=async()=>{await act(async()=>root.render(<VisitInternalAttachmentsPanel storagePaths={h.paths}/>));};
const button=(text:string)=>[...host.querySelectorAll('button')].find(b=>b.textContent===text)!;
const pending=()=>{let resolve!:(v:any)=>void;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};};
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.clearAllMocks();h.tenant='tenant-a';h.paths=['tenant-a/photo.png','tenant-a/report.pdf'];h.resolve.mockImplementation(async path=>`https://files.example.org/${path}`);host=document.createElement('div');document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
describe('Private visit attachment UI',()=>{
 it('resolves each unique attachment once and opens a real image/PDF preview',async()=>{h.paths.push('tenant-a/photo.png');await render();expect(h.resolve).toHaveBeenCalledTimes(2);expect(host.querySelectorAll('article')).toHaveLength(2);await act(async()=>button('Vorschau öffnen').click());expect(host.querySelector('[role=dialog] img')?.getAttribute('src')).toBe('https://files.example.org/tenant-a/photo.png');await act(async()=>button('Schließen').click());await act(async()=>host.querySelectorAll<HTMLButtonElement>('article button')[1]!.click());expect(host.querySelector('iframe')?.title).toBe('report.pdf');expect(host.querySelector('a')?.rel).toBe('noopener noreferrer');});
 it('offers retry after rejection and prevents duplicate clicks',async()=>{h.paths=['tenant-a/photo.png'];h.resolve.mockRejectedValueOnce(new Error('network'));await render();expect(host.textContent).toContain('Anhang konnte nicht geladen werden.');const wait=pending();h.resolve.mockReturnValueOnce(wait.promise);const retry=button('Erneut laden');await act(async()=>{retry.click();retry.click();});expect(h.resolve).toHaveBeenCalledTimes(2);await act(async()=>wait.resolve('https://files.example.org/new.png'));expect(host.querySelector('img')?.src).toBe('https://files.example.org/new.png');});
 it('rejects unsafe returned URLs',async()=>{h.resolve.mockResolvedValue('javascript:alert(1)');await render();expect(host.querySelector('img')).toBeNull();expect(host.querySelector('a')).toBeNull();expect(host.textContent).toContain('Anhang konnte nicht geladen werden.');});
 it('does not restore an old company preview after a late signed URL response',async()=>{h.paths=['tenant-a/photo.png'];const wait=pending();h.resolve.mockReturnValueOnce(wait.promise);await render();h.tenant='tenant-b';h.paths=['tenant-b/new.png'];await render();await act(async()=>wait.resolve('https://files.example.org/private-old.png'));expect(host.querySelector('img')?.src).toBe('https://files.example.org/tenant-b/new.png');expect(host.innerHTML).not.toContain('private-old');expect(host.textContent).not.toContain('photo.png');});
 it('provides an explicit failure and retry when an image link stops loading',async()=>{h.paths=['tenant-a/photo.png'];await render();await act(async()=>host.querySelector('img')!.dispatchEvent(new Event('error')));expect(host.textContent).toContain('Bild konnte nicht geladen werden.');expect(button('Erneut laden')).toBeTruthy();});
});
