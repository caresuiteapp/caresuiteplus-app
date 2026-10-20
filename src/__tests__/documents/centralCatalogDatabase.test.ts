import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { createCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import { mapCentralContext } from '@/lib/documents/centralCatalogService';

const T1='11111111-1111-4111-8111-111111111111', T2='22222222-2222-4222-8222-222222222222';
const C1='33333333-3333-4333-8333-333333333333', C2='44444444-4444-4444-8444-444444444444';
const A1='55555555-5555-4555-8555-555555555555', E1='66666666-6666-4666-8666-666666666666';
const ID='77777777-7777-4777-8777-777777777777', HASH='a'.repeat(64);
let db: PGlite;
const base = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
CREATE SCHEMA auth; CREATE SCHEMA storage;
CREATE TABLE storage.buckets(id text PRIMARY KEY,public boolean NOT NULL DEFAULT false);
INSERT INTO storage.buckets(id,public) VALUES ('office-documents',false);
CREATE FUNCTION public.current_tenant_id() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.tenant',true),'')::uuid $$;
CREATE FUNCTION public.has_permission(p_permission_key text) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT p_permission_key=ANY(string_to_array(current_setting('app.permissions',true),',')) $$;
CREATE FUNCTION storage.foldername(text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$ SELECT (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
CREATE TABLE public.tenants(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.clients(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.employees(id uuid PRIMARY KEY,tenant_id uuid);
CREATE TABLE public.generated_documents(id uuid PRIMARY KEY,tenant_id uuid,title text,document_type text,status text,client_id uuid,employee_id uuid,template_version integer,document_number text,file_name text,generated_content_json jsonb,autofill_snapshot_json jsonb,pdf_path text,created_by uuid);
ALTER TABLE public.generated_documents ADD CONSTRAINT generated_documents_document_type_check CHECK (document_type IN ('contract','invoice','leistungsnachweis','generic'));
CREATE TABLE public.client_documents(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,tenant_id uuid,client_id uuid,title text,file_name text,mime_type text,category text,storage_path text,status text,sensitivity text,uploaded_by uuid);
CREATE TABLE public.employee_documents(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,tenant_id uuid,employee_id uuid,title text,file_name text,category text,storage_path text,sensitive boolean,released_to_portal boolean DEFAULT false);
CREATE TABLE storage.objects(bucket_id text,name text);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY legacy_bucket ON storage.objects FOR ALL TO authenticated USING(true) WITH CHECK(true);
GRANT USAGE ON SCHEMA public,storage TO authenticated,service_role;
GRANT SELECT,INSERT,UPDATE,DELETE ON storage.objects TO authenticated,service_role;
GRANT SELECT,INSERT ON ALL TABLES IN SCHEMA public TO service_role;
INSERT INTO public.tenants VALUES ('${T1}'),('${T2}');
INSERT INTO public.profiles VALUES ('${A1}','${T1}');
INSERT INTO public.clients VALUES ('${C1}','${T1}'),('${C2}','${T2}');
INSERT INTO public.employees VALUES ('${E1}','${T1}');
`;
const makeSnapshot = (target: 'client' | 'company' | 'employee' = 'client', id = ID) => {
  const d = CENTRAL_DOCUMENT_CATALOG.find((x) => x.target === target && x.sourceMode === 'create')!;
  const c = mapCentralContext({ tenantId:T1,target,entityId:target==='client'?C1:target==='employee'?E1:T1,company:{name:'Firma',street:'Straße 1',city:'Berlin'},subject:{first_name:'Anna',last_name:'Muster',street:'Weg 1',city:'Berlin'} });
  const s = createCentralSnapshot(d,c,'Fachkraft',id); d.fields.forEach((f) => { if (!s.values[f.key]) s.values[f.key]='Prüfangabe'; }); return s;
};
const register = async (snapshot: ReturnType<typeof makeSnapshot>) => {
  const path=`tenant/${T1}/central-documents/${snapshot.documentId}/draft.pdf`;
  return db.query('SELECT public.register_central_document($1::jsonb,$2::uuid,$3,$4,$5) AS record',[JSON.stringify(snapshot),A1,path,HASH,HASH]);
};

describe('central catalogue transactional database and RLS', () => {
  beforeAll(async () => {
    db = new PGlite(); await db.exec(base);
    await db.exec(readFileSync('supabase/schema/central_document_catalog.sql','utf8'));
    await db.exec(readFileSync('supabase/schema/central_document_catalog_seed.sql','utf8'));
  },30000);
  afterAll(async () => { await db?.close(); });
  it('database seed exactly matches all versioned UI definitions', async () => {
    const result=await db.query<{definition_json:unknown}>('SELECT definition_json FROM public.central_document_catalog ORDER BY template_key');
    const defs = [...CENTRAL_DOCUMENT_CATALOG].sort((a,b)=>a.key.localeCompare(b.key));
    expect(result.rows.map((r)=>r.definition_json)).toEqual(defs);
  });
  it('registers a draft and the correct client record in one transaction', async () => {
    await db.exec('SET ROLE service_role');
    try { await register(makeSnapshot()); } finally { await db.exec('RESET ROLE'); }
    const record=await db.query<{state:string;client_document_id:string;pdf_hash:string}>('SELECT * FROM public.central_document_records WHERE id=$1',[ID]);
    expect(record.rows[0].state).toBe('draft'); expect(record.rows[0].pdf_hash).toBe(HASH);
    const archive=await db.query<{client_id:string;status:string}>('SELECT * FROM public.client_documents WHERE id=$1',[record.rows[0].client_document_id]);
    expect(archive.rows[0].client_id).toBe(C1); expect(archive.rows[0].status).toBe('entwurf');
    const namedFile = await db.query<{file_name:string}>('SELECT file_name FROM public.client_documents WHERE id=$1',[record.rows[0].client_document_id]);
    expect(namedFile.rows[0].file_name).toContain(ID); expect(namedFile.rows[0].file_name).toContain('_v1_ENTWURF.pdf');
  });
  it('rejects foreign persons, forged definitions and invalid predecessor versions without partial archives', async () => {
    const invalid=makeSnapshot('client','88888888-8888-4888-8888-888888888888'); invalid.context.entityId=C2;
    await db.exec('SET ROLE service_role');
    try {
      await expect(register(invalid)).rejects.toThrow('Akte gehört nicht');
      invalid.context.entityId=C1; invalid.definition.title='Forged';
      await expect(register(invalid)).rejects.toThrow('Vorlagenfassung fehlt');
      const revision=makeSnapshot('client','88888888-8888-4888-8888-888888888888'); revision.revision=3; revision.parentDocumentId=ID;
      await expect(register(revision)).rejects.toThrow('Vorgängerfassung');
    } finally { await db.exec('RESET ROLE'); }
    const archive=await db.query<{n:number}>('SELECT count(*)::integer AS n FROM public.client_documents'); expect(archive.rows[0].n).toBe(1);
  });
  it('creates employee drafts without portal release and prevents in-place changes even for table owner', async () => {
    await db.exec('SET ROLE service_role');
    try { await register(makeSnapshot('employee','99999999-9999-4999-8999-999999999999')); } finally { await db.exec('RESET ROLE'); }
    const archive=await db.query<{released_to_portal:boolean;sensitive:boolean}>('SELECT * FROM public.employee_documents');
    expect(archive.rows[0].released_to_portal).toBe(false); expect(archive.rows[0].sensitive).toBe(true);
    await expect(db.exec(`UPDATE public.central_document_records SET title='Changed' WHERE id='${ID}'`)).rejects.toThrow('unveränderlich');
    await expect(db.exec(`UPDATE public.generated_documents SET status='finalized' WHERE id='${ID}'`)).rejects.toThrow('unveränderlich');
    await expect(db.exec(`UPDATE public.client_documents SET storage_path='forged.pdf'`)).rejects.toThrow('unveränderlich');
  });
  it('hides foreign tenant and employee records and denies direct write RPCs', async () => {
    await db.query("SELECT set_config('app.tenant',$1,false),set_config('app.permissions','office.documents.view,office.clients.view,office.clients.view_sensitive',false)",[T1]);
    await db.exec('SET ROLE authenticated');
    try {
      const records=await db.query('SELECT * FROM public.central_document_records'); expect(records.rows).toHaveLength(1);
      await expect(register(makeSnapshot())).rejects.toThrow('permission denied');
      await expect(db.exec("INSERT INTO public.central_document_catalog VALUES ('forged',1,'X','x','client','create','approved','{}',now())")).rejects.toThrow('permission denied');
      await db.query("SELECT set_config('app.tenant',$1,false)",[T2]);
      expect((await db.query('SELECT * FROM public.central_document_records')).rows).toHaveLength(0);
    } finally { await db.exec('RESET ROLE'); }
  });
  it('constrains older broad storage policies: no overwrite/delete or foreign record reads', async () => {
    const path=`tenant/${T1}/central-documents/${ID}/draft.pdf`;
    await db.query('INSERT INTO storage.objects VALUES ($1,$2)',['office-documents',path]);
    await db.query('INSERT INTO storage.objects VALUES ($1,$2)',['office-documents',`tenant/${T2}/central-documents/${ID}/draft.pdf`]);
    await db.query("SELECT set_config('app.tenant',$1,false),set_config('app.permissions','office.documents.view,office.clients.view,office.clients.view_sensitive',false)",[T1]);
    await db.exec('SET ROLE authenticated');
    try {
      expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(1);
      await expect(db.query('INSERT INTO storage.objects VALUES ($1,$2)',['office-documents',path])).rejects.toThrow('row-level security');
      await db.query('DELETE FROM storage.objects WHERE name=$1',[path]);
    } finally { await db.exec('RESET ROLE'); }
    expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(2);
  });
  it('keeps unrelated legacy archive updates working',async()=>{
    const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await db.query('INSERT INTO public.client_documents(id,tenant_id,client_id,title) VALUES ($1,$2,$3,$4)',[id,T1,C1,'Legacy']);
    await db.query('UPDATE public.client_documents SET title=$1 WHERE id=$2',['Corrected legacy title',id]);
    const result=await db.query<{title:string}>('SELECT title FROM public.client_documents WHERE id=$1',[id]);
    expect(result.rows[0].title).toBe('Corrected legacy title');
  });
  it('protects even nonclinical client documents under the restricted archive permission',async()=>{
    await db.query("SELECT set_config('app.tenant',$1,false),set_config('app.permissions','office.documents.view,office.clients.view',false)",[T1]);
    await db.exec('SET ROLE authenticated');
    try {
      expect((await db.query('SELECT * FROM public.central_document_records')).rows).toHaveLength(0);
      expect((await db.query('SELECT * FROM storage.objects')).rows).toHaveLength(0);
      expect((await db.query('SELECT * FROM public.central_document_catalog')).rows).toHaveLength(450);
    } finally {await db.exec('RESET ROLE');}
  });
});
