// @vitest-environment happy-dom
import {act} from 'react';import{createRoot}from'react-dom/client';import{afterEach,beforeEach,describe,expect,it,vi}from'vitest';
import {EmployeePortalVisitPhotoModal} from '@/components/portal/EmployeePortalVisitPhotoModal.web';
Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
const api=vi.hoisted(()=>({library:vi.fn(),document:vi.fn(),upload:vi.fn(),close:vi.fn(),uploaded:vi.fn()}));
vi.mock('@/components/layout/platform/platformmodal',()=>({PlatformModal:({children,title}:any)=><section aria-label={title}>{children}</section>}));
vi.mock('@/components/ui',()=>({PremiumButton:({title,onPress,disabled}:any)=><button disabled={disabled} onClick={onPress}>{title}</button>}));
vi.mock('@/hooks/useUnsavedWebChanges.web',()=>({useUnsavedWebChanges:()=>async()=>true}));
vi.mock('@/lib/portal/employeePortalVisitAttachmentService',()=>({uploadEmployeePortalVisitAttachment:api.upload}));
vi.mock('@/lib/portal/employeePortalMediaPicker',()=>({openEmployeePortalCamera:api.library,openEmployeePortalMediaLibrary:api.library,openEmployeePortalDocumentPicker:api.document,readEmployeePortalMediaBytes:async()=>new Uint8Array([1,2,3]),releaseEmployeePortalMediaUri:()=>{}}));
let host:HTMLDivElement,root:ReturnType<typeof createRoot>;
beforeEach(()=>{vi.clearAllMocks();host=document.createElement('div');document.body.append(host);root=createRoot(host);api.library.mockResolvedValue({ok:true,media:{uri:'blob:test',kind:'video',fileName:'clip.mp4',mimeType:'video/mp4',sizeBytes:3}});api.upload.mockResolvedValue({ok:true,data:{storagePath:'tenant/test/assist/visits/test/attachments/video.mp4',metadataPersisted:true}});});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
const click=async(label:string)=>{const b=[...host.querySelectorAll('button')].find(b=>b.textContent===label)!;expect(b).toBeTruthy();await act(async()=>b.click());};
describe('employee visit media dialog',()=>{
 it('previews a picked video, persists it and returns its durable reference',async()=>{
  await act(async()=>root.render(<EmployeePortalVisitPhotoModal visible tenantId="tenant" visitId="visit" employeeId="employee" existingReferences={[]} onClose={api.close} onUploaded={api.uploaded}/>));
  expect(host.textContent).not.toContain('PDF');await click('Fotos & Videos');expect(host.querySelector('video')?.getAttribute('src')).toBe('blob:test');await click('Datei hochladen');
  expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({visitId:'visit',employeeId:'employee',mimeType:'video/mp4',attachmentId:expect.any(String)}));expect(api.uploaded).toHaveBeenCalledWith([expect.stringContaining('/attachments/')]);expect(api.close).toHaveBeenCalledOnce();
 });
 it('retains the upload identity after a failed request',async()=>{
  api.upload.mockResolvedValueOnce({ok:false,error:'offline'});await act(async()=>root.render(<EmployeePortalVisitPhotoModal visible tenantId="tenant" visitId="visit" employeeId="employee" existingReferences={[]} onClose={api.close} onUploaded={api.uploaded}/>));
  await click('Fotos & Videos');await click('Datei hochladen');expect(api.close).not.toHaveBeenCalled();const id=api.upload.mock.calls[0][0].attachmentId;await click('Datei hochladen');expect(api.upload.mock.calls[1][0].attachmentId).toBe(id);
 });
});
