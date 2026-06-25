import type { DocumentContextLoadResult, DocumentEntityType } from '@/features/documents/templateEngine/types';
import { createEmptyDocumentContext } from '@/features/documents/templateEngine/documentContext';
import type { DocumentContextRepository } from '@/features/documents/templateEngine/documentContext';
import { getSupabaseClient } from '@/lib/supabase/client';
import { fromUnknownTable } from '@/lib/supabase/untypedTable';

function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  const d = value.slice(0, 10);
  const [y, m, day] = d.split('-');
  if (!y || !m || !day) return value;
  return `${day}.${m}.${y}`;
}

function formatAddress(street?: string | null, zip?: string | null, city?: string | null): string {
  const parts = [street, [zip, city].filter(Boolean).join(' ')].filter(Boolean);
  return parts.join(', ');
}

async function loadTenantSection(tenantId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return {};

  const { data: tenant } = await fromUnknownTable(supabase, 'tenants')
    .select('name, legal_name, street, postal_code, city, phone, email, website, tax_id, ik_number')
    .eq('id', tenantId)
    .maybeSingle();

  const { data: settings } = await fromUnknownTable(supabase, 'tenant_document_settings')
    .select('bank_name, iban, bic, logo_url')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const t = tenant as Record<string, unknown> | null;
  const s = settings as Record<string, unknown> | null;

  return {
    name: t?.name ? String(t.name) : '',
    legal_name: t?.legal_name ? String(t.legal_name) : t?.name ? String(t.name) : '',
    street: t?.street ? String(t.street) : '',
    zip: t?.postal_code ? String(t.postal_code) : '',
    city: t?.city ? String(t.city) : '',
    phone: t?.phone ? String(t.phone) : '',
    email: t?.email ? String(t.email) : '',
    website: t?.website ? String(t.website) : '',
    tax_id: t?.tax_id ? String(t.tax_id) : '',
    ik_number: t?.ik_number ? String(t.ik_number) : '',
    bank_name: s?.bank_name ? String(s.bank_name) : '',
    iban: s?.iban ? String(s.iban) : '',
    bic: s?.bic ? String(s.bic) : '',
    logo: s?.logo_url ? String(s.logo_url) : '',
  };
}

async function loadClientSection(tenantId: string, clientId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'clients')
    .select(
      'id, first_name, last_name, full_name, date_of_birth, street, postal_code, city, phone, email, care_level, insurance_name, insurance_number, client_number, emergency_notes',
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
    birth_date: formatDate(c.date_of_birth ? String(c.date_of_birth) : null),
    street: c.street ? String(c.street) : '',
    zip: c.postal_code ? String(c.postal_code) : '',
    city: c.city ? String(c.city) : '',
    phone: c.phone ? String(c.phone) : '',
    email: c.email ? String(c.email) : '',
    care_level: c.care_level ? String(c.care_level) : '',
    insurance_name: c.insurance_name ? String(c.insurance_name) : '',
    insurance_number: c.insurance_number ? String(c.insurance_number) : '',
    customer_number: c.client_number ? String(c.client_number) : '',
    emergency_contact_name: '',
    emergency_contact_phone: c.emergency_notes ? String(c.emergency_notes) : '',
  };
}

async function loadEmployeeSection(tenantId: string, employeeId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'employees')
    .select('id, first_name, last_name, email, phone, personnel_number, role_key')
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
    personnel_number: e.personnel_number ? String(e.personnel_number) : '',
    role: e.role_key ? String(e.role_key) : '',
    phone: e.phone ? String(e.phone) : '',
    email: e.email ? String(e.email) : '',
  };
}

