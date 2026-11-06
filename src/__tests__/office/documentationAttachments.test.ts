import { beforeEach, describe, expect, it, vi } from 'vitest';
import { documentationFileUrl, fileKind, listDocumentationFiles, uploadDocumentationFile } from '@/lib/office/documentation/attachments';
import type { DocumentationFile } from '@/lib/office/documentation/model';
const api=vi.hoisted(()=>({rpc:vi.fn(),getUser:vi.fn(),upload:vi.fn(),signed:vi.fn(),from:vi.fn()}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({rpc:api.rpc,auth:{getUser:api.getUser},storage:{from:api.from}})}));
const actor={tenantId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222'};
const entry={id:'33333333-3333-4333-8333-333333333333',source:'manual' as const};
const upload={id:'44444444-4444-4444-8444-444444444444',file:{name:'foto.png',type:'image/png',size:3,arrayBuffer:async()=>new Uint8Array([1,2,3]).buffer}};
const path=`${actor.tenantId}/manual/${entry.id}/${upload.id}`;
const file:DocumentationFile={id:upload.id,file_name:'foto.png',mime_type:'image/png',size_bytes:3,storage_path:path,created_at:'2026-11-06T17:00:00Z'};
beforeEach(()=>{
 vi.clearAllMocks();api.getUser.mockResolvedValue({data:{user:{id:actor.userId}}});api.upload.mockResolvedValue({data:{path},error:null});api.signed.mockResolvedValue({data:{signedUrl:'https://example.test/private-file'},error:null});api.from.mockReturnValue({upload:api.upload,createSignedUrl:api.signed});
 api.rpc.mockImplementation(async(_name,args)=>({data:args.p_action==='list'?{canUpload:true,items:[file]}:{id:upload.id,storage_path:path,state:args.p_action==='prepare'?'pending':'ready'},error:null}));
});
describe('private documentation attachments',()=>{
 it('prepares a scoped file, uploads without overwrite and requires a verified completion',async()=>{
  await uploadDocumentationFile(actor,entry,upload);expect(api.from).toHaveBeenCalledWith('office-documentation');expect(api.upload).toHaveBeenCalledWith(path,expect.any(ArrayBuffer),expect.objectContaining({upsert:false,contentType:'image/png'}));expect(api.rpc.mock.calls.map(c=>c[1].p_action)).toEqual(['prepare','complete']);
 });
 it('does not publish metadata if Storage fails',async()=>{
  api.upload.mockResolvedValue({error:{statusCode:'500',message:'offline'}});await expect(uploadDocumentationFile(actor,entry,upload)).rejects.toThrow();expect(api.rpc.mock.calls.map(c=>c[1].p_action)).toEqual(['prepare']);
 });
 it('recovers a lost Storage receipt by verifying the existing original',async()=>{
  api.upload.mockResolvedValue({error:{statusCode:'409',message:'already exists'}});await uploadDocumentationFile(actor,entry,upload);expect(api.rpc.mock.calls.at(-1)?.[1].p_action).toBe('complete');
 });
 it('does not overwrite an already confirmed file on retry',async()=>{
  api.rpc.mockResolvedValue({data:{id:upload.id,storage_path:path,state:'ready'}});await uploadDocumentationFile(actor,entry,upload);expect(api.upload).not.toHaveBeenCalled();
 });
 it('rejects redirected storage paths and changed identities before uploading',async()=>{
  api.rpc.mockResolvedValue({data:{id:upload.id,storage_path:'other-company/original',state:'pending'}});await expect(uploadDocumentationFile(actor,entry,upload)).rejects.toThrow();expect(api.upload).not.toHaveBeenCalled();
  api.getUser.mockResolvedValue({data:{user:{id:entry.id}}});api.rpc.mockClear();await expect(uploadDocumentationFile(actor,entry,upload)).rejects.toBeTruthy();expect(api.rpc).not.toHaveBeenCalled();
 });
 it('rejects empty, oversized and changed file reads',async()=>{
  for(const size of [0,52428801])await expect(uploadDocumentationFile(actor,entry,{...upload,file:{...upload.file,size}})).rejects.toThrow();
  await expect(uploadDocumentationFile(actor,entry,{...upload,file:{...upload.file,arrayBuffer:async()=>new ArrayBuffer(1)}})).rejects.toThrow();expect(api.upload).not.toHaveBeenCalled();
 });
 it('keeps a failed completion unconfirmed',async()=>{
  api.rpc.mockImplementation(async(_name,args)=>args.p_action==='complete'?{error:{code:'22023'}}:{data:{id:upload.id,storage_path:path,state:'pending'}});await expect(uploadDocumentationFile(actor,entry,upload)).rejects.toBeTruthy();
 });
 it('rejects foreign attachment lists and signs scoped files for a limited time',async()=>{
  expect((await listDocumentationFiles(actor,entry)).items).toHaveLength(1);await documentationFileUrl(actor,file,true);expect(api.signed).toHaveBeenCalledWith(path,600,{download:'foto.png'});
  api.rpc.mockResolvedValue({data:{canUpload:true,items:[{...file,storage_path:'foreign/'+file.id}]}});await expect(listDocumentationFiles(actor,entry)).rejects.toThrow();
 });
 it('never renders active SVG or HTML as inline media',()=>{
  expect(fileKind('image/svg+xml')).toBe('file');expect(fileKind('text/html')).toBe('file');expect(fileKind('application/pdf')).toBe('pdf');expect(fileKind('audio/webm')).toBe('audio');
 });
 it('reads original visit photos from their own bucket and rejects another visit folder',async()=>{
  const visit='55555555-5555-4555-8555-555555555555';const target={...entry,source:'visit' as const,visit_id:visit};
  const original={...file,storage_bucket:'office-documents' as const,storage_path:`tenant/${actor.tenantId}/assist/visits/${visit}/attachments/original.jpg`};
  api.rpc.mockResolvedValue({data:{canUpload:false,items:[original]}});expect((await listDocumentationFiles(actor,target)).items).toHaveLength(1);
  await documentationFileUrl(actor,original);expect(api.from).toHaveBeenLastCalledWith('office-documents');
  await expect(listDocumentationFiles(actor,{...target,visit_id:entry.id})).rejects.toThrow();
 });
});
