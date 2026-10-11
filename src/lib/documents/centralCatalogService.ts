import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { CentralDocumentContext, CentralDocumentSnapshot, CentralDocumentStored, CentralDocumentTarget } from '@/types/documents/centralCatalog';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { centralFileName, centralMissingFields } from './centralCatalogModel';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';

type Actor = { roleKey?: RoleKey | null; profile?: Profile | null };
const demoRecords = new Map<string, CentralDocumentStored>();
const demoFiles = new Map<string, Uint8Array>();
const demoOriginals = new Map<string, { bytes: Uint8Array; fileName: string }>();
const str = (value: unknown) => value == null ? '' : String(value);
const address = (row: Record<string, unknown>) => [
  [row.street, row.house_number].filter(Boolean).join(' '),
  [row.postal_code || row.zip, row.city].filter(Boolean).join(' '),
].filter(Boolean).join('\n');
const missingColumn = (error: { code?: string } | null) => error?.code === '42703' || error?.code === 'PGRST204';

async function loadCompanySource(client: NonNullable<ReturnType<typeof getSupabaseClient>>, tenantId: string) {
  const full = await fromUnknownTable(client, 'tenants').select('name,legal_name,street,house_number,postal_code,city,phone,email,website,vat_id,tax_number,register_court,register_number,ik_number,representative_name').eq('id', tenantId).maybeSingle();
  if (!missingColumn(full.error)) return { data: full.data as Record<string, unknown> | null, error: full.error };
  // The connected staging schema still uses company profiles. Only a confirmed
  // missing column activates this compatibility path; permissions/network errors remain errors.
  const core = await fromUnknownTable(client, 'tenants').select('name,phone,email,website').eq('id', tenantId).maybeSingle();
  if (core.error || !core.data) return { data: null, error: core.error };
  const profile = await fromUnknownTable(client, 'tenant_company_profiles').select('name,street,zip,city,phone,email,management_name,register_number,tax_id,vat_id,ik_number').eq('tenant_id', tenantId).maybeSingle();
  if (profile.error && !['42P01','PGRST205'].includes(profile.error.code)) return { data: null, error: profile.error };
  const p = (profile.data ?? {}) as Record<string, unknown>;
  return { data: { ...core.data, ...p, legal_name: p.name || core.data.name, phone: p.phone || core.data.phone, email: p.email || core.data.email, postal_code: p.zip, tax_number: p.tax_id, representative_name: p.management_name } as Record<string, unknown>, error: null };
}

async function loadClientSource(client: NonNullable<ReturnType<typeof getSupabaseClient>>, tenantId: string, entityId: string) {
  const full = await fromUnknownTable(client,'clients').select('first_name,last_name,date_of_birth,street,house_number,postal_code,city,care_level,insurance_number,cost_bearer,insurance_name').eq('tenant_id',tenantId).eq('id',entityId).maybeSingle();
  if (!missingColumn(full.error)) return full;
  return fromUnknownTable(client,'clients').select('first_name,last_name,date_of_birth,street,postal_code,zip,city,care_level,insurance_number,cost_bearer,insurance_name').eq('tenant_id',tenantId).eq('id',entityId).maybeSingle();
}

async function guard<T>(tenantId: string, actor: Actor, permission: PermissionKey): Promise<ServiceResult<T> | null> {
  const tenantError = guardServiceTenant(tenantId);
  if (tenantError) return tenantError;
  return enforceWithActor<T>(actor.roleKey, tenantId, actor.profile, permission);
}

