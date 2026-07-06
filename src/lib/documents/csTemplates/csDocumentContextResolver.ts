import type { RoleKey, ServiceResult } from '@/types';
import type { DocumentContext } from '@/types/documents/csTemplateDatabase';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { enforcePermission } from '@/lib/permissions';
import { normalizeDocumentContext } from './csDocumentContextNormalize';

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = value.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return value;
  return `${day}.${m}.${y}`;
}

function formatIsoDate(value: string | null | undefined): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function formatAddress(street?: string | null, zip?: string | null, city?: string | null): string {
  const parts = [street, [zip, city].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

function formatMoney(value: unknown): string {
  if (value == null || value === '') return '';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${num.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

async function loadTenantContext(tenantId: string): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  if (!supabase) return {};

  const { data: tenant } = await fromUnknownTable(supabase, 'tenants')
    .select(
      'name, legal_name, street, house_number, postal_code, city, phone, fax, email, website, tax_id, ik_number, register_court, register_number, managing_director, ceo_name, opening_hours, emergency_phone',
    )
    .eq('id', tenantId)
    .maybeSingle();

  const { data: settings } = await fromUnknownTable(supabase, 'tenant_document_settings')
    .select('bank_name, iban, bic')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const t = (tenant ?? {}) as Record<string, unknown>;
  const s = (settings ?? {}) as Record<string, unknown>;
  const streetLine = [t.street, t.house_number].filter(Boolean).map(String).join(' ').trim();

  const legalName = String(t.legal_name ?? t.name ?? '').trim();
  const addressFull = formatAddress(streetLine, t.postal_code ? String(t.postal_code) : '', t.city ? String(t.city) : '');

  return {
    legal_name: legalName,
    trade_name: String(t.name ?? legalName).trim(),
    street: streetLine,
    postal_code: t.postal_code ? String(t.postal_code) : '',
    city: t.city ? String(t.city) : '',
    address_full: addressFull,
    phone: t.phone ? String(t.phone) : '',
    fax: t.fax ? String(t.fax) : '',
    email: t.email ? String(t.email) : '',
    website: t.website ? String(t.website) : '',
    ceo_name: String(t.ceo_name ?? t.managing_director ?? '').trim(),
    register_court: t.register_court ? String(t.register_court) : '',
    register_number: t.register_number ? String(t.register_number) : '',
    vat_id: t.tax_id ? String(t.tax_id) : '',
    ik_number: t.ik_number ? String(t.ik_number) : '',
    supervisory_authority: '',
    opening_hours: t.opening_hours ? String(t.opening_hours) : '',
    emergency_phone: t.emergency_phone ? String(t.emergency_phone) : '',
    bank_name: s.bank_name ? String(s.bank_name) : '',
    iban: s.iban ? String(s.iban) : '',
    bic: s.bic ? String(s.bic) : '',
  };
}

async function loadEmployeeContext(
  tenantId: string,
  employeeId: string,
): Promise<Record<string, string> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'employees')
    .select(
      'first_name, last_name, email, phone, employee_number, role_title, employment_type, entry_date, exit_date, weekly_hours, hourly_wage, probation_end, portal_username, bank_iban, date_of_birth, street, postal_code, city',
    )
    .eq('tenant_id', tenantId)
    .eq('id', employeeId)
    .maybeSingle();

  if (!data) return null;
  const e = data as Record<string, unknown>;
  const firstName = String(e.first_name ?? '');
  const lastName = String(e.last_name ?? '');

  return {
    full_name: `${firstName} ${lastName}`.trim(),
    first_name: firstName,
    last_name: lastName,
    birth_date: formatIsoDate(e.date_of_birth ? String(e.date_of_birth) : null),
    address_full: formatAddress(
      e.street ? String(e.street) : '',
      e.postal_code ? String(e.postal_code) : '',
      e.city ? String(e.city) : '',
    ),
    email: e.email ? String(e.email) : '',
    phone: e.phone ? String(e.phone) : '',
    personnel_number: e.employee_number ? String(e.employee_number) : '',
    job_title: e.role_title ? String(e.role_title) : '',
    role: e.role_title ? String(e.role_title) : '',
    employment_type: e.employment_type ? String(e.employment_type) : '',
    start_date: formatIsoDate(e.entry_date ? String(e.entry_date) : null),
    entry_date: formatIsoDate(e.entry_date ? String(e.entry_date) : null),
    end_date: formatIsoDate(e.exit_date ? String(e.exit_date) : null),
    weekly_hours: e.weekly_hours != null ? String(e.weekly_hours) : '',
    hourly_wage: e.hourly_wage != null ? formatMoney(e.hourly_wage) : '',
    probation_end: formatIsoDate(e.probation_end ? String(e.probation_end) : null),
    portal_username: e.portal_username ? String(e.portal_username) : '',
    bank_iban: e.bank_iban ? String(e.bank_iban) : '',
  };
}

async function loadClientContext(
  tenantId: string,
  clientId: string,
): Promise<Record<string, string> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'clients')
    .select(
      'first_name, last_name, full_name, date_of_birth, street, postal_code, city, phone, email, care_level, insurance_name, insurance_number, representative_name, representative_relation, emergency_contact_name, emergency_contact_phone, portal_code, emergency_notes, budget_45b_remaining, budget_45a_available',
    )
    .eq('tenant_id', tenantId)
    .eq('id', clientId)
    .maybeSingle();

  if (!data) return null;
  const c = data as Record<string, unknown>;
  const firstName = String(c.first_name ?? '');
  const lastName = String(c.last_name ?? '');
  const fullName = c.full_name ? String(c.full_name) : `${firstName} ${lastName}`.trim();

  return {
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    birth_date: formatIsoDate(c.date_of_birth ? String(c.date_of_birth) : null),
    address_full: formatAddress(
      c.street ? String(c.street) : '',
      c.postal_code ? String(c.postal_code) : '',
      c.city ? String(c.city) : '',
    ),
    address: formatAddress(
      c.street ? String(c.street) : '',
      c.postal_code ? String(c.postal_code) : '',
      c.city ? String(c.city) : '',
    ),
    phone: c.phone ? String(c.phone) : '',
    email: c.email ? String(c.email) : '',
    care_level: c.care_level ? String(c.care_level) : '',
    insurance_name: c.insurance_name ? String(c.insurance_name) : '',
    payor_name: c.insurance_name ? String(c.insurance_name) : '',
    insurance_number: c.insurance_number ? String(c.insurance_number) : '',
    representative_name: c.representative_name ? String(c.representative_name) : '',
    representative_relation: c.representative_relation ? String(c.representative_relation) : '',
    emergency_contact_name: c.emergency_contact_name ? String(c.emergency_contact_name) : '',
    emergency_contact_phone: c.emergency_contact_phone ? String(c.emergency_contact_phone) : '',
    budget_45b_remaining: c.budget_45b_remaining != null ? formatMoney(c.budget_45b_remaining) : '',
    budget_45a_available: c.budget_45a_available ? String(c.budget_45a_available) : '',
    portal_code: c.portal_code ? String(c.portal_code) : '',
    access_notes: c.emergency_notes ? String(c.emergency_notes) : '',
  };
}

