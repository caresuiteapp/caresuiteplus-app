import { blobBytes } from '@/lib/platform/blobBytes';
import type { Profile, RoleKey, ServiceResult } from '@/types';
import type { PermissionKey } from '@/types/permissions';
import type { CentralDocumentContext, CentralDocumentDefinition, CentralDocumentSnapshot, CentralDocumentStored, CentralDocumentTarget } from '@/types/documents/centralCatalog';
import { getServiceMode } from '@/lib/services/mode';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { enforceWithActor } from '@/lib/permissions/actorPermissions';
import { enforcePermission } from '@/lib/permissions';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { centralFileName, centralMissingFields } from './centralCatalogModel';
import { sha256FileHex } from '@/lib/crypto/sha256Hex';
import { Platform } from 'react-native';
import { loadCanonicalCompanyDocumentData, loadCompanyDocumentCustomValues } from './companyDocumentContext';

type Actor = { roleKey?: RoleKey | null; profile?: Profile | null; effectivePermissions?: readonly PermissionKey[] };
export type CentralContextRequest = { definition?: CentralDocumentDefinition; assignmentId?: string; invoiceId?: string; medicationId?: string; woundId?: string; period?: string };
export type CentralDocumentRecordFilter = { target: CentralDocumentTarget; entityId: string };
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
  if (actor.effectivePermissions) return enforcePermission<T>(actor.roleKey, permission, { effectivePermissions: actor.effectivePermissions });
  return enforceWithActor<T>(actor.roleKey, tenantId, actor.profile, permission);
}

/** Only allowlisted fields enter a snapshot: no payroll, login codes or other records. */
export function mapCentralContext(input: { tenantId: string; target: CentralDocumentTarget; entityId: string; company: Record<string, unknown>; settings?: Record<string, unknown>; subject?: Record<string, unknown>; representative?: Record<string, unknown> }): CentralDocumentContext {
  const t = input.company; const s = input.subject ?? {}; const settings = input.settings ?? {};
  const company = {
    name: str(t.legal_name || t.name), address: address(t), phone: str(t.phone), email: str(t.email), website: str(t.website),
    registerCourt: str(t.register_court), registerNumber: str(t.register_number), taxId: str(t.tax_number || t.tax_id), vatId: str(t.vat_id),
    ikNumber: str(t.ik_number), representativeName: str(t.representative_name), logoUrl: str(settings.logo_url),
    bankName: str(settings.bank_name), iban: str(settings.iban), bic: str(settings.bic), ...(Platform.OS === 'web' ? { accountHolder: str(settings.account_holder) } : {}),
  };
  const subject: Record<string, string> = input.target === 'company' ? { name: company.name, address: company.address } : {
    name: str(s.full_name || [s.first_name, s.last_name].filter(Boolean).join(' ')), address: address(s),
    birthDate: str(s.date_of_birth), careLevel: str(s.care_level), insuranceNumber: str(s.insurance_number),
    personnelNumber: str(s.employee_number), jobTitle: str(s.role_title || s.job_title),
    serviceStart: str(s.service_start || s.admission_date), email: str(s.email), phone: str(s.phone || s.mobile),
  };
  return {
    tenantId: input.tenantId, target: input.target, entityId: input.entityId, company, subject,
    representative: { name: str(input.representative?.full_name || [input.representative?.first_name, input.representative?.last_name].filter(Boolean).join(' ') || s.representative_name), relation: str(input.representative?.relationship || s.representative_relation), address: input.representative ? address(input.representative) : '' },
    payor: { name: str(s.cost_bearer || s.insurance_name), insuranceNumber: str(s.insurance_number) },
    employee: input.target === 'employee' ? { ...subject, entryDate: str(s.entry_date), exitDate: str(s.exit_date), qualification: str(s.qualification), weeklyHours: str(s.weekly_hours) } : {}, sourceFetchedAt: new Date().toISOString(),
  };
}