/** Only allowlisted fields enter a snapshot: no payroll, login codes or other records. */
export function mapCentralContext(input: { tenantId: string; target: CentralDocumentTarget; entityId: string; company: Record<string, unknown>; settings?: Record<string, unknown>; subject?: Record<string, unknown> }): CentralDocumentContext {
  const t = input.company; const s = input.subject ?? {}; const settings = input.settings ?? {};
  const company = {
    name: str(t.legal_name || t.name), address: address(t), phone: str(t.phone), email: str(t.email), website: str(t.website),
    registerCourt: str(t.register_court), registerNumber: str(t.register_number), taxId: str(t.tax_number || t.tax_id), vatId: str(t.vat_id),
    ikNumber: str(t.ik_number), representativeName: str(t.representative_name), logoUrl: str(settings.logo_url),
  };
  const subject: Record<string, string> = input.target === 'company' ? { name: company.name, address: company.address } : {
    name: str(s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ')), address: address(s),
    birthDate: str(s.date_of_birth), careLevel: str(s.care_level), insuranceNumber: str(s.insurance_number),
    personnelNumber: str(s.employee_number), jobTitle: str(s.role_title || s.job_title),
  };
  return {
    tenantId: input.tenantId, target: input.target, entityId: input.entityId, company, subject,
    representative: { name: str(s.representative_name), relation: str(s.representative_relation) },
    payor: { name: str(s.cost_bearer || s.insurance_name), insuranceNumber: str(s.insurance_number) },
    employee: input.target === 'employee' ? { ...subject } : {}, sourceFetchedAt: new Date().toISOString(),
  };
}

export async function loadCentralContext(tenantId: string, target: CentralDocumentTarget, entityId: string, actor: Actor): Promise<ServiceResult<CentralDocumentContext>> {
  const denied = await guard<CentralDocumentContext>(tenantId, actor, 'documents.create'); if (denied) return denied;
  if (target !== 'company') {
    const entityDenied = await guard<CentralDocumentContext>(tenantId, actor, target === 'client' ? 'office.clients.view' : 'office.employees.view');
    if (entityDenied) return entityDenied;
  }
  if (target === 'client') {
    const sensitiveDenied = await guard<CentralDocumentContext>(tenantId,actor,'office.clients.view_sensitive');
    if (sensitiveDenied) return sensitiveDenied;
  }
  if (target === 'company' && entityId !== tenantId) return { ok: false, error: 'Die Unternehmenszuordnung stimmt nicht mit dem Mandanten überein.' };
  if (getServiceMode() !== 'supabase') {
    const [{ demoTenant, demoTenantAddress }, { demoClients }, { demoEmployees }] = await Promise.all([
      import('@/data/demo/tenant'), import('@/data/demo/clients'), import('@/data/demo/employees'),
    ]);
    const person = target === 'client' ? demoClients.find((x) => x.id === entityId) : demoEmployees.find((x) => x.id === entityId);
    if (target !== 'company' && !person) return { ok: false, error: 'Die ausgewählte Akte wurde nicht gefunden.' };
    const p = person as Record<string, unknown> | undefined;
    return { ok: true, data: mapCentralContext({ tenantId, target, entityId,
      company: { name: demoTenant.name, ...demoTenantAddress, phone: demoTenant.phone, email: demoTenant.email, website: demoTenant.website },
      subject: p ? { first_name: p.firstName, last_name: p.lastName, date_of_birth: p.dateOfBirth, street: p.street, postal_code: p.zip, city: p.city, care_level: p.careLevel, insurance_number: p.insuranceNumber, cost_bearer: p.costCarrier, role_title: p.jobTitle } : {},
    }) };
  }
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  const subjectRequest = target === 'client'
    ? loadClientSource(client,tenantId,entityId)
    : target === 'employee'
      ? fromUnknownTable(client,'employees').select('first_name,last_name,date_of_birth,street,house_number,postal_code,city,employee_number,role_title').eq('tenant_id',tenantId).eq('id',entityId).maybeSingle()
      : Promise.resolve({data:{},error:null});
  const results = await Promise.all([
    loadCompanySource(client, tenantId),
    fromUnknownTable(client, 'tenant_document_settings').select('logo_url').eq('tenant_id', tenantId).maybeSingle(),
    fromUnknownTable(client, 'tenant_addresses').select('street, zip, city').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    subjectRequest,
  ]);
  for (const result of results) if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
  if (!results[0].data || !results[3].data) return { ok: false, error: 'Unternehmen oder ausgewählte Akte wurde nicht gefunden.' };
  const tenant = results[0].data as Record<string, unknown>; const fallback = (results[2].data ?? {}) as Record<string, unknown>;
  return { ok: true, data: mapCentralContext({ tenantId, target, entityId, company: {
    ...tenant, street: tenant.street || fallback.street, postal_code: tenant.postal_code || fallback.zip, city: tenant.city || fallback.city,
  }, settings: results[1].data ?? {}, subject: results[3].data ?? {} }) };
}

function bytesBase64(bytes: Uint8Array) {
  let binary = ''; for (let start = 0; start < bytes.length; start += 16384) binary += String.fromCharCode(...bytes.subarray(start, start + 16384));
  return btoa(binary);
}

export async function saveCentralDocument(snapshot: CentralDocumentSnapshot, bytes: Uint8Array, actor: Actor, original?: { bytes: Uint8Array; fileName: string }): Promise<ServiceResult<CentralDocumentStored>> {
  const denied = await guard<CentralDocumentStored>(snapshot.context.tenantId, actor, 'documents.save_to_file'); if (denied) return denied;
  if (snapshot.context.target === 'client' || snapshot.definition.clinicalReviewRequired) {
    const clinicalDenied = await guard<CentralDocumentStored>(snapshot.context.tenantId,actor,'office.clients.view_sensitive'); if(clinicalDenied) return clinicalDenied;
  }
  if (centralMissingFields(snapshot).length) return { ok: false, error: 'Bitte die Pflichtangaben ergänzen, bevor Sie den Entwurf in der Akte speichern.' };
  if (snapshot.definition.sourceMode === 'original' && !original && !snapshot.parentDocumentId) return { ok: false, error: 'Bitte die Originalunterlage auswählen.' };
  if (bytes.byteLength > 8 * 1024 * 1024 || (original?.bytes.byteLength ?? 0) > 8 * 1024 * 1024) return { ok: false, error: 'Pro Datei sind höchstens 8 MB möglich.' };
  if (getServiceMode() !== 'supabase') {
    const parent = snapshot.parentDocumentId ? demoRecords.get(snapshot.parentDocumentId) : undefined;
    if (snapshot.parentDocumentId && (!parent || parent.tenantId !== snapshot.context.tenantId || parent.templateKey !== snapshot.definition.key || parent.snapshot.context.target !== snapshot.context.target || parent.snapshot.context.entityId !== snapshot.context.entityId || parent.revision !== snapshot.revision - 1)) return { ok: false, error: 'Die Vorgängerfassung gehört nicht zu dieser Akte oder Vorlage.' };
    const inherited = parent ? demoOriginals.get(parent.id) : undefined;
    const originalFile = original || inherited;
    if (snapshot.definition.sourceMode === 'original' && !originalFile) return { ok: false, error: 'Die Originalunterlage ist in dieser Sitzung nicht verfügbar.' };
    const record: CentralDocumentStored = {
      id: snapshot.documentId, tenantId: snapshot.context.tenantId, title: snapshot.definition.title, templateKey: snapshot.definition.key,
      revision: snapshot.revision, snapshot: JSON.parse(JSON.stringify(snapshot)), state: 'draft', pdfPath: null, pdfHash: sha256FileHex(bytes),
      originalHash: originalFile ? sha256FileHex(originalFile.bytes) : null, createdAt: new Date().toISOString(),
    };
    if (demoRecords.has(record.id)) return { ok: false, error: 'Diese Fassung ist bereits gespeichert. Bitte eine neue Fassung anlegen.' };
    demoRecords.set(record.id, record); demoFiles.set(record.id, new Uint8Array(bytes));
    if(originalFile) demoOriginals.set(record.id,{bytes:new Uint8Array(originalFile.bytes),fileName:originalFile.fileName});
    return { ok: true, data: record };
  }
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  const { data, error } = await client.functions.invoke('central-document-record', { body: {
    snapshot, pdfBase64: bytesBase64(bytes), fileName: centralFileName(snapshot),
    original: original ? { base64: bytesBase64(original.bytes), fileName: original.fileName } : null,
  } });
  if (error || !data?.ok) return { ok: false, error: data?.error || 'Der neue Dokumentendienst ist nicht erreichbar. Der Entwurf wurde nicht in der Akte gespeichert.' };
  return { ok: true, data: data.record as CentralDocumentStored };
}

export async function listCentralDocuments(tenantId: string, actor: Actor): Promise<ServiceResult<CentralDocumentStored[]>> {
  const denied = await guard<CentralDocumentStored[]>(tenantId, actor, 'office.documents.view'); if (denied) return denied;
  if (getServiceMode() !== 'supabase') {
    const clientAllowed = !(await guard(tenantId, actor, 'office.clients.view'));
    const employeeAllowed = !(await guard(tenantId, actor, 'office.employees.view'));
    const clinicalAllowed = !(await guard(tenantId, actor, 'office.clients.view_sensitive'));
    return { ok: true, data: [...demoRecords.values()].filter((r) => r.tenantId === tenantId && (!r.snapshot.definition.clinicalReviewRequired || clinicalAllowed) && (r.snapshot.context.target === 'company' || (r.snapshot.context.target === 'client' ? clientAllowed && clinicalAllowed : employeeAllowed))).map((r) => JSON.parse(JSON.stringify(r)) as CentralDocumentStored) };
  }
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  const { data, error } = await fromUnknownTable(client, 'central_document_records').select('*').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(100);
  if (error) return { ok: false, error: 'Gespeicherte Katalogdokumente konnten nicht geladen werden. Der neue Datenbankstand ist möglicherweise noch nicht aktiviert.' };
  return { ok: true, data: (data ?? []).map((r) => ({
    id: r.id, tenantId: r.tenant_id, title: r.title, templateKey: r.template_key, revision: r.revision, snapshot: r.snapshot_json,
    state: r.state, pdfPath: r.pdf_path, pdfHash: r.pdf_hash, originalPath: r.original_path, originalHash: r.original_hash, createdAt: r.created_at,
  })) };
}

export async function downloadCentralDocument(record: CentralDocumentStored, actor: Actor, original = false): Promise<ServiceResult<Uint8Array>> {
  const denied = await guard<Uint8Array>(record.tenantId, actor, 'office.documents.view'); if (denied) return denied;
  if (record.snapshot.context.target === 'client' || record.snapshot.definition.clinicalReviewRequired) {
    const clinicalDenied = await guard<Uint8Array>(record.tenantId,actor,'office.clients.view_sensitive'); if(clinicalDenied) return clinicalDenied;
  }
  if (record.snapshot.context.target !== 'company') {
    const personDenied = await guard<Uint8Array>(record.tenantId, actor, record.snapshot.context.target === 'client' ? 'office.clients.view' : 'office.employees.view'); if (personDenied) return personDenied;
  }
  if (getServiceMode() !== 'supabase') {
    const stored = demoRecords.get(record.id); const bytes = original ? demoOriginals.get(record.id)?.bytes : demoFiles.get(record.id);
    if (!stored || stored.tenantId !== record.tenantId || !bytes) return { ok: false, error: 'Keine gespeicherte Datei in dieser Demo-Sitzung.' };
    return { ok: true, data: new Uint8Array(bytes) };
  }
  const client = getSupabaseClient();
  const filePath = original ? record.originalPath : record.pdfPath; const expectedHash = original ? record.originalHash : record.pdfHash;
  if (!client || !filePath || !expectedHash) return { ok: false, error: 'Für diesen Eintrag ist keine gespeicherte Datei verfügbar.' };
  const { data, error } = await client.storage.from('office-documents').download(filePath);
  if (error || !data) return { ok: false, error: 'Die gespeicherte PDF-Datei konnte nicht geladen werden.' };
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (sha256FileHex(bytes) !== expectedHash) return { ok: false, error: 'Die Datei stimmt nicht mit dem gespeicherten Prüfwert überein.' };
  return { ok: true, data: bytes };
}
