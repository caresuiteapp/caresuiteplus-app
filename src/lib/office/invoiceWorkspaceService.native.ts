// Generated native presentation from src/lib/office/invoiceWorkspaceService.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import type { InvoiceStatus } from '@/types/modules/billing';
import { enforcePermission } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { isInvoiceStatus } from './invoiceStatus';
import { isOfficeInvoiceDate, isOfficeInvoiceUuid, validateOfficeInvoiceDraft } from "./invoiceWorkspaceTypes.native.ts";
import { normalizeOfficeEInvoiceMetadata, normalizeOfficeEInvoiceLineTax } from "./eInvoiceModel.native.ts";
import type { InvoiceOfficeDraft, OfficeInvoice, OfficeInvoiceCatalogOption, OfficeInvoiceClient, OfficeInvoiceDraftLine, OfficeInvoiceEditorOptions, OfficeInvoiceLine, OfficeInvoiceMutationResult, OfficeInvoicePaymentInput, OfficeInvoiceProductKey, OfficeInvoiceRecipient, OfficeInvoiceIssueInput, OfficeInvoiceIssuePreview, OfficeInvoiceDeliveryEvidence, OfficeInvoiceRecipientType, OfficeInvoiceBillingParty, } from "./invoiceWorkspaceTypes.native.ts";
export * from "./invoiceWorkspaceTypes.native.ts";
type Row = Record<string, unknown>;
const PAGE_SIZE = 500;
const INVOICE_COLUMNS = 'id,tenant_id,client_id,invoice_number,status,invoice_date,due_date,service_period_from,service_period_to,service_month,total_amount,paid_amount,open_amount,created_at,updated_at,recipient_name,recipient_street,recipient_house_number,recipient_postal_code,recipient_city,recipient_country,recipient_email,notes,footer_text,pdf_file_path,cancellation_reason,include_service_proofs,selected_proof_ids,company_snapshot,customer_snapshot,office_managed,recipient_type,billing_party,e_invoice_metadata';
const ITEM_COLUMNS = 'id,tenant_id,invoice_id,description,quantity,unit,unit_price,net_amount,vat_amount,vat_rate,gross_amount,product_key,service_date,service_record_id,sort_order,e_invoice_tax';
const CLIENT_COLUMNS = 'id,tenant_id,first_name,last_name,client_number,status,street,house_number,postal_code,city,country,email,insurance_name,insurance_number,billing_party,deleted_at';
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const nullableText = (value: unknown): string | null => text(value) || null;
function checkAccess<T>(tenantId: string, role: RoleKey | null | undefined, permission: 'office.invoices.view' | 'office.invoices.create' | 'office.invoices.status_change'): ServiceResult<T> | null {
    const denied = enforcePermission<T>(role, permission);
    if (denied)
        return denied;
    const blocked = guardServiceTenant(tenantId);
    if (blocked)
        return blocked;
    if (getServiceMode() !== 'supabase')
        return { ok: false, error: 'Die Rechnungsverwaltung benötigt eine verbundene Datenbank.' };
    return null;
}
/** Complete ordered reads; failed later pages never become a partial financial total. */
async function readAll(tenantId: string, table: string, columns: string, equal: Record<string, string> = {}, ids?: string[]): Promise<Row[]> {
    const client = getSupabaseClient();
    if (!client)
        throw new Error('Die Datenbank ist nicht erreichbar. Bitte erneut versuchen.');
    const rows: Row[] = [];
    const seenIds = new Set<string>();
    for (let page = 0; page < 200; page += 1) {
        let query = fromUnknownTable(client, table).select(columns).eq('tenant_id', tenantId);
        for (const [column, value] of Object.entries(equal))
            query = query.eq(column, value);
        if (ids)
            query = query.in('id', ids);
        const { data, error } = await query.order('id', { ascending: true }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
        if (error)
            throw new Error(toGermanSupabaseError(error));
        const next = (data ?? []) as unknown as Row[];
        if (next.some(row => row.tenant_id !== tenantId || (ids && !ids.includes(text(row.id))) || Object.entries(equal).some(([key, value]) => row[key] !== value)))
            throw new Error('Die geladenen Rechnungsdaten gehören nicht zur gewählten Ansicht.');
        for (const row of next) {
            if (!text(row.id) || seenIds.has(text(row.id)))
                throw new Error('Die Rechnungsdaten haben sich während des Ladens geändert. Bitte erneut laden.');
            seenIds.add(text(row.id));
            rows.push(row);
        }
        if (next.length < PAGE_SIZE)
            return rows;
    }
    throw new Error('Die Rechnungsdaten sind zu umfangreich. Bitte den Zeitraum einschränken.');
}
async function readIds(tenantId: string, table: string, columns: string, ids: string[]): Promise<Row[]> {
    const rows: Row[] = [];
    for (let offset = 0; offset < ids.length; offset += 100)
        rows.push(...await readAll(tenantId, table, columns, {}, ids.slice(offset, offset + 100)));
    return rows;
}
function money(value: unknown): number | null {
    if (value === null || value === undefined || value === '' || typeof value === 'boolean')
        return null;
    const parsed = Number(value);
    const cents = Math.round(parsed * 100);
    return Number.isFinite(parsed) && Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}
function number(value: unknown): number {
    return value === null || value === undefined || value === '' || typeof value === 'boolean' ? Number.NaN : Number(value);
}
function clientRecipient(row: Row): OfficeInvoiceRecipient {
    return { name: [text(row.first_name), text(row.last_name)].filter(Boolean).join(' '), street: text(row.street),
        houseNumber: text(row.house_number), postalCode: text(row.postal_code), city: text(row.city), country: text(row.country), email: text(row.email) };
}
function mapClient(row: Row): OfficeInvoiceClient {
    const recipient = clientRecipient(row);
    return { id: text(row.id), name: recipient.name, clientNumber: text(row.client_number), status: text(row.status), recipient,
        insuranceName: text(row.insurance_name), insuranceNumber: text(row.insurance_number), billingParty: text(row.billing_party) };
}
function mapLine(row: Row, sources: Map<string, Row>): OfficeInvoiceLine {
    const source = sources.get(text(row.service_record_id));
    return { id: text(row.id), description: text(row.description), quantity: number(row.quantity), unit: text(row.unit),
        unitPriceCents: money(row.unit_price) ?? Number.NaN, taxRatePercent: number(row.vat_rate),
        productKey: text(row.product_key) as OfficeInvoiceProductKey, serviceDate: nullableText(row.service_date) ?? undefined,
        serviceRecordId: nullableText(row.service_record_id) ?? undefined, sourceUpdatedAt: nullableText(source?.updated_at) ?? undefined,
        netCents: money(row.net_amount), taxCents: money(row.vat_amount), totalCents: money(row.gross_amount), eInvoiceTax: normalizeOfficeEInvoiceLineTax(row.e_invoice_tax) };
}
function mapInvoice(row: Row, clients: Map<string, Row>, items: Row[], sources: Map<string, Row>): OfficeInvoice {
    const status = text(row.status);
    if (!isInvoiceStatus(status))
        throw new Error('Eine Rechnung hat einen unbekannten Status. Bitte die Daten prüfen.');
    const client = clients.get(text(row.client_id));
    const issues: string[] = [];
    const ordered = [...items].sort((a, b) => number(a.sort_order) - number(b.sort_order) || text(a.id).localeCompare(text(b.id)));
    const lines = ordered.map(item => mapLine(item, sources));
    const modules = new Set(lines.map(line => line.productKey).filter(key => ['assist', 'pflege', 'stationaer', 'beratung'].includes(key)));
    const amountCents = money(row.total_amount), paidCents = money(row.paid_amount), openCents = money(row.open_amount);
    if (amountCents === null)
        issues.push('Die Rechnungssumme fehlt oder ist ungültig.');
    if (paidCents === null || openCents === null)
        issues.push('Der Zahlungsstand ist nicht vollständig hinterlegt.');
    if (status === 'paid' && openCents !== null && openCents > 0)
        issues.push('Die Rechnung ist als bezahlt markiert, obwohl ein offener Betrag hinterlegt ist.');
    if (status === 'partly_paid' && (paidCents === 0 || openCents === 0))
        issues.push('Der Status Teilbezahlt passt nicht zum Zahlungsstand.');
    if (status === 'draft' && paidCents !== null && paidCents > 0)
        issues.push('Für diesen Entwurf sind bereits Zahlungen hinterlegt. Bitte den Rechnungsstatus prüfen.');
    if (amountCents !== null && paidCents !== null && openCents !== null && Math.abs(amountCents - paidCents - openCents) > 1 && !['cancelled', 'written_off'].includes(status))
        issues.push('Zahlungen und offener Betrag stimmen nicht mit der Rechnungssumme überein.');
    if (!lines.length)
        issues.push('Es sind keine Rechnungspositionen hinterlegt.');
    if (lines.some(line => !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.unitPriceCents) || line.unitPriceCents < 0 ||
        !Number.isFinite(line.taxRatePercent) || line.taxRatePercent < 0 || line.taxRatePercent > 100 || line.totalCents === null || line.netCents === null || line.taxCents === null))
        issues.push('Mindestens eine Rechnungsposition enthält unvollständige oder ungültige Beträge.');
    if (amountCents !== null && lines.length && lines.every(line => line.totalCents !== null) && lines.reduce((sum, line) => sum + line.totalCents!, 0) !== amountCents)
        issues.push('Die Positionssumme stimmt nicht mit der gespeicherten Rechnungssumme überein.');
    const hasRecipient = Boolean(text(row.recipient_name));
    const recipient: OfficeInvoiceRecipient = hasRecipient ? {
        name: text(row.recipient_name), street: text(row.recipient_street), houseNumber: text(row.recipient_house_number),
        postalCode: text(row.recipient_postal_code), city: text(row.recipient_city), country: text(row.recipient_country), email: text(row.recipient_email),
    } : clientRecipient(status === 'draft' && row.recipient_type === 'client' ? client ?? {} : {});
    if (!hasRecipient)
        issues.push('Die Empfängeranschrift wurde noch nicht als Rechnungsstand gespeichert.');
    else if (!recipient.street || !recipient.postalCode || !recipient.city || !recipient.country)
        issues.push('Die gespeicherte Empfängeranschrift ist unvollständig.');
    if (status !== 'draft' && status !== 'cancelled' && (!text(row.invoice_number) || text(row.invoice_number).startsWith('DRAFT-')))
        issues.push('Die endgültige Rechnungsnummer fehlt.');
    if (!row.due_date)
        issues.push('Das Fälligkeitsdatum fehlt.');
    if (!isOfficeInvoiceDate(text(row.invoice_date)))
        issues.push('Das Rechnungsdatum ist ungültig.');
    if (row.due_date && !isOfficeInvoiceDate(text(row.due_date)))
        issues.push('Das Fälligkeitsdatum ist ungültig.');
    if (row.due_date && text(row.due_date) < text(row.invoice_date))
        issues.push('Die Fälligkeit liegt vor dem Rechnungsdatum.');
    if (row.service_period_from && !isOfficeInvoiceDate(text(row.service_period_from)) || row.service_period_to && !isOfficeInvoiceDate(text(row.service_period_to)) ||
        row.service_period_from && row.service_period_to && text(row.service_period_from) > text(row.service_period_to))
        issues.push('Der gespeicherte Leistungszeitraum ist ungültig.');
    const customer = row.customer_snapshot && typeof row.customer_snapshot === 'object' && !Array.isArray(row.customer_snapshot) ? row.customer_snapshot as Row : null;
    if (row.client_id && !client && !customer)
        issues.push('Die zugehörige Klientenakte ist nicht verfügbar.');
    return { id: text(row.id), tenantId: text(row.tenant_id), clientId: nullableText(row.client_id), clientName: text(customer?.name) || (client ? clientRecipient(client).name : 'Nicht zugeordnet'),
        clientNumber: text(customer?.clientNumber) || text(client?.client_number), insuranceNumber: customer ? text(customer.insuranceNumber) : text(client?.insurance_number), invoiceNumber: text(row.invoice_number).startsWith('DRAFT-') ? '' : text(row.invoice_number), status: status as InvoiceStatus,
        invoiceDate: text(row.invoice_date), dueDate: nullableText(row.due_date),
        servicePeriodStart: nullableText(row.service_period_from), servicePeriodEnd: nullableText(row.service_period_to),
        amountCents, paidCents, openCents, eInvoice: normalizeOfficeEInvoiceMetadata(row.e_invoice_metadata), billingModule: modules.size > 1 ? 'mixed' : modules.size === 1 ? [...modules][0] : null,
        updatedAt: text(row.updated_at), createdAt: text(row.created_at), recipient, recipientType: nullableText(row.recipient_type) as OfficeInvoiceRecipientType | null, billingParty: nullableText(row.billing_party) as OfficeInvoiceBillingParty | null, officeManaged: row.office_managed === true, notes: nullableText(row.notes), footerText: nullableText(row.footer_text),
        includeProofs: row.include_service_proofs === true, selectedProofIds: Array.isArray(row.selected_proof_ids) ? row.selected_proof_ids.filter((id): id is string => typeof id === 'string') : [], companySnapshot: row.company_snapshot && typeof row.company_snapshot === 'object' && !Array.isArray(row.company_snapshot) ? row.company_snapshot as Record<string, unknown> : null, lines, issues, pdfFilePath: nullableText(row.pdf_file_path), cancellationReason: nullableText(row.cancellation_reason) };
}
async function loadInvoices(tenantId: string, invoiceId?: string): Promise<OfficeInvoice[]> {
    const invoices = await readAll(tenantId, 'invoices', INVOICE_COLUMNS, invoiceId ? { id: invoiceId } : {});
    if (!invoices.length)
        return [];
    const neededClientIds = [...new Set(invoices.filter(row => !row.customer_snapshot || row.status === 'draft').map(row => text(row.client_id)).filter(Boolean))];
    const [items, clients] = await Promise.all([
        readAll(tenantId, 'invoice_items', ITEM_COLUMNS, invoiceId ? { invoice_id: invoiceId } : {}),
        readIds(tenantId, 'clients', CLIENT_COLUMNS, neededClientIds),
    ]);
    const sourceIds = [...new Set(items.map(item => text(item.service_record_id)).filter(Boolean))];
    const sourceRows = invoiceId && invoices[0].status === 'draft' ? await readIds(tenantId, 'service_records', 'id,tenant_id,updated_at', sourceIds) : [];
    const sources = new Map(sourceRows.map(row => [text(row.id), row]));
    const clientMap = new Map(clients.map(row => [text(row.id), row]));
    const itemsByInvoice = new Map<string, Row[]>();
    items.forEach(item => { const list = itemsByInvoice.get(text(item.invoice_id)) ?? []; list.push(item); itemsByInvoice.set(text(item.invoice_id), list); });
    return invoices.map(row => mapInvoice(row, clientMap, itemsByInvoice.get(text(row.id)) ?? [], sources)).sort((a, b) => b.invoiceDate.localeCompare(a.invoiceDate) || b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id));
}
export async function fetchOfficeInvoices(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoice[]>> {
    const denied = checkAccess<OfficeInvoice[]>(tenantId, role, 'office.invoices.view');
    if (denied)
        return denied;
    try {
        return { ok: true, data: await loadInvoices(tenantId) };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Die Rechnungen konnten nicht geladen werden.' };
    }
}
export async function fetchOfficeInvoice(tenantId: string, invoiceId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoice>> {
    const denied = checkAccess<OfficeInvoice>(tenantId, role, 'office.invoices.view');
    if (denied)
        return denied;
    if (!isOfficeInvoiceUuid(invoiceId))
        return { ok: false, error: 'Die Rechnungskennung ist ungültig.' };
    try {
        const [invoice] = await loadInvoices(tenantId, invoiceId);
        return invoice ? { ok: true, data: invoice } : { ok: false, error: 'Die Rechnung wurde nicht gefunden oder ist nicht mehr zugänglich.' };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Die Rechnung konnte nicht geladen werden.' };
    }
}
export async function fetchOfficeInvoiceEditorOptions(tenantId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceEditorOptions>> {
    const denied = checkAccess<OfficeInvoiceEditorOptions>(tenantId, role, 'office.invoices.create');
    if (denied)
        return denied;
    try {
        const [clientRows, catalogRows, prices] = await Promise.all([
            readAll(tenantId, 'clients', CLIENT_COLUMNS),
            readAll(tenantId, 'tenant_service_catalog', 'id,tenant_id,name,description,unit,module_key,category,is_active,sort_order'),
            readAll(tenantId, 'tenant_service_prices', 'id,tenant_id,catalog_id,price_net,tax_rate,tax_mode,is_default,valid_from,valid_to'),
        ]);
        const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
        const currentPrices = prices.filter(price => price.is_default === true && text(price.valid_from) <= today && (!price.valid_to || text(price.valid_to) >= today));
        const catalog = catalogRows.filter(row => row.is_active === true && ['service', 'travel'].includes(text(row.category)) && ['assist', 'pflege', 'stationaer', 'beratung'].includes(text(row.module_key)))
            .sort((a, b) => number(a.sort_order) - number(b.sort_order)).flatMap((row): OfficeInvoiceCatalogOption[] => {
            const matching = currentPrices.filter(price => price.catalog_id === row.id);
            if (!matching.length)
                return [];
            if (matching.length > 1)
                throw new Error('Der Leistungskatalog enthält mehrere aktuelle Standardpreise für dieselbe Leistung. Bitte die Preise prüfen.');
            const price = matching[0], unitPriceCents = money(price.price_net), taxRatePercent = number(price.tax_rate);
            if (unitPriceCents === null || !Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 100)
                throw new Error('Ein Katalogpreis ist ungültig. Bitte den Leistungskatalog prüfen.');
            if (text(row.unit) === 'percent')
                return [];
            return [{ id: text(row.id), name: text(row.name), description: text(row.description), unit: text(row.unit), productKey: text(row.module_key) as OfficeInvoiceProductKey,
                    unitPriceCents, taxRatePercent, taxNotice: price.tax_mode === 'exempt_4_16' ? 'Umsatzsteuerfreie Leistung gemäß § 4 Nr. 16 UStG.' : price.tax_mode === 'kleinunternehmer_19' ? 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.' : '' }];
        });
        return { ok: true, data: { clients: clientRows.filter(row => !row.deleted_at).map(mapClient).sort((a, b) => a.name.localeCompare(b.name, 'de')), catalog } };
    }
    catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Die Rechnungsauswahl konnte nicht geladen werden.' };
    }
}
type Operation = 'save_draft' | 'delete_draft' | 'set_status' | 'record_payment';
async function mutate(tenantId: string, invoiceId: string | null, expectedUpdatedAt: string | null, requestId: string, operation: Operation, payload: Row): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
    if (!isOfficeInvoiceUuid(requestId) || (invoiceId && (!isOfficeInvoiceUuid(invoiceId) || !expectedUpdatedAt || !Number.isFinite(Date.parse(expectedUpdatedAt)))))
        return { ok: false, error: 'Der Bearbeitungsstand fehlt. Bitte die Rechnung erneut laden.' };
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die Datenbank ist nicht erreichbar. Bitte erneut versuchen.' };
    try {
        const rpc = client as unknown as {
            rpc: (name: string, input: Row) => Promise<{
                data: unknown;
                error: {
                    message?: string;
                    code?: string;
                } | null;
            }>;
        };
        const { data, error } = await rpc.rpc('office_invoice_mutation', { p_tenant_id: tenantId, p_request_id: requestId, p_invoice_id: invoiceId,
            p_expected_updated_at: expectedUpdatedAt, p_operation: operation, p_payload: payload });
        if (error) {
            if (error.code === 'PGRST202' || error.code === '42883')
                return { ok: false, error: 'Die Rechnungsbearbeitung ist noch nicht freigeschaltet. Bitte nach der Aktualisierung erneut versuchen.' };
            return { ok: false, error: error.message || 'Die Rechnung konnte nicht gespeichert werden.' };
        }
        const result = Array.isArray(data) ? data[0] as Row | undefined : data as Row | null;
        if (!result || !isOfficeInvoiceUuid(text(result.invoice_id)) || (invoiceId && result.invoice_id !== invoiceId) || !Number.isFinite(Date.parse(text(result.updated_at))))
            return { ok: false, error: 'Die Bestätigung konnte nicht gelesen werden. Bitte neu laden, bevor du den Vorgang wiederholst.' };
        return { ok: true, data: { id: text(result.invoice_id), updatedAt: text(result.updated_at) } };
    }
    catch {
        return { ok: false, error: 'Die Verbindung wurde unterbrochen. Bitte neu laden und den gespeicherten Stand prüfen.' };
    }
}
function serializeLine(line: OfficeInvoiceDraftLine): Row {
    return { id: line.id ?? null, description: line.description.trim(), quantity: line.quantity, unit: line.unit.trim(), unit_price_cents: line.unitPriceCents,
        vat_rate: line.taxRatePercent, product_key: line.productKey, service_date: line.serviceDate || null, service_record_id: line.serviceRecordId || null, source_updated_at: line.sourceUpdatedAt || null,
        ...(line.eInvoiceTax ? { e_invoice_tax: line.eInvoiceTax } : {}) };
}
export async function saveOfficeInvoiceDraft(tenantId: string, input: InvoiceOfficeDraft, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
    const denied = checkAccess<OfficeInvoiceMutationResult>(tenantId, role, 'office.invoices.create');
    if (denied)
        return denied;
    const issues = validateOfficeInvoiceDraft(input);
    if (issues.length)
        return { ok: false, error: issues.join(' ') };
    return mutate(tenantId, input.id ?? null, input.expectedUpdatedAt ?? null, input.requestId, 'save_draft', {
        client_id: input.clientId, recipient_type: input.recipientType, billing_party: input.billingParty, invoice_number: input.invoiceNumber.trim(), invoice_date: input.invoiceDate, due_date: input.dueDate,
        service_period_from: input.servicePeriodStart, service_period_to: input.servicePeriodEnd,
        recipient_name: input.recipient.name.trim(), recipient_street: input.recipient.street.trim(), recipient_house_number: input.recipient.houseNumber.trim(),
        recipient_postal_code: input.recipient.postalCode.trim(), recipient_city: input.recipient.city.trim(), recipient_country: input.recipient.country.trim(), recipient_email: input.recipient.email.trim(),
        notes: input.notes.trim(), footer_text: input.footerText.trim(), include_service_proofs: input.includeProofs, selected_proof_ids: input.selectedProofIds ?? [], lines: input.lines.map(serializeLine),
        ...(input.eInvoice ? { e_invoice_metadata: input.eInvoice } : {}),
    });
}
export async function deleteOfficeInvoiceDraft(tenantId: string, invoiceId: string, expectedUpdatedAt: string, requestId: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
    const denied = checkAccess<OfficeInvoiceMutationResult>(tenantId, role, 'office.invoices.status_change');
    if (denied)
        return denied;
    return mutate(tenantId, invoiceId, expectedUpdatedAt, requestId, 'delete_draft', {});
}
export async function transitionOfficeInvoice(tenantId: string, invoiceId: string, expectedUpdatedAt: string, status: 'ready' | 'sent' | 'draft' | 'cancelled', reason: string, requestId: string, role?: RoleKey | null, delivery?: OfficeInvoiceDeliveryEvidence): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
    const denied = checkAccess<OfficeInvoiceMutationResult>(tenantId, role, 'office.invoices.status_change');
    if (denied)
        return denied;
    if (!['ready', 'sent', 'draft', 'cancelled'].includes(status))
        return { ok: false, error: 'Der Zahlungsstatus wird ausschließlich über gebuchte Zahlungen geändert.' };
    if (status === 'ready')
        return { ok: false, error: 'Bitte die Rechnung über „Rechnung ausstellen“ mit ihrer endgültigen PDF ausstellen.' };
    if (status === 'cancelled' && reason.trim().length < 5)
        return { ok: false, error: 'Bitte einen nachvollziehbaren Stornogrund angeben.' };
    if (status === 'sent' && (!delivery || !['email', 'post', 'personal', 'other'].includes(delivery.channel) || !isOfficeInvoiceDate(delivery.date) || !delivery.reference.trim()))
        return { ok: false, error: 'Bitte Versandweg, Versanddatum und den Nachweis des erfolgten Versands angeben.' };
    if (status === 'sent' && delivery!.date > new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date()))
        return { ok: false, error: 'Der bestätigte Versand darf nicht in der Zukunft liegen.' };
    return mutate(tenantId, invoiceId, expectedUpdatedAt, requestId, 'set_status', { status, reason: reason.trim(),
        ...(delivery ? { delivery_channel: delivery.channel, delivery_date: delivery.date, delivery_reference: delivery.reference.trim() } : {}) });
}
export async function fetchOfficeInvoiceIssuePreview(tenantId: string, invoiceId: string, expectedUpdatedAt: string, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceIssuePreview>> {
    const denied = checkAccess<OfficeInvoiceIssuePreview>(tenantId, role, 'office.invoices.status_change');
    if (denied)
        return denied;
    if (!isOfficeInvoiceUuid(invoiceId) || !Number.isFinite(Date.parse(expectedUpdatedAt)))
        return { ok: false, error: 'Bitte die Rechnung neu laden, bevor sie ausgestellt wird.' };
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die Datenbank ist nicht erreichbar.' };
    try {
        const rpc = client as unknown as {
            rpc: (name: string, payload: Row) => Promise<{
                data: unknown;
                error: {
                    message?: string;
                } | null;
            }>;
        };
        const { data, error } = await rpc.rpc('office_invoice_issue_preview', { p_tenant_id: tenantId, p_invoice_id: invoiceId, p_expected_updated_at: expectedUpdatedAt });
        if (error)
            return { ok: false, error: error.message || 'Die Ausstellung konnte nicht vorbereitet werden.' };
        const row = (Array.isArray(data) ? data[0] : data) as Row | null;
        if (!row || !text(row.invoice_number) || !text(row.source_revision) || !row.company_snapshot || typeof row.company_snapshot !== 'object' || Array.isArray(row.company_snapshot))
            return { ok: false, error: 'Die Ausstellungsdaten sind unvollständig. Bitte erneut laden.' };
        return { ok: true, data: { invoiceNumber: text(row.invoice_number), sourceRevision: text(row.source_revision), companySnapshot: row.company_snapshot as Row } };
    }
    catch {
        return { ok: false, error: 'Die Ausstellung konnte wegen einer Verbindungsunterbrechung nicht vorbereitet werden.' };
    }
}
export async function finalizeOfficeInvoiceIssue(tenantId: string, invoiceId: string, expectedUpdatedAt: string, input: OfficeInvoiceIssueInput, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
    const denied = checkAccess<OfficeInvoiceMutationResult>(tenantId, role, 'office.invoices.status_change');
    if (denied)
        return denied;
    if (!input.invoiceNumber.trim() || !input.sourceRevision || !input.pdfFilePath || !/^[a-f0-9]{64}$/i.test(input.pdfSha256) || !input.companySnapshot || Array.isArray(input.companySnapshot))
        return { ok: false, error: 'Die endgültige Rechnungsdatei ist unvollständig. Bitte die Ausstellung erneut starten.' };
    return mutate(tenantId, invoiceId, expectedUpdatedAt, input.requestId, 'set_status', { status: 'ready', invoice_number: input.invoiceNumber,
        source_revision: input.sourceRevision, company_snapshot: input.companySnapshot, pdf_file_path: input.pdfFilePath, pdf_sha256: input.pdfSha256,
        ...(input.eInvoiceXmlSha256 ? { e_invoice_xml_sha256: input.eInvoiceXmlSha256 } : {}) });
}
export async function recordOfficeInvoicePayment(tenantId: string, invoiceId: string, expectedUpdatedAt: string, input: OfficeInvoicePaymentInput, role?: RoleKey | null): Promise<ServiceResult<OfficeInvoiceMutationResult>> {
    const denied = checkAccess<OfficeInvoiceMutationResult>(tenantId, role, 'office.invoices.status_change');
    if (denied)
        return denied;
    if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 9999999999)
        return { ok: false, error: 'Bitte einen gültigen positiven Zahlungsbetrag angeben.' };
    if (!isOfficeInvoiceDate(input.paymentDate))
        return { ok: false, error: 'Das Zahlungsdatum ist ungültig.' };
    const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());
    if (input.paymentDate > today)
        return { ok: false, error: 'Ein Zahlungseingang kann nicht für einen zukünftigen Tag gebucht werden.' };
    if (!['bank_transfer', 'direct_debit', 'cash', 'card', 'paypal', 'stripe', 'other'].includes(input.method))
        return { ok: false, error: 'Bitte eine gültige Zahlungsart auswählen.' };
    if (!input.reference.trim() || input.reference.length > 500 || input.notes.length > 10000)
        return { ok: false, error: 'Bitte eine Buchungsreferenz mit höchstens 500 Zeichen angeben.' };
    return mutate(tenantId, invoiceId, expectedUpdatedAt, input.requestId, 'record_payment', { amount_cents: input.amountCents, payment_date: input.paymentDate,
        payment_method: input.method, reference: input.reference.trim(), notes: input.notes.trim() });
}