async function loadAssignmentContext(
  tenantId: string,
  assignmentId: string,
): Promise<Record<string, string> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'assist_visits')
    .select(
      'scheduled_start, scheduled_end, actual_start, actual_end, visit_type, location_label, street, postal_code, city, documentation_note, cancel_reason, tasks_json',
    )
    .eq('tenant_id', tenantId)
    .eq('id', assignmentId)
    .maybeSingle();

  if (!data) return null;
  const v = data as Record<string, unknown>;
  const start = v.actual_start ? String(v.actual_start) : v.scheduled_start ? String(v.scheduled_start) : '';
  const end = v.actual_end ? String(v.actual_end) : v.scheduled_end ? String(v.scheduled_end) : '';

  let durationHours = '';
  if (start && end) {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms > 0) durationHours = (ms / 3600000).toLocaleString('de-DE', { maximumFractionDigits: 2 });
  }

  return {
    date: formatIsoDate(start || null),
    start_time: start ? new Date(start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
    end_time: end ? new Date(end).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '',
    duration_hours: durationHours,
    location: v.location_label ? String(v.location_label) : 'Wohnung Klient:in',
    address_full: formatAddress(
      v.street ? String(v.street) : '',
      v.postal_code ? String(v.postal_code) : '',
      v.city ? String(v.city) : '',
    ),
    service_type: v.visit_type ? String(v.visit_type) : '',
    tasks: v.tasks_json ? JSON.stringify(v.tasks_json) : '',
    documentation: v.documentation_note ? String(v.documentation_note) : '',
    cancel_reason: v.cancel_reason ? String(v.cancel_reason) : '',
  };
}

async function loadInvoiceContext(
  tenantId: string,
  invoiceId: string,
): Promise<Record<string, string> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'invoices')
    .select('invoice_number, invoice_date, due_date, gross_total, service_period_start, service_period_end')
    .eq('tenant_id', tenantId)
    .eq('id', invoiceId)
    .maybeSingle();

  if (!data) return null;
  const inv = data as Record<string, unknown>;
  const periodStart = inv.service_period_start ? formatDate(String(inv.service_period_start)) : '';
  const periodEnd = inv.service_period_end ? formatDate(String(inv.service_period_end)) : '';

  return {
    number: inv.invoice_number ? String(inv.invoice_number) : '',
    date: formatIsoDate(inv.invoice_date ? String(inv.invoice_date) : null),
    amount: inv.gross_total != null ? formatMoney(inv.gross_total) : '',
    due_date: formatIsoDate(inv.due_date ? String(inv.due_date) : null),
    period: [periodStart, periodEnd].filter(Boolean).join(' – '),
  };
}

