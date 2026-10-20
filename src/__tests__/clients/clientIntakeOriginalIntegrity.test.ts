import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EMPTY_CLIENT_INTAKE_FORM } from '@/types/forms/clientIntakeForm';
import { applyDocumentSignature, finalizeDocument, openDocumentPreview, syncIntakeDocumentsWithTemplates } from '@/features/intakeDocuments/intakeDocumentService';
import { getSystemIntakeTemplateByKey } from '@/features/intakeDocuments/intakeDocumentSystemTemplates';
const f=vi.hoisted(()=>({ rows: [] as Record<string,unknown>[], signatures: [] as Record<string,unknown>[], writes: [] as {table:string,operation:string,value:any}[], eventError:false, lookupError:false, collision:null as Record<string,unknown>|null }));
vi.mock('@/lib/supabase/client',()=>({ getSupabaseClient:()=>({from:(table:string)=>{
  let operation='read'; let value:any; let single=false; const filters:Record<string,unknown>={};
  const result=()=>{
    if(operation!=='read')return {data:{id:'saved-id'},error:f.eventError&&table==='client_document_events'?{message:'audit failed'}:null};
    if(table==='client_intake_documents')return {data:single?{id:'intake-id'}:f.rows,error:single&&f.lookupError?{message:'lookup failed'}:null};
    if(table==='client_document_signatures')return {data:f.signatures,error:null};
    if(table==='client_documents')return {data:filters.file_name?f.collision:null,error:null};
    return {data:null,error:null};
  };
  const chain:any={select:()=>chain,eq:(key:string,v:unknown)=>{filters[key]=v;return chain;},in:()=>chain,
    insert:(v:any)=>{operation='insert';value=v;f.writes.push({table,operation,value});return chain;},
    update:(v:any)=>{operation='update';value=v;f.writes.push({table,operation,value});return chain;},
    upsert:(v:any)=>{operation='upsert';value=v;f.writes.push({table,operation,value});return chain;},
    single:async()=>{single=true;return result();},maybeSingle:async()=>result(),then:(resolve:any)=>Promise.resolve(result()).then(resolve)};
  return chain;
}})}));
import { persistIntakeDocumentsForClient, promoteFinalizedIntakeDocumentsToClientRecord, loadPersistedIntakeDocumentsForClient } from '@/features/intakeDocuments/intakeDocumentRepository';
const form={...EMPTY_CLIENT_INTAKE_FORM,firstName:'Original',lastName:'Person',street:'Straße',houseNumber:'1',zip:'10115',city:'Berlin',dateOfBirth:'1980-01-01',admissionDate:'2026-01-01'};
const template=getSystemIntakeTemplateByKey('privacy_consent_default')!;
const signature={role:'client' as const,dataUrl:'data:image/png;base64,original',signedAt:'2026-10-11T10:00:00Z'};
function finalDoc(){return applyDocumentSignature(openDocumentPreview(form,template),template,form,'client',signature);}
function seedLocked(){const d=finalDoc();f.rows=[{id:'intake-id',template_key:d.templateKey,document_type:d.documentType,title:d.title,status:d.status,is_required:d.isRequired,version:d.version,source:d.source,tenant_template_id:d.tenantTemplateId,preview_html:d.previewHtml,finalized_html:d.finalizedHtml,rendered_pdf_path:d.renderedPdfPath,missing_placeholders:d.missingPlaceholders,preview_opened_at:d.previewOpenedAt,finalized_at:d.finalizedAt}];f.signatures=[{document_id:'intake-id',signer_role:'client',signature_data:signature.dataUrl,signed_at:signature.signedAt,signer_name:null}];return d;}
beforeEach(()=>{f.rows=[];f.signatures=[];f.writes=[];f.eventError=false;f.lookupError=false;f.collision=null;});
describe('intake signatures remain bound to their reviewed original',()=>{
  it('keeps a final original, signature and version when form or template changes',()=>{
    const d=finalDoc();expect(d.status).toBe('finalized');
    const changed={...template,version:template.version+1,htmlContent:'<p>Anderer Vertrag</p>'};
    expect(syncIntakeDocumentsWithTemplates({...form,intakeDocuments:[d]},[changed])[0]).toBe(d);
    expect(finalizeDocument(d,changed,{...form,firstName:'Changed'})).toEqual({ok:true,document:d});
    expect(applyDocumentSignature(d,changed,form,'client',{...signature,dataUrl:'replacement'})).toBe(d);
  });
  it('does not transfer a partial signature to changed fields or a changed template',()=>{
    const t={...template,signatureSlots:[...template.signatureSlots,{role:'employee' as const,placeholder:'signature.employee',required:true}]};
    const partial=applyDocumentSignature(openDocumentPreview(form,t),t,form,'client',signature);
    const changed={...form,firstName:'Changed',intakeDocuments:[partial]};
    const preview=openDocumentPreview(changed,t);expect(preview.previewHtml).toBe(partial.previewHtml);expect(preview.missingPlaceholders.join(' ')).toContain('Original');
    const next=applyDocumentSignature(preview,t,changed,'employee',{...signature,role:'employee'});
    expect(next.signatures.employee).toBeUndefined();expect(next.signatures.client).toBe(signature);
    expect(finalizeDocument(next,t,changed).ok).toBe(false);
  });
  it('refuses a changed persisted original before contract, signature or consent writes',async()=>{
    const d=seedLocked();expect((await persistIntakeDocumentsForClient('tenant','client',{...form,intakeDocuments:[{...d,finalizedHtml:'changed'}]})).ok).toBe(false);expect(f.writes).toEqual([]);
  });
  it('blocks an unverified signed retry instead of silently completing old split writes',async()=>{
    const d=seedLocked();expect((await persistIntakeDocumentsForClient('tenant','client',{...form,intakeDocuments:[d]})).ok).toBe(false);
    expect(f.writes.some(w=>w.table==='client_intake_documents'||w.table==='client_document_signatures'||w.table==='client_document_events')).toBe(false);
  });
  it('blocks legacy final HTML/timestamps even when the old status and missing captures do not say finalized',async()=>{
    for(const marker of [{finalizedAt:'2026-10-11T10:00:00Z'},{finalizedHtml:'<p>Original</p>'}]){
      const legacy={...openDocumentPreview(form,template),...marker};
      expect((await persistIntakeDocumentsForClient('tenant','client',{...form,intakeDocuments:[legacy]})).ok).toBe(false);
      expect(f.writes).toEqual([]);
    }
  });
  it('keeps unsigned remote document drafts usable without creating signature evidence',async()=>{
    const unsigned=openDocumentPreview(form,template);
    expect((await persistIntakeDocumentsForClient('tenant','client',{...form,intakeDocuments:[unsigned]})).ok).toBe(true);
    expect(f.writes.some(w=>w.table==='client_intake_documents')).toBe(true);
    expect(f.writes.some(w=>w.table==='client_document_signatures')).toBe(false);
  });
  it('does not infer completed state from one unbound capture',async()=>{
    seedLocked();f.rows[0].status='preview_open';const loaded=await loadPersistedIntakeDocumentsForClient('tenant','client');if(!loaded.ok)throw Error(loaded.error);expect(loaded.data[0].status).toBe('preview_open');
  });
  it('reports an audit persistence error rather than successful evidence storage',async()=>{
    f.eventError=true;const unsigned=openDocumentPreview(form,template);expect((await persistIntakeDocumentsForClient('tenant','client',{...form,intakeDocuments:[unsigned]})).ok).toBe(false);
    expect(f.writes.some(w=>w.table==='client_consent_status')).toBe(false);
  });
  it('does not skip a missing intake version or relink an unrelated file by its name',async()=>{
    const d=finalDoc();f.lookupError=true;expect((await promoteFinalizedIntakeDocumentsToClientRecord('tenant','client',{...form,intakeDocuments:[d]})).ok).toBe(false);
    f.lookupError=false;f.collision={id:'foreign-original',source:'portal_upload',mime_type:'application/pdf',intake_document_id:null};expect((await promoteFinalizedIntakeDocumentsToClientRecord('tenant','client',{...form,intakeDocuments:[d]})).ok).toBe(false);
    expect(f.writes.filter(w=>w.table==='client_documents')).toEqual([]);
  });
  it('archives a partial signature as confirmed, without falsely labeling it completed',async()=>{
    const d={...finalDoc(),status:'pending_signature' as const,finalizedHtml:null};expect((await promoteFinalizedIntakeDocumentsToClientRecord('tenant','client',{...form,intakeDocuments:[d]})).ok).toBe(true);
    expect(f.writes.find(w=>w.table==='client_documents')?.value.status).toBe('bestaetigt');
  });
});