async function loadVisitSection(tenantId: string, visitId: string) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data } = await fromUnknownTable(supabase, 'assist_visits')
    .select(
      'id, subject, visit_type, scheduled_start, scheduled_end, actual_start, actual_end, client_id, employee_id, status, clients(first_name, last_name), employees(first_name, last_name)',
    )
    .eq('tenant_id', tenantId)
    .eq('id', visitId)
    .maybeSingle();

  if (!data) return null;
  const v = data as Record<string, unknown>;
  const clients = v.clients as { first_name?: string; last_name?: string } | null;
  const employees = v.employees as { first_name?: string; last_name?: string } | null;

  return {
    subject: v.subject ? String(v.subject) : 'Einsatz',
    type: v.visit_type ? String(v.visit_type) : '',
    date: formatDate(v.scheduled_start ? String(v.scheduled_start) : null),
    planned_start: v.scheduled_start ? String(v.scheduled_start) : '',
    planned_end: v.scheduled_end ? String(v.scheduled_end) : '',
    actual_start: v.actual_start ? String(v.actual_start) : '',
    actual_end: v.actual_end ? String(v.actual_end) : '',
    employee_name: employees ? `${employees.first_name ?? ''} ${employees.last_name ?? ''}`.trim() : '',
    client_name: clients ? `${clients.first_name ?? ''} ${clients.last_name ?? ''}`.trim() : '',
    client_id: v.client_id ? String(v.client_id) : '',
    employee_id: v.employee_id ? String(v.employee_id) : '',
  };
}

export const documentContextSupabaseRepository: DocumentContextRepository = {
  async loadContext(
    tenantId: string,
    entityType: DocumentEntityType,
    entityId: string,
  ): Promise<DocumentContextLoadResult> {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { ok: false, error: 'Supabase nicht verfügbar.' };
    }

    const context = createEmptyDocumentContext({ tenantId, entityType, entityId });
    context.company = await loadTenantSection(tenantId);

    if (entityType === 'client') {
      const client = await loadClientSection(tenantId, entityId);
      if (client) {
        context.client = client;
        context.recipient = {
          full_name: client.full_name,
          address: formatAddress(client.street, client.zip, client.city),
        };
      }
    }

    if (entityType === 'service_record') {
      const visit = await loadVisitSection(tenantId, entityId);
      if (visit) {
        context.visit = visit;
        if (visit.client_id) {
          const client = await loadClientSection(tenantId, visit.client_id);
          if (client) {
            context.client = client;
            context.recipient = {
              full_name: client.full_name,
              address: formatAddress(client.street, client.zip, client.city),
            };
          }
        }
        if (visit.employee_id) {
          const employee = await loadEmployeeSection(tenantId, visit.employee_id);
          if (employee) context.employee = employee;
        }
      }
    }

    if (entityType === 'invoice') {
      const { data: invoice } = await fromUnknownTable(supabase, 'invoices')
        .select('id, invoice_number, invoice_date, due_date, net_total, gross_total, tax_total, client_id')
        .eq('tenant_id', tenantId)
        .eq('id', entityId)
        .maybeSingle();

      if (invoice) {
        const inv = invoice as Record<string, unknown>;
        context.invoice = {
          number: inv.invoice_number ? String(inv.invoice_number) : '',
          date: formatDate(inv.invoice_date ? String(inv.invoice_date) : null),
          due_date: formatDate(inv.due_date ? String(inv.due_date) : null),
          net_total: inv.net_total != null ? String(inv.net_total) : '',
          gross_total: inv.gross_total != null ? String(inv.gross_total) : '',
          tax_total: inv.tax_total != null ? String(inv.tax_total) : '',
        };
        const clientId = inv.client_id ? String(inv.client_id) : '';
        if (clientId) {
          const client = await loadClientSection(tenantId, clientId);
          if (client) {
            context.client = client;
            context.recipient = {
              full_name: client.full_name,
              address: formatAddress(client.street, client.zip, client.city),
            };
          }
        }
      }
    }

    context.document = {
      title: '',
      number: '',
      created_at: formatDate(new Date().toISOString()),
      version: '1',
    };

    return { ok: true, context, source: 'repository' };
  },
};
