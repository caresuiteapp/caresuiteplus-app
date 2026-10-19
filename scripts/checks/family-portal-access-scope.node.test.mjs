import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { decodeFamilyPortalAccessScope, familyPortalAllows } from '../../src/lib/portal/familyPortalAccessScope.ts';

const id = n => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const tenantId=id(1),accountId=id(2),clientId=id(3),contactId=id(4);
const row = (changes={}) => ({
  tenant_id:tenantId,account_id:accountId,client_id:clientId,relative_contact_id:contactId,
  valid_from:'2026-10-01T10:00:00.000001Z',expires_at:'2026-11-01T10:00:00.000001Z',
  can_view_appointments:true,can_view_documents:false,can_view_messages:true,
  can_send_messages:false,can_view_service_records:false,can_view_invoices:false,
  can_download_documents:false,can_confirm_appointments:false,can_sign_records:false,...changes,
});
const now=Date.parse('2026-10-14T10:00:00.000Z');

test('aktiver exakter Angehörigen-Scope bewahrt Vertretung, Laufzeit und Einzelrechte',()=>{
  const scope=decodeFamilyPortalAccessScope(row(),{tenantId,accountId},now);
  assert.equal(scope?.clientId,clientId);assert.equal(scope?.relativeContactId,contactId);
  assert.equal(familyPortalAllows(scope,'appointments'),true);assert.equal(familyPortalAllows(scope,'documents'),false);
  assert.equal(Object.isFrozen(scope),true);assert.equal(Object.isFrozen(scope?.permissions),true);
});

for(const [name,changes] of [
  ['fremder Mandant',{tenant_id:id(8)}],['fremdes Konto',{account_id:id(8)}],
  ['ungültiger Pflegefall',{client_id:'client'}],['fehlender Vertretungskontakt',{relative_contact_id:null}],
  ['zukünftiger Beginn',{valid_from:'2026-10-15T10:00:00.000001Z'}],
  ['abgelaufener Zugang',{expires_at:'2026-10-14T09:59:59.999999Z'}],
  ['Zeit ohne Mikrosekunden',{valid_from:'2026-10-01T10:00:00Z'}],
]) test(`${name} kann keinen Angehörigen-Scope öffnen`,()=>assert.equal(decodeFamilyPortalAccessScope(row(changes),{tenantId,accountId},now),null));

test('fehlende oder nicht boolesche Freigaben schließen jede betroffene Fähigkeit',()=>{
  const scope=decodeFamilyPortalAccessScope(row({can_view_appointments:'true',can_view_messages:null}),{tenantId,accountId},now);
  assert.equal(familyPortalAllows(scope,'appointments'),false);assert.equal(familyPortalAllows(scope,'messages'),false);
});

test('Live-Hook lädt Angehörigenkonto nur über den aktuellen Server-Scope',async()=>{
  const source=await readFile(new URL('../../src/hooks/usePortalActor.ts',import.meta.url),'utf8');
  assert.match(source,/roleKey === 'family_portal'[\s\S]+fetchCurrentFamilyPortalAccessScope\(tenantId, portalAccountId\)/);
  assert.match(source,/setFamilyAccess\(familyScope\)/);assert.match(source,/relativeContactId: familyScope\.relativeContactId/);
});

test('Angehörigen-Termine fallen bei Offline oder Serverfehler nie auf Altcache zurück',async()=>{
  const source=await readFile(new URL('../../src/lib/offline/assignmentCacheService.ts',import.meta.url),'utf8');
  assert.match(source,/requiresLiveFamilyGrant = roleKey === 'family_portal'/);
  assert.ok((source.match(/Angehörigenfreigabe kann offline nicht bestätigt werden/g)??[]).length>=2);
});

test('Termin-, Dokument- und Nachrichtenhooks beachten getrennte Freigaben',async()=>{
  const files=['usePortalAppointments.ts','usePortalDocuments.ts','usePortalDocumentDetail.ts','communication/usePortalMessages.ts','useportalofficemessages.ts'];
  const sources=await Promise.all(files.map(name=>readFile(new URL(`../../src/hooks/${name}`,import.meta.url),'utf8')));
  assert.match(sources[0],/familyPortalAllows\(familyAccess, 'appointments'\)/);
  assert.match(sources[1],/familyPortalAllows\(familyAccess, 'documents'\)/);
  assert.match(sources[2],/familyPortalAllows\(familyAccess, 'download_documents'\)/);
  assert.match(sources[3],/familyPortalAllows\(familyAccess, 'messages'\)/);
  assert.match(sources[4],/familyPortalAllows\(familyAccess, 'messages'\)/);
});

test('SQL bindet Scope an JWT-Typ, exaktes Konto, auth.uid, Aktivstatus und Laufzeit',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014103000_family_portal_access_scope.sql',import.meta.url),'utf8');
  for(const pattern of [/portal_type'\) = 'relative'/,/rpc\.id = public\.current_portal_account_id\(\)/,/rpc\.auth_user_id = auth\.uid\(\)/,/rpc\.status = 'active'/,/rpc\.expires_at > CURRENT_TIMESTAMP/])assert.match(sql,pattern);
  assert.ok((sql.match(/YYYY-MM-DD"T"HH24:MI:SS\.US"Z"/g)??[]).length>=2);
});

test('SQL verlangt aktuellen Freigabesatz und kennt keine unbekannte Fähigkeit',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014103000_family_portal_access_scope.sql',import.meta.url),'utf8');
  assert.match(sql,/portal_access_permissions p/);assert.match(sql,/p\.portal_type = 'relative'/);
  assert.match(sql,/p\.portal_account_id = rpc\.id/);assert.match(sql,/ELSE false/);
});

test('SQL entzieht öffentliche Ausführung und gibt nur authenticated frei',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014103000_family_portal_access_scope.sql',import.meta.url),'utf8');
  assert.match(sql,/REVOKE ALL ON FUNCTION public\.current_family_portal_access_scope\(\) FROM PUBLIC, anon/);
  assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.family_portal_has_capability\(text, uuid, uuid\) TO authenticated/);
});

test('Rohdaten der Freigaben bleiben Portalrollen verschlossen',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014103000_family_portal_access_scope.sql',import.meta.url),'utf8');
  assert.match(sql,/DROP POLICY IF EXISTS portal_access_permissions_tenant_isolation/);
  assert.match(sql,/CREATE POLICY portal_access_permissions_business_management/);
  assert.match(sql,/public\.has_permission\('office\.access'\) OR public\.is_tenant_admin\(\)/);
});

test('Direkte Dokument-, Termin- und Nachrichten-RLS nutzt die Serverfähigkeit',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014103000_family_portal_access_scope.sql',import.meta.url),'utf8');
  for(const cap of ['documents','appointments','messages','send_messages'])assert.match(sql,new RegExp(`portal_actor_has_capability\\('${cap}'`));
  for(const policy of ['client_documents_portal_select','assist_visits_portal_client_select','message_threads_portal_client_select','messages_portal_insert'])assert.match(sql,new RegExp(`CREATE POLICY ${policy}`));
});

test('bestehende Mitarbeitenden-Nachrichtenpfade bleiben in den ersetzten Policies erhalten',async()=>{
  const sql=await readFile(new URL('../../supabase/migrations/20261014103000_family_portal_access_scope.sql',import.meta.url),'utf8');
  assert.match(sql,/mt\.thread_type = 'employee'/);assert.match(sql,/mt\.thread_type = 'employee_group'/);
  assert.match(sql,/public\.resolve_current_employee_id\(\)/);
});
