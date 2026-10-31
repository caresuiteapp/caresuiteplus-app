// Generated native presentation from src/lib/payroll/payrollOfficeActions.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeCrypto as crypto} from '@/lib/platform/nativeWorkflowEnvironment.native';
import type { RoleKey, ServiceResult } from '@/types';
import type { PayrollExpenseClaim, PayrollStatement } from '@/types/modules/payrollMonth';
import { enforcePermission, isPortalOnlyRole } from '@/lib/permissions';
import { guardServiceTenant } from '@/lib/services/liveServiceGuard';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../supabase/client.ts";
import { fromUnknownTable } from '@/lib/supabase/untypedTable';
import { toGermanSupabaseError } from '@/lib/supabase/errors';
import { invokeEdgeFunction } from '@/lib/supabase/edgeFunctions';
import { renderHtmlToPdfBytes } from '@/lib/documents/documentPdfService';
import { buildPayrollStatementHtml, type PayrollWebStatementSnapshot } from "./payrollCalculator.native.ts";
import { payrollPeriodRange, type PayrollOfficeEmployeeMonth } from "./payrollOfficeReadModel.native.ts";
import { listPayrollMonthOverview } from "./payrollMonthService.native.ts";
type Row = Record<string, unknown>;
type Client = NonNullable<ReturnType<typeof getSupabaseClient>>;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const staleMessage = 'Die Monatsdaten wurden inzwischen geändert. Bitte aktualisieren und die Werte erneut prüfen.';
const text = (value: unknown): string => typeof value === 'string' ? value : '';
const nullable = (value: unknown): string | null => text(value) || null;
const fail = (error: string): {
    ok: false;
    error: string;
} => ({ ok: false, error });
function officeGuard(tenantId: string, role: RoleKey | null | undefined, edit: boolean) {
    if (!role || isPortalOnlyRole(role))
        return fail('Für diese Aktion ist ein Verwaltungszugang erforderlich.');
    const denied = enforcePermission(role, edit ? 'office.employees.edit' : 'office.employees.view');
    if (denied)
        return denied;
    const scope = guardServiceTenant(tenantId);
    if (scope)
        return scope;
    if (getServiceMode() !== 'supabase')
        return fail('Diese Aktion ist nur mit einer aktiven Datenverbindung möglich.');
    if (!UUID.test(tenantId))
        return fail('Der Mandant ist ungültig.');
    return null;
}
function mapStatement(row: Row): PayrollStatement {
    return { id: text(row.id), tenantId: text(row.tenant_id), employeeId: text(row.employee_id),
        periodYear: Number(row.period_year), periodMonth: Number(row.period_month), version: Number(row.version),
        status: row.status as PayrollStatement['status'], snapshot: row.snapshot_json as PayrollStatement['snapshot'],
        pdfPath: nullable(row.pdf_path), pdfSha256: nullable(row.pdf_sha256), employeeDecisionReason: nullable(row.employee_decision_reason),
        publishedAt: nullable(row.published_at), confirmedAt: nullable(row.confirmed_at), rejectedAt: nullable(row.rejected_at),
        lockedAt: nullable(row.locked_at), createdAt: text(row.created_at), updatedAt: text(row.updated_at) };
}
function mapExpense(row: Row): PayrollExpenseClaim {
    return { id: text(row.id), tenantId: text(row.tenant_id), employeeId: text(row.employee_id), expenseDate: text(row.expense_date),
        category: row.category as PayrollExpenseClaim['category'], description: text(row.description), amountCents: Number(row.amount_cents),
        approvedAmountCents: row.approved_amount_cents == null ? null : Number(row.approved_amount_cents), currency: text(row.currency),
        assignmentId: nullable(row.assignment_id), clientId: nullable(row.client_id), paymentMethod: nullable(row.payment_method),
        receiptNumber: nullable(row.receipt_number), receiptPath: nullable(row.receipt_path), mileageKm: row.mileage_km == null ? null : Number(row.mileage_km),
        mileageRateCents: row.mileage_rate_cents == null ? null : Number(row.mileage_rate_cents), origin: nullable(row.origin), destination: nullable(row.destination),
        vehicleLabel: nullable(row.vehicle_label), drivingLogId: nullable(row.driving_log_id), travelType: row.travel_type as PayrollExpenseClaim['travelType'],
        automaticSource: row.automatic_source === true, businessPurpose: text(row.business_purpose), taxTreatment: row.tax_treatment as PayrollExpenseClaim['taxTreatment'],
        status: row.status as PayrollExpenseClaim['status'], officeNote: nullable(row.office_note), rejectionReason: nullable(row.rejection_reason),
        submittedAt: nullable(row.submitted_at), reviewedAt: nullable(row.reviewed_at), createdAt: text(row.created_at), updatedAt: text(row.updated_at) };
}
/** Sort object keys, not array order. Only the calculation timestamp is volatile. */
export function payrollPublicationComparable(value: unknown): string {
    function stable(item: unknown): unknown {
        if (Array.isArray(item))
            return item.map(stable);
        if (item && typeof item === 'object')
            return Object.fromEntries(Object.entries(item)
                .filter(([key, data]) => key !== 'generatedAt' && data !== undefined).sort(([a], [b]) => a.localeCompare(b))
                .map(([key, data]) => [key, stable(data)]));
        return item;
    }
    return JSON.stringify(stable(value));
}
export function payrollSnapshotForPublication(employee: PayrollOfficeEmployeeMonth): PayrollWebStatementSnapshot {
    const { latestStatement, pendingPortalUploads, calculationReady, blockers, warnings, unapprovedEntryCount, employmentStatus, statementHistory, preview, ...snapshot } = employee;
    void latestStatement;
    void pendingPortalUploads;
    void calculationReady;
    void blockers;
    void warnings;
    void unapprovedEntryCount;
    void employmentStatus;
    void statementHistory;
    void preview;
    return snapshot;
}
function publicationProblem(employee: PayrollOfficeEmployeeMonth): string | null {
    if (!UUID.test(employee.employeeId))
        return 'Die Mitarbeitendenzuordnung fehlt.';
    try {
        payrollPeriodRange(employee.periodYear, employee.periodMonth);
    }
    catch (error) {
        return error instanceof Error ? error.message : 'Ungültiger Abrechnungsmonat.';
    }
    if (!employee.calculationReady || employee.blockers.length)
        return employee.blockers.join(' ') || 'Die Monatsdaten sind noch nicht vollständig geprüft.';
    if ([employee.latestStatement, ...employee.statementHistory].some(statement => statement && ['confirmed', 'locked', 'paid'].includes(statement.status)))
        return 'Eine bestätigte, gesperrte oder ausgezahlte Monatsübersicht kann nicht ersetzt werden.';
    const snapshot = payrollSnapshotForPublication(employee);
    if (Object.entries(snapshot).some(([key, value]) => typeof value === 'number' && (!Number.isFinite(value) || !Number.isSafeInteger(value) || Math.abs(value) > 2147483647 || (value < 0 && !['timeAccountBalanceMinutes', 'targetActualDifferenceMinutes'].includes(key))))) {
        return 'Die Monatsberechnung enthält ungültige Zahlen. Bitte die Quelldaten prüfen.';
    }
    return null;
}
/** Drafts also consume a server version, even while an older publication is visible. */
function publicationHead(employee: PayrollOfficeEmployeeMonth): PayrollStatement | null {
    return [employee.latestStatement, ...employee.statementHistory].filter((item): item is PayrollStatement => Boolean(item))
        .sort((a, b) => b.version - a.version)[0] ?? null;
}
function publicationFingerprint(employee: PayrollOfficeEmployeeMonth): string {
    const head = publicationHead(employee);
    return payrollPublicationComparable({ snapshot: payrollSnapshotForPublication(employee), latest: employee.latestStatement,
        head: head ? { id: head.id, version: head.version, updatedAt: head.updatedAt, status: head.status } : null });
}
async function actorId(db: Client): Promise<string> {
    const response = await db.auth.getUser();
    if (response.error || !response.data.user?.id)
        throw new Error('Bitte erneut anmelden.');
    return response.data.user.id;
}
async function requireSameActor(db: Client, expected: string) {
    if (await actorId(db) !== expected)
        throw new Error('Die Anmeldung hat sich geändert. Bitte die Monatsdaten neu laden.');
}
async function sourceRevision(db: Client, tenantId: string, employee: PayrollOfficeEmployeeMonth): Promise<string> {
    // This additive RPC is not yet represented in generated database types.
    // Keep its payload unknown until the response has been validated below.
    const revisionClient = db as unknown as {
        rpc(name: 'payroll_office_source_revision', args: {
            p_tenant_id: string;
            p_employee_id: string;
            p_year: number;
            p_month: number;
        }): PromiseLike<{
            data: unknown;
            error: import('@supabase/supabase-js').PostgrestError | null;
        }>;
    };
    const response = await revisionClient.rpc('payroll_office_source_revision', {
        p_tenant_id: tenantId, p_employee_id: employee.employeeId, p_year: employee.periodYear, p_month: employee.periodMonth,
    });
    if (response.error)
        throw new Error(toGermanSupabaseError(response.error));
    if (typeof response.data !== 'string' || !/^[0-9a-f]{32}$/.test(response.data))
        throw new Error('Der aktuelle Datenstand konnte nicht bestätigt werden.');
    return response.data;
}
async function bytesSha256(bytes: Uint8Array): Promise<string> {
    if (!crypto?.subtle)
        throw new Error('Die sichere PDF-Prüfsumme ist in diesem Browser nicht verfügbar.');
    const hash = await crypto.subtle.digest('SHA-256', new Uint8Array(bytes));
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}
function bytesBase64(bytes: Uint8Array): string {
    let result = '';
    for (let index = 0; index < bytes.length; index += 8192)
        result += String.fromCharCode(...bytes.subarray(index, index + 8192));
    return btoa(result);
}
type PublicationAttempt = {
    fingerprint: string;
    id: string;
    snapshot: PayrollWebStatementSnapshot;
    revision: string;
    expectedVersion: number;
    expectedUpdatedAt: string | null;
    pdfPath: string;
    sha256: string;
};
const attempts = new Map<string, PublicationAttempt>();
const inFlight = new Map<string, Promise<ServiceResult<PayrollStatement>>>();
async function commitPublication(db: Client, tenantId: string, userId: string, attempt: PublicationAttempt): Promise<ServiceResult<PayrollStatement>> {
    await requireSameActor(db, userId);
    const result = await db.rpc('publish_office_payroll_statement' as never, {
        p_tenant_id: tenantId, p_employee_id: attempt.snapshot.employeeId, p_year: attempt.snapshot.periodYear, p_month: attempt.snapshot.periodMonth,
        p_statement_id: attempt.id, p_expected_version: attempt.expectedVersion, p_expected_updated_at: attempt.expectedUpdatedAt,
        p_source_revision: attempt.revision, p_snapshot: attempt.snapshot, p_pdf_path: attempt.pdfPath, p_pdf_sha256: attempt.sha256,
    } as never);
    if (result.error) {
        // A definite server rejection needs fresh source data on the next attempt.
        // Network/lost-response errors retain the request for an idempotent replay.
        if (['40001', 'P0001', '42501', '23505', '23514'].includes(result.error.code)) {
            for (const [key, stored] of attempts)
                if (stored.id === attempt.id)
                    attempts.delete(key);
        }
        return fail(toGermanSupabaseError(result.error));
    }
    const data: unknown = result.data;
    if (!data || typeof data !== 'object' || Array.isArray(data))
        return fail('Die Veröffentlichung wurde nicht bestätigt. Bitte erneut versuchen.');
    const statement = mapStatement(data as Row);
    if (statement.id !== attempt.id || statement.tenantId !== tenantId || statement.employeeId !== attempt.snapshot.employeeId
        || statement.periodYear !== attempt.snapshot.periodYear || statement.periodMonth !== attempt.snapshot.periodMonth
        || statement.version !== attempt.expectedVersion + 1 || statement.pdfPath !== attempt.pdfPath || statement.pdfSha256 !== attempt.sha256
        || !['published', 'confirmed', 'rejected', 'locked', 'paid'].includes(statement.status)
        || payrollPublicationComparable(statement.snapshot) !== payrollPublicationComparable(attempt.snapshot))
        return fail('Die veröffentlichte Version stimmt nicht mit der geprüften Übersicht überein. Bitte aktualisieren.');
    return { ok: true, data: statement };
}
async function publish(tenantId: string, employee: PayrollOfficeEmployeeMonth, role: RoleKey | null | undefined): Promise<ServiceResult<PayrollStatement>> {
    const denied = officeGuard(tenantId, role, true);
    if (denied)
        return denied;
    const issue = publicationProblem(employee);
    if (issue)
        return fail(issue);
    const db = getSupabaseClient();
    if (!db)
        return fail('Die Datenverbindung ist nicht verfügbar.');
    try {
        const userId = await actorId(db);
        const key = `${userId}:${tenantId}:${employee.employeeId}:${employee.periodYear}:${employee.periodMonth}`;
        const fingerprint = publicationFingerprint(employee);
        const retry = attempts.get(key);
        // Retain the exact request after an ambiguous response. The RPC returns that
        // publication again even if the employee has already confirmed it meanwhile.
        if (retry?.fingerprint === fingerprint)
            return await commitPublication(db, tenantId, userId, retry);
        attempts.delete(key);
        const before = await sourceRevision(db, tenantId, employee);
        const refreshed = await listPayrollMonthOverview(tenantId, employee.periodYear, employee.periodMonth, role);
        if (!refreshed.ok)
            return refreshed;
        const fresh = refreshed.data.employees.find(item => item.employeeId === employee.employeeId);
        if (!fresh)
            return fail('Die Mitarbeitendenzuordnung ist nicht mehr im Abrechnungsmonat vorhanden.');
        const freshIssue = publicationProblem(fresh);
        if (freshIssue)
            return fail(freshIssue);
        if (publicationFingerprint(fresh) !== fingerprint)
            return fail(staleMessage);
        const revision = await sourceRevision(db, tenantId, fresh);
        if (before !== revision)
            return fail(staleMessage);
        const latest = publicationHead(fresh);
        if (latest && (!Number.isSafeInteger(latest.version) || latest.version < 1 || !Number.isFinite(Date.parse(latest.updatedAt))))
            return fail('Der Stand der bisherigen Veröffentlichung fehlt. Bitte aktualisieren.');
        if (!crypto?.randomUUID)
            return fail('Die sichere Veröffentlichungskennung ist in diesem Browser nicht verfügbar.');
        const id = crypto.randomUUID();
        const snapshot = payrollSnapshotForPublication(fresh);
        const pdfBytes = await renderHtmlToPdfBytes(buildPayrollStatementHtml(snapshot, (latest?.version ?? 0) + 1));
        const sha256 = await bytesSha256(pdfBytes);
        await requireSameActor(db, userId);
        const uploaded = await invokeEdgeFunction<{
            pdfPath?: string;
            sha256?: string;
        }>('render-document-pdf', {
            tenantId, employeeId: employee.employeeId, documentId: `payroll-${id}`, pdfBase64: bytesBase64(pdfBytes), storeOnly: true,
        });
        if (!uploaded.ok)
            return uploaded;
        const pdfPath = `tenant/${tenantId}/generated/payroll-${id}/${sha256}.pdf`;
        if (uploaded.data.pdfPath !== pdfPath || uploaded.data.sha256 !== sha256)
            return fail('Der gespeicherte PDF-Inhalt konnte nicht bestätigt werden.');
        const attempt: PublicationAttempt = { fingerprint, id, snapshot, revision, expectedVersion: latest?.version ?? 0, expectedUpdatedAt: latest?.updatedAt ?? null, pdfPath, sha256 };
        attempts.set(key, attempt);
        // No separate supersede/insert calls: PDF visibility and audit commit together.
        return await commitPublication(db, tenantId, userId, attempt);
    }
    catch (error) {
        return fail(error instanceof Error ? error.message : 'Die Veröffentlichung konnte nicht bestätigt werden.');
    }
}
export async function publishPayrollStatement(tenantId: string, employee: PayrollOfficeEmployeeMonth, role?: RoleKey | null): Promise<ServiceResult<PayrollStatement>> {
    const denied = officeGuard(tenantId, role, true);
    if (denied)
        return denied;
    const db = getSupabaseClient();
    if (!db)
        return fail('Die Datenverbindung ist nicht verfügbar.');
    try {
        const user = await actorId(db);
        const key = `${user}:${tenantId}:${employee.employeeId}:${employee.periodYear}:${employee.periodMonth}`;
        const existing = inFlight.get(key);
        if (existing)
            return existing;
        const task = publish(tenantId, employee, role).finally(() => { if (inFlight.get(key) === task)
            inFlight.delete(key); });
        inFlight.set(key, task);
        return task;
    }
    catch (error) {
        return fail(error instanceof Error ? error.message : 'Bitte erneut anmelden.');
    }
}
export type PayrollOfficeExpenseReviewInput = {
    tenantId: string;
    employeeId: string;
    year: number;
    month: number;
    claimId: string;
    expectedUpdatedAt: string;
    status: 'approved' | 'partially_approved' | 'rejected' | 'needs_info';
    approvedAmountCents?: number | null;
    officeNote?: string | null;
    rejectionReason?: string | null;
};
export async function reviewExpenseClaim(input: PayrollOfficeExpenseReviewInput, role?: RoleKey | null): Promise<ServiceResult<PayrollExpenseClaim>> {
    const denied = officeGuard(input.tenantId, role, true);
    if (denied)
        return denied;
    const db = getSupabaseClient();
    if (!db)
        return fail('Die Datenverbindung ist nicht verfügbar.');
    try {
        payrollPeriodRange(input.year, input.month);
        if (!UUID.test(input.employeeId) || !UUID.test(input.claimId) || !Number.isFinite(Date.parse(input.expectedUpdatedAt)))
            return fail('Die Zuordnung oder der aktuelle Bearbeitungsstand fehlt. Bitte aktualisieren.');
        const approved = input.status === 'approved' || input.status === 'partially_approved';
        if (!['approved', 'partially_approved', 'rejected', 'needs_info'].includes(input.status))
            return fail('Bitte eine gültige Prüfentscheidung auswählen.');
        if (approved && (input.approvedAmountCents == null || !Number.isSafeInteger(input.approvedAmountCents) || input.approvedAmountCents < 0 || input.approvedAmountCents > 2147483647))
            return fail('Bitte einen gültigen genehmigten Centbetrag angeben.');
        if (['partially_approved', 'needs_info'].includes(input.status) && (input.officeNote?.trim().length ?? 0) < 5)
            return fail('Bitte die Kürzung oder Rückfrage mit mindestens fünf Zeichen begründen.');
        if (input.status === 'rejected' && (input.rejectionReason?.trim().length ?? 0) < 5)
            return fail('Bitte die Ablehnung mit mindestens fünf Zeichen begründen.');
        await actorId(db);
        const result = await db.rpc('review_office_payroll_expense' as never, {
            p_tenant_id: input.tenantId, p_employee_id: input.employeeId, p_year: input.year, p_month: input.month,
            p_claim_id: input.claimId, p_expected_updated_at: input.expectedUpdatedAt, p_status: input.status,
            p_approved_amount_cents: approved ? input.approvedAmountCents : null, p_office_note: input.officeNote?.trim() || null,
            p_rejection_reason: input.status === 'rejected' ? input.rejectionReason?.trim() || null : null,
        } as never);
        if (result.error)
            return fail(toGermanSupabaseError(result.error));
        const data: unknown = result.data;
        if (!data || typeof data !== 'object' || Array.isArray(data))
            return fail('Die Prüfentscheidung wurde nicht bestätigt. Bitte aktualisieren.');
        const claim = mapExpense(data as Row);
        if (claim.id !== input.claimId || claim.tenantId !== input.tenantId || claim.employeeId !== input.employeeId
            || claim.expenseDate.slice(0, 7) !== `${input.year}-${String(input.month).padStart(2, '0')}` || claim.status !== input.status
            || claim.approvedAmountCents !== (approved ? input.approvedAmountCents : null))
            return fail('Die gespeicherte Entscheidung stimmt nicht mit der Anfrage überein. Bitte aktualisieren.');
        return { ok: true, data: claim };
    }
    catch (error) {
        return fail(error instanceof Error ? error.message : 'Die Auslage konnte nicht geprüft werden.');
    }
}
export type PayrollOfficeDocumentContext = {
    tenantId: string;
    employeeId: string;
    kind: 'statement' | 'expense' | 'portal';
    documentId: string;
};
export async function getPayrollPdfUrl(path: string, context: PayrollOfficeDocumentContext, role?: RoleKey | null): Promise<ServiceResult<string>> {
    if (!context)
        return fail('Die Dokumentzuordnung fehlt.');
    const denied = officeGuard(context.tenantId, role, false);
    if (denied)
        return denied;
    if (!UUID.test(context.employeeId) || !UUID.test(context.documentId) || !path || /(?:\.\.|\\|[?#%])/.test(path))
        return fail('Die Dokumentzuordnung ist ungültig.');
    const db = getSupabaseClient();
    if (!db)
        return fail('Die Datenverbindung ist nicht verfügbar.');
    try {
        const userId = await actorId(db);
        const spec = context.kind === 'statement' ? { table: 'payroll_month_statements', column: 'pdf_path', prefixes: [`tenant/${context.tenantId}/generated/`, `${context.tenantId}/generated/`] }
            : context.kind === 'expense' ? { table: 'employee_expense_claims', column: 'receipt_path', prefixes: [`${context.tenantId}/payroll/expenses/${context.employeeId}/`] }
                : context.kind === 'portal' ? { table: 'portal_uploads', column: 'storage_path', prefixes: [`tenant/${context.tenantId}/employees/${context.employeeId}/portal-uploads/`] } : null;
        if (!spec)
            return fail('Unbekannte Dokumentart.');
        const result = await fromUnknownTable(db, spec.table).select(`id,tenant_id,employee_id,${spec.column}${context.kind === 'portal' ? ',upload_context' : ''}`)
            .eq('tenant_id', context.tenantId).eq('employee_id', context.employeeId).eq('id', context.documentId).single();
        if (result.error || !result.data)
            return fail(result.error ? toGermanSupabaseError(result.error) : 'Das Dokument ist nicht mehr zugänglich.');
        const row = result.data as unknown as Row;
        if (row.tenant_id !== context.tenantId || row.employee_id !== context.employeeId || row.id !== context.documentId || row[spec.column] !== path
            || !spec.prefixes.some(prefix => path.startsWith(prefix)) || (context.kind === 'portal' && row.upload_context !== 'mitarbeiter'))
            return fail('Das Dokument gehört nicht zur ausgewählten Person.');
        await requireSameActor(db, userId);
        const signed = await db.storage.from('office-documents').createSignedUrl(path, 300);
        if (signed.error || !signed.data?.signedUrl)
            return fail(signed.error?.message ?? 'Das Dokument konnte nicht geöffnet werden.');
        return { ok: true, data: signed.data.signedUrl };
    }
    catch (error) {
        return fail(error instanceof Error ? error.message : 'Das Dokument konnte nicht geöffnet werden.');
    }
}