async function loadPayorContext(
  tenantId: string,
  payorId: string,
): Promise<Record<string, string> | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'cost_carriers')
    .select('name, street, postal_code, city, email, fax, case_number')
    .eq('tenant_id', tenantId)
    .eq('id', payorId)
    .maybeSingle();

  if (!data) return null;
  const p = data as Record<string, unknown>;
  return {
    name: p.name ? String(p.name) : '',
    address_full: formatAddress(
      p.street ? String(p.street) : '',
      p.postal_code ? String(p.postal_code) : '',
      p.city ? String(p.city) : '',
    ),
    email: p.email ? String(p.email) : '',
    fax: p.fax ? String(p.fax) : '',
    case_number: p.case_number ? String(p.case_number) : '',
  };
}

export type ResolveDocumentContextInput = {
  tenantId: string;
  templateTitle: string;
  templateVersion: string;
  documentType?: string;
  dueDate?: string | null;
  priority?: string;
  signatureRequirement?: string;
  employeeId?: string | null;
  clientId?: string | null;
  representativeId?: string | null;
  assignmentId?: string | null;
  invoiceId?: string | null;
  payorId?: string | null;
  officeUserName?: string | null;
  officeUserEmail?: string | null;
};

export async function resolveDocumentContext(
  input: ResolveDocumentContextInput,
): Promise<ServiceResult<DocumentContext>> {
  const tenantBlock = guardServiceTenant(input.tenantId);
  if (tenantBlock) return tenantBlock;

  if (getServiceMode() !== 'supabase') {
    return {
      ok: true,
      data: {
        tenant: { legal_name: 'Demo Mandant', address_full: 'Musterstraße 1, 44135 Dortmund', email: 'info@example.de', phone: '0231 000000' },
        document: {
          title: input.templateTitle,
          date: new Date().toISOString().slice(0, 10),
          due_date: input.dueDate ?? '',
          priority: input.priority ?? 'Normal',
          signature_required: input.signatureRequirement ?? 'Nein',
          version: input.templateVersion,
        },
      },
    };
  }

  try {
    const tenant = await loadTenantContext(input.tenantId);
    const context: DocumentContext = {
      tenant,
      document: {
        title: input.templateTitle,
        type: input.documentType ?? '',
        document_type: input.documentType ?? '',
        date: new Date().toISOString().slice(0, 10),
        created_at: new Date().toISOString().slice(0, 10),
        due_date: input.dueDate ?? '',
        priority: input.priority ?? 'Normal',
        signature_required: input.signatureRequirement ?? 'Nein',
        version: input.templateVersion,
        sender_name: input.officeUserName ?? '',
      },
    };

    if (input.officeUserName || input.officeUserEmail) {
      context.office = {
        full_name: input.officeUserName ?? '',
        email: input.officeUserEmail ?? tenant.email ?? '',
        phone: tenant.phone ?? '',
      };
    }

    if (input.employeeId) {
      const employee = await loadEmployeeContext(input.tenantId, input.employeeId);
      if (employee) context.employee = employee;
    }

    if (input.clientId) {
      const client = await loadClientContext(input.tenantId, input.clientId);
      if (client) {
        context.client = client;
        if (client.representative_name) {
          context.representative = {
            full_name: client.representative_name,
            address_full: '',
            email: '',
            phone: '',
          };
        }
      }
    }

    if (input.assignmentId) {
      const assignment = await loadAssignmentContext(input.tenantId, input.assignmentId);
      if (assignment) context.assignment = assignment;
    }

    if (input.invoiceId) {
      const invoice = await loadInvoiceContext(input.tenantId, input.invoiceId);
      if (invoice) context.invoice = invoice;
    }

    if (input.payorId) {
      const payor = await loadPayorContext(input.tenantId, input.payorId);
      if (payor) context.payor = payor;
    } else if (context.client?.insurance_name) {
      context.payor = {
        name: context.client.insurance_name,
        address_full: '',
        email: '',
        fax: '',
        case_number: '',
      };
    }

    return { ok: true, data: normalizeDocumentContext(context) };
  } catch (error) {
    if (isMissingTableError(error)) {
      return { ok: false, error: 'Vorlagen-Datenbank ist noch nicht migriert (0226).' };
    }
    return { ok: false, error: toGermanSupabaseError(error) };
  }
}

export async function previewDocumentContext(
  tenantId: string,
  actorRoleKey?: RoleKey | null,
): Promise<ServiceResult<{ canResolve: boolean }>> {
  const denied = enforcePermission<{ canResolve: boolean }>(actorRoleKey, 'office.documents.view');
  if (denied) return denied;
  return { ok: true, data: { canResolve: getServiceMode() === 'supabase' } };
}