export async function loadCentralContext(tenantId: string, target: CentralDocumentTarget, entityId: string, actor: Actor, request: CentralContextRequest = {}): Promise<ServiceResult<CentralDocumentContext>> {
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
  const canonicalRequest = Platform.OS === 'web' ? loadCanonicalCompanyDocumentData(client, tenantId) : null;
  const results = await Promise.all([
    loadCompanySource(client, tenantId),
    fromUnknownTable(client, 'tenant_document_settings').select('logo_url').eq('tenant_id', tenantId).maybeSingle(),
    fromUnknownTable(client, 'tenant_addresses').select('street, zip, city').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    subjectRequest,
  ]);
  const canonical = await canonicalRequest;
  if (canonical && !canonical.ok) return canonical;
  for (const [index, result] of results.entries()) {
    const companyHasAddressFields = Platform.OS === 'web' && results[0].data && ['street', 'postal_code', 'city'].every(key => key in results[0].data!);
    const unusedLegacySource = index === 1 && canonical?.ok && canonical.data.brandingAvailable || index === 2 && companyHasAddressFields;
    if (result.error && !unusedLegacySource) return { ok: false, error: toGermanSupabaseError(result.error) };
  }
  if (!results[0].data || !results[3].data) return { ok: false, error: 'Unternehmen oder ausgewählte Akte wurde nicht gefunden.' };
  const tenant = results[0].data as Record<string, unknown>; const fallback = (results[2].data ?? {}) as Record<string, unknown>;
  const context = mapCentralContext({ tenantId, target, entityId, company: {
    ...tenant,
    street: Platform.OS === 'web' && 'street' in tenant ? tenant.street : tenant.street || fallback.street,
    postal_code: Platform.OS === 'web' && 'postal_code' in tenant ? tenant.postal_code : tenant.postal_code || fallback.zip,
    city: Platform.OS === 'web' && 'city' in tenant ? tenant.city : tenant.city || fallback.city,
    ...(canonical?.ok && canonical.data.representativeName !== undefined ? { representative_name: canonical.data.representativeName } : {}),
  }, settings: { ...(results[1].data ?? {}), ...(canonical?.ok ? canonical.data.settings : {}) }, subject: results[3].data ?? {} });
  if (Platform.OS === 'web' && request.definition) {
    const customKeys = request.definition.fields.flatMap(field => {
      const match = field.sourcePath?.match(/^(?:tenant\.)?custom\.([a-z][a-z0-9_]*)$/);
      return match ? [match[1]] : [];
    });
    if (customKeys.length && !(await guard(tenantId, actor, 'business.tenant.manage'))) {
      const custom = await loadCompanyDocumentCustomValues(client, tenantId, customKeys, request.definition.modules);
      if (!custom.ok) return custom;
      context.custom = custom.data;
    }
  }
  return enrichCentralContext(client, context, actor, request);
}

