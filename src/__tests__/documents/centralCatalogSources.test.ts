import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ rows: {} as Record<string,Record<string,unknown>>, selections: [] as string[], tenantError: '', fileBytes:new Uint8Array(), downloadedPath:'' }));
vi.mock('@/lib/services/mode',()=>({getServiceMode:()=> 'supabase'}));
vi.mock('@/lib/services/liveServiceGuard',()=>({guardServiceTenant:()=>null}));
vi.mock('@/lib/permissions/actorPermissions',()=>({enforceWithActor:async()=>null}));
vi.mock('@/lib/supabase/client',()=>({getSupabaseClient:()=>({storage:{from:()=>({download:async(path:string)=>{fixture.downloadedPath=path;return {data:new Blob([fixture.fileBytes]),error:null};}})}})}));
vi.mock('@/lib/supabase/untypedTable',()=>({fromUnknownTable:(_client:unknown,table:string)=>{
  let columns='';
  const result = () => {
    if(table==='tenants'&&fixture.tenantError) return {data:null,error:{code:fixture.tenantError,message:'source denied'}};
    const row=fixture.rows[table];
    if(!row)return {data:null,error:{code:'42P01',message:'relation unavailable'}};
    const keys=columns.split(',').map((v)=>v.trim());
    if(keys.some((key)=>!(key in row)))return {data:null,error:{code:'42703',message:'column unavailable'}};
    return {data:Object.fromEntries(keys.map((key)=>[key,row[key]])),error:null};
  };
  const request = {
    select:(value:string)=>{columns=value;fixture.selections.push(`${table}:${value}`);return request;},
    eq:()=>request, order:()=>request, limit:()=>request,
    maybeSingle:async()=>result(),
    then:(resolve:(value:unknown)=>unknown)=>{const value=result();return Promise.resolve({...value,data:value.data?[value.data]:null}).then(resolve);},
  };return request;
}}));
import { loadCentralContext, downloadCentralDocument, mapCentralContext } from '@/lib/documents/centralCatalogService';
import { createCentralSnapshot } from '@/lib/documents/centralCatalogModel';
import { CENTRAL_DOCUMENT_CATALOG } from '@/data/seeds/documentCatalog/centralCatalog';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';
import type { CentralDocumentStored } from '@/types/documents/centralCatalog';

const T='11111111-1111-4111-8111-111111111111', C='22222222-2222-4222-8222-222222222222';
beforeEach(()=>{
  fixture.selections=[];fixture.tenantError='';fixture.fileBytes=new Uint8Array();fixture.downloadedPath='';
  fixture.rows={
    tenants:{name:'Pflegefirma',legal_name:'Pflegefirma GmbH',street:'Parkstraße',house_number:'12',postal_code:'10115',city:'Berlin',phone:'030',email:'firma@example.test',website:'example.test',vat_id:'VAT',tax_number:'TAX',register_court:'AG Berlin',register_number:'HRB 0',ik_number:'IK0',representative_name:'Anna Leitung'},
    tenant_document_settings:{logo_url:'https://example.test/logo.png'},
    tenant_addresses:{street:'Nebenstraße 1',zip:'10117',city:'Berlin'},
    clients:{first_name:'Mara',last_name:'Muster',date_of_birth:'1948-03-19',street:'Blumenstraße',house_number:'8',postal_code:'10117',city:'Berlin',care_level:2,insurance_number:'K0',cost_bearer:'Pflegekasse',insurance_name:'Kasse',notes:'not in snapshot'},
  };
});
describe('central source loading against connected schema variants',()=>{
  it('loads the production column shape with separate company and person addresses',async()=>{
    const result=await loadCentralContext(T,'client',C,{roleKey:'business_admin'});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.data.company.address).toBe('Parkstraße 12\n10115 Berlin');
    expect(result.data.company.registerCourt).toBe('AG Berlin');
    expect(result.data.subject.address).toBe('Blumenstraße 8\n10117 Berlin');
    expect(JSON.stringify(result.data)).not.toContain('not in snapshot');
  });
  it('handles staging company profiles and client ZIP without requesting all row data',async()=>{
    fixture.rows.tenants={name:'Pflegefirma',phone:'030',email:'firma@example.test',website:'example.test'};
    fixture.rows.tenant_company_profiles={name:'Pflegefirma GmbH',street:'Profilstraße 2',zip:'10115',city:'Berlin',phone:'030',email:'firma@example.test',management_name:'Anna Leitung',register_number:'HRB 0',tax_id:'TAX',vat_id:'VAT',ik_number:'IK0'};
    delete fixture.rows.clients.house_number;fixture.rows.clients.postal_code='';fixture.rows.clients.zip='10117';fixture.rows.clients.street='Blumenstraße 8';
    const result=await loadCentralContext(T,'client',C,{roleKey:'business_admin'});
    expect(result.ok).toBe(true);if(!result.ok)return;
    expect(result.data.company.name).toBe('Pflegefirma GmbH');
    expect(result.data.company.address).toBe('Profilstraße 2\n10115 Berlin');
    expect(result.data.company.representativeName).toBe('Anna Leitung');
    expect(result.data.subject.address).toBe('Blumenstraße 8\n10117 Berlin');
    expect(fixture.selections.some((s)=>s.includes('*'))).toBe(false);
  });
  it('does not treat a permission error as schema drift',async()=>{
    fixture.tenantError='42501';
    const result=await loadCentralContext(T,'client',C,{roleKey:'business_admin'});
    expect(result.ok).toBe(false);
    expect(fixture.selections.filter((s)=>s.startsWith('tenants:'))).toHaveLength(1);
    expect(fixture.selections.some((s)=>s.startsWith('tenant_company_profiles:'))).toBe(false);
  });
  it('downloads the original separately and rejects altered binary bytes',async()=>{
    const snapshot=createCentralSnapshot(CENTRAL_DOCUMENT_CATALOG[0],mapCentralContext({tenantId:T,target:'client',entityId:C,company:{name:'Firma'},subject:{first_name:'Mara'}}),'Anna',C);
    fixture.fileBytes=new TextEncoder().encode('%PDF-1.7\noriginal\n%%EOF');
    const record:CentralDocumentStored={id:C,tenantId:T,title:snapshot.definition.title,templateKey:snapshot.definition.key,revision:1,snapshot,state:'draft',pdfPath:'draft.pdf',pdfHash:'a'.repeat(64),originalPath:'original.pdf',originalHash:sha256FileHex(fixture.fileBytes),createdAt:snapshot.createdAt};
    const result=await downloadCentralDocument(record,{roleKey:'business_admin'},true);
    expect(result.ok).toBe(true);expect(fixture.downloadedPath).toBe('original.pdf');
    fixture.fileBytes[5]=255;
    const changed=await downloadCentralDocument(record,{roleKey:'business_admin'},true);
    expect(changed.ok).toBe(false);
  });
});
