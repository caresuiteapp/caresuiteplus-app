import { beforeEach,describe,expect,it,vi } from 'vitest';
import { uploadEmployeePortalVisitAttachment } from '@/lib/portal/employeePortalVisitAttachmentService.web';
const api=vi.hoisted(()=>({upload:vi.fn(),download:vi.fn(),insert:vi.fn(),single:vi.fn(),select:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/supabase/config',()=>({isDemoMode:()=>false}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({storage:{from:api.from}})}));
vi.mock('@/lib/supabase/untypedTable',()=>({fromUnknownTable:()=>({insert:api.insert})}));
const input={tenantId:'11111111-1111-4111-8111-111111111111',visitId:'22222222-2222-4222-8222-222222222222',employeeId:'33333333-3333-4333-8333-333333333333',attachmentId:'44444444-4444-4444-8444-444444444444',fileName:'photo.jpg',mimeType:'image/jpeg',bytes:new Uint8Array([1,2,3])};
beforeEach(()=>{vi.clearAllMocks();api.from.mockReturnValue({upload:api.upload,download:api.download});api.upload.mockResolvedValue({error:null});api.insert.mockReturnValue({select:api.select});api.select.mockReturnValue({single:api.single});api.single.mockImplementation(async()=>({data:{id:input.attachmentId,storage_path:api.upload.mock.calls.at(-1)?.[0],mime_type:input.mimeType},error:null}));});
describe('employee visit photo and video persistence',()=>{
 it.each([['image/jpeg','photo.jpg'],['video/mp4','clip.mp4'],['video/quicktime','clip.mov']])('uploads %s to the actual visit and stores metadata',async(mimeType,fileName)=>{
  const r=await uploadEmployeePortalVisitAttachment({...input,mimeType,fileName});expect(r.ok).toBe(true);if(!r.ok)return;
  expect(r.data.metadataPersisted).toBe(true);expect(r.data.storagePath).toContain(`/assist/visits/${input.visitId}/attachments/${input.attachmentId}.`);
  expect(api.insert).toHaveBeenCalledWith(expect.objectContaining({tenant_id:input.tenantId,visit_id:input.visitId,employee_id:input.employeeId,mime_type:mimeType,size_bytes:3}));
 });
 it.each([['application/pdf','file.pdf'],['audio/webm','voice.webm'],['text/plain','text.txt']])('rejects extra employee type %s before uploading',async(mimeType,fileName)=>{
  expect((await uploadEmployeePortalVisitAttachment({...input,mimeType,fileName})).ok).toBe(false);expect(api.upload).not.toHaveBeenCalled();
 });
 it('preserves a durable original when the metadata response is lost',async()=>{
  api.single.mockResolvedValue({error:{code:'42P01'}});const r=await uploadEmployeePortalVisitAttachment(input);expect(r).toMatchObject({ok:true,data:{metadataPersisted:false}});
 });
 it('retries with the same identity and compares an existing original byte for byte',async()=>{
  api.upload.mockResolvedValue({error:{message:'already exists'}});api.download.mockResolvedValue({data:{arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer},error:null});
  expect((await uploadEmployeePortalVisitAttachment(input)).ok).toBe(true);expect(api.download.mock.calls[0][0]).toContain(input.attachmentId);
  api.download.mockResolvedValue({data:{arrayBuffer:async()=>new Uint8Array([9,2,3]).buffer},error:null});api.insert.mockClear();expect((await uploadEmployeePortalVisitAttachment(input)).ok).toBe(false);expect(api.insert).not.toHaveBeenCalled();
 });
});