async function enrichCentralContext(client: NonNullable<ReturnType<typeof getSupabaseClient>>, context: CentralDocumentContext, actor: Actor, request: CentralContextRequest): Promise<ServiceResult<CentralDocumentContext>> {
  const { tenantId, target, entityId } = context;
  const definition = request.definition;
  if (!definition) return { ok: true, data: context };
  if (definition.target !== target) return { ok: false, error: 'Vorlage und Aktenart stimmen nicht überein.' };
  if (target === 'employee') {
    let result = await fromUnknownTable(client, 'employees').select('entry_date,exit_date,qualification,weekly_hours').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    if (missingColumn(result.error)) result = await fromUnknownTable(client, 'employees').select('entry_date,exit_date,weekly_hours').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle();
    if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
    if (result.data) context.employee = { ...context.employee, entryDate: str(result.data.entry_date), exitDate: str(result.data.exit_date), qualification: str(result.data.qualification), weeklyHours: str(result.data.weekly_hours) };
  }
  if (target === 'client' && ['aufnahme', 'vertraege', 'vollmachten'].includes(definition.categoryKey)) {
    const [details, contacts] = await Promise.all([
      fromUnknownTable(client, 'clients').select('service_start,admission_date').eq('tenant_id', tenantId).eq('id', entityId).maybeSingle(),
      fromUnknownTable(client, 'client_contacts').select('first_name,last_name,full_name,relationship,street,house_number,postal_code,city,is_primary_contact').eq('tenant_id', tenantId).eq('client_id', entityId).eq('is_legal_representative', true).order('is_primary_contact', { ascending: false }).limit(2),
    ]);
    if (details.error) return { ok: false, error: toGermanSupabaseError(details.error) };
    if (contacts.error && !missingColumn(contacts.error)) return { ok: false, error: toGermanSupabaseError(contacts.error) };
    if (missingColumn(contacts.error)) context.procedure = { ...context.procedure, sourceNote: 'Vertretungsangaben bitte anhand der gültigen Vollmacht oder Betreuungsunterlagen ergänzen.' };
    context.subject.serviceStart = str(details.data?.service_start || details.data?.admission_date);
    // Two representatives without a unique primary contact require an individual choice.
    const list = contacts.data ?? []; const representative = list.length === 1 || (list[0]?.is_primary_contact && !list[1]?.is_primary_contact) ? list[0] : undefined;
    if (representative) context.representative = { name: str(representative.full_name || [representative.first_name, representative.last_name].filter(Boolean).join(' ')), relation: str(representative.relationship), address: address(representative) };
  }
  if (target === 'client' && request.assignmentId && ['einsatz', 'alltag', 'abrechnung'].includes(definition.categoryKey)) {
    const denied = await guard<CentralDocumentContext>(tenantId, actor, 'assist.assignments.view'); if (denied) return denied;
    let result = await fromUnknownTable(client, 'assist_visits').select('id,client_id,employee_id,assignment_date,actual_start_at,actual_end_at,service_name,execution_status').eq('tenant_id', tenantId).eq('id', request.assignmentId).maybeSingle();
    if (!result.error && !result.data) result = await fromUnknownTable(client, 'assignments').select('id,client_id,employee_id,assignment_date,actual_start_at,actual_end_at,title,status').eq('tenant_id', tenantId).eq('id', request.assignmentId).maybeSingle();
    if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
    const visit = result.data;
    if (!visit || visit.client_id !== entityId) return { ok: false, error: 'Der Einsatz gehört nicht zu dieser Klientenakte oder ist nicht verfügbar.' };
    let employeeName = '';
    if (visit.employee_id && !(await guard(tenantId, actor, 'office.employees.view'))) {
      const employee = await fromUnknownTable(client, 'employees').select('first_name,last_name').eq('tenant_id', tenantId).eq('id', visit.employee_id).maybeSingle();
      if (employee.error) return { ok: false, error: toGermanSupabaseError(employee.error) };
      employeeName = [employee.data?.first_name, employee.data?.last_name].filter(Boolean).join(' ');
    }
    context.procedure = { ...context.procedure, assignmentId: request.assignmentId, period: str(visit.assignment_date) };
    context.sourceRows = centralActualServiceRows(definition, visit, employeeName);
  }
  if (target === 'client' && request.invoiceId && definition.categoryKey === 'abrechnung') {
    const denied = await guard<CentralDocumentContext>(tenantId, actor, 'office.invoices.view'); if (denied) return denied;
    const [invoice, items] = await Promise.all([
      fromUnknownTable(client, 'invoices').select('id,client_id,invoice_number,invoice_date,service_period_from,service_period_to,service_month,recipient_name,total_amount,due_date').eq('tenant_id', tenantId).eq('id', request.invoiceId).maybeSingle(),
      fromUnknownTable(client, 'invoice_items').select('service_date,description,quantity,unit,gross_amount').eq('tenant_id', tenantId).eq('invoice_id', request.invoiceId).order('sort_order', { ascending: true }),
    ]);
    for (const result of [invoice, items]) if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
    if (!invoice.data || invoice.data.client_id !== entityId) return { ok: false, error: 'Die Rechnung gehört nicht zu dieser Klientenakte oder ist nicht verfügbar.' };
    const row = invoice.data;
    if (row.recipient_name) context.payor.name = str(row.recipient_name);
    context.procedure = { ...context.procedure, invoiceId: request.invoiceId, invoiceNumber: str(row.invoice_number), period: [row.service_period_from, row.service_period_to].filter(Boolean).join(' bis ') || str(row.service_month), recipientName: str(row.recipient_name), dueDate: str(row.due_date) };
    if (definition.layout === 'table') context.sourceRows = (items.data ?? []).map((item) => [str(item.service_date), str(item.description), `${str(item.quantity)} ${str(item.unit)}${item.gross_amount != null ? ` · ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(Number(item.gross_amount))}` : ''}`.trim(), `Rechnung ${str(row.invoice_number)}`, '']);
  }
  if (target === 'client' && request.medicationId && definition.categoryKey === 'medikamente') {
    const denied = await guard<CentralDocumentContext>(tenantId, actor, 'pflege.medications.view'); if (denied) return denied;
    let result = await fromUnknownTable(client, 'medications').select('id,client_id,name,strength,dosage,route,prescribed_by,start_date,end_date,status,updated_at').eq('tenant_id', tenantId).eq('id', request.medicationId).maybeSingle();
    if (missingColumn(result.error)) result = await fromUnknownTable(client, 'medications').select('id,client_id,name,dosage,active,updated_at').eq('tenant_id', tenantId).eq('id', request.medicationId).maybeSingle();
    if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
    if (!result.data || result.data.client_id !== entityId) return { ok: false, error: 'Die Verordnung gehört nicht zu dieser Klientenakte oder ist nicht verfügbar.' };
    const row = result.data as Record<string, unknown>;
    context.procedure = { ...context.procedure, medicationId: request.medicationId, medicationReference: [`Gespeicherter Medikationsdatensatz: ${str(row.id)}`, row.prescribed_by ? `Verordnet von: ${str(row.prescribed_by)}` : '', row.start_date ? `Beginn: ${str(row.start_date)}` : '', row.end_date ? `Ende: ${str(row.end_date)}` : '', row.status ? `Status: ${str(row.status)}` : row.active != null ? `In der App aktiv: ${row.active ? 'ja' : 'nein'}` : '', `Datenstand: ${str(row.updated_at)}`].filter(Boolean).join('\n'), medicationDetails: [str(row.name), str(row.strength), row.dosage ? `Dosierung: ${str(row.dosage)}` : '', row.route ? `Applikation: ${str(row.route)}` : ''].filter(Boolean).join('\n') };
  }
  if (target === 'client' && request.woundId && definition.categoryKey === 'wunden') {
    const denied = await guard<CentralDocumentContext>(tenantId, actor, 'pflege.wounds.view'); if (denied) return denied;
    const [wound, assessments] = await Promise.all([
      fromUnknownTable(client, 'clinical_wound_cases').select('id,client_id,body_location,wound_type,etiology,treatment_plan,ordering_physician,next_review_at').eq('tenant_id', tenantId).eq('id', request.woundId).maybeSingle(),
      fromUnknownTable(client, 'clinical_wound_assessments').select('assessed_at,length_cm,width_cm,depth_cm,wound_bed,wound_edge,surrounding_skin,exudate,odor,pain_score,infection_signs,intervention,response').eq('tenant_id', tenantId).eq('client_id', entityId).eq('wound_case_id', request.woundId).order('assessed_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    for (const result of [wound, assessments]) if (result.error) return { ok: false, error: toGermanSupabaseError(result.error) };
    if (!wound.data || wound.data.client_id !== entityId) return { ok: false, error: 'Der Wundfall gehört nicht zu dieser Klientenakte oder ist nicht verfügbar.' };
    context.procedure = { ...context.procedure, woundId: request.woundId, ...centralWoundSourceValues(wound.data, assessments.data ?? {}) };
  }
  if (!context.procedure?.period && request.period && /^\d{4}-(0[1-9]|1[0-2])$/.test(request.period) && ['einsatz', 'alltag', 'abrechnung'].includes(definition.categoryKey)) context.procedure = { ...context.procedure, period: request.period, periodOrigin: 'selected' };
  return { ok: true, data: context };
}

export function centralWoundSourceValues(wound: Record<string, unknown>, assessment: Record<string, unknown>): Record<string, string> {
  const named = (label: string, value: unknown, unit = '') => value == null || value === '' ? '' : `${label}: ${Array.isArray(value) ? value.map(str).join(', ') : str(value)}${unit}`;
  const lines = (...values: string[]) => values.filter(Boolean).join('\n');
  return {
    woundLocation: lines(named('Lokalisation', wound.body_location), named('Wundart', wound.wound_type), named('Entstehung', wound.etiology)),
    woundMeasurements: lines(named('Länge', assessment.length_cm, ' cm'), named('Breite', assessment.width_cm, ' cm'), named('Tiefe', assessment.depth_cm, ' cm'), named('Erfasst am', assessment.assessed_at)),
    woundCondition: lines(named('Wundgrund', assessment.wound_bed), named('Wundrand', assessment.wound_edge), named('Wundumgebung', assessment.surrounding_skin)),
    woundSymptoms: lines(named('Exsudat', assessment.exudate), named('Geruch', assessment.odor), named('Schmerzscore', assessment.pain_score), named('Infektionszeichen', assessment.infection_signs)),
    woundTreatment: lines(named('Behandlungsplan', wound.treatment_plan), named('Anordnende ärztliche Person', wound.ordering_physician), named('Dokumentierte Maßnahme', assessment.intervention)),
    woundFollowup: lines(named('Dokumentierte Reaktion', assessment.response), named('Nächste Kontrolle', wound.next_review_at)),
  };
}

/** Planned appointments, cancellations and missing timestamps never become completed work. */
export function centralActualServiceRows(definition: CentralDocumentDefinition, visit: Record<string, unknown>, employeeName: string): string[][] {
  const status = str(visit.execution_status || visit.status);
  const start = new Date(str(visit.actual_start_at)); const end = new Date(str(visit.actual_end_at));
  if (!['completed', 'finished', 'done', 'abgeschlossen'].includes(status) || !Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start || !/Leistungsnachweis|Leistungsbestätigung|Leistungsbestaetigung/.test(definition.title)) return [];
  const date = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(start);
  const endDate = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin' }).format(end);
  const time = (value: Date) => new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(value);
  return [definition.columns.map((column) => column === 'Datum' ? date : column === 'Beginn' ? time(start) : column === 'Ende' ? endDate === date ? time(end) : `${endDate} ${time(end)}` : column === 'Leistung' ? str(visit.service_name || visit.title) : column === 'Menge / Einheit' ? `${Math.round((end.getTime() - start.getTime()) / 60000)} Minuten` : column === 'Mitarbeitende' ? employeeName : '')];
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

export async function listCentralDocuments(tenantId: string, actor: Actor, filter?: CentralDocumentRecordFilter, offset = 0): Promise<ServiceResult<CentralDocumentStored[]>> {
  if (!Number.isSafeInteger(offset) || offset < 0) return { ok: false, error: 'Ungültige Dokumentseite.' };
  const denied = await guard<CentralDocumentStored[]>(tenantId, actor, 'office.documents.view'); if (denied) return denied;
  if (getServiceMode() !== 'supabase') {
    const clientAllowed = !(await guard(tenantId, actor, 'office.clients.view'));
    const employeeAllowed = !(await guard(tenantId, actor, 'office.employees.view'));
    const clinicalAllowed = !(await guard(tenantId, actor, 'office.clients.view_sensitive'));
    return { ok: true, data: [...demoRecords.values()].filter((r) => r.tenantId === tenantId && (!filter || r.snapshot.context.target === filter.target && r.snapshot.context.entityId === filter.entityId) && (!r.snapshot.definition.clinicalReviewRequired || clinicalAllowed) && (r.snapshot.context.target === 'company' || (r.snapshot.context.target === 'client' ? clientAllowed && clinicalAllowed : employeeAllowed))).sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)).slice(offset, offset + 100).map((r) => JSON.parse(JSON.stringify(r)) as CentralDocumentStored) };
  }
  const client = getSupabaseClient(); if (!client) return { ok: false, error: 'Datenverbindung nicht verfügbar.' };
  let request = fromUnknownTable(client, 'central_document_records').select('*').eq('tenant_id', tenantId);
  if (filter) request = request.eq('target', filter.target).eq('entity_id', filter.entityId);
  const { data, error } = await request.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + 99);
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
  const bytes = await blobBytes(data);
  if (sha256FileHex(bytes) !== expectedHash) return { ok: false, error: 'Die Datei stimmt nicht mit dem gespeicherten Prüfwert überein.' };
  return { ok: true, data: bytes };
}
