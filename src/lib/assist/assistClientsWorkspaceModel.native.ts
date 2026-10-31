// Generated native presentation from src/lib/assist/assistClientsWorkspaceModel.web.ts. Update through scripts/port-native-workspaces.mjs.
/** Read-only model for the Web Assist overview. Dates and recurring times always use Berlin. */
export type AssistWorkspaceRow = Record<string, unknown>;
export type AssistWorkspaceFilter = 'all' | 'attention' | 'planned' | 'unplanned';
export type AssistWorkspaceVisit = {
    id: string;
    clientId: string;
    title: string;
    serviceName: string | null;
    scheduledStart: string;
    scheduledEnd: string;
    durationMinutes: number;
    employeeId: string | null;
    employeeName: string | null;
    status: 'planned' | 'confirmed' | 'active';
    statusLabel: string;
};
export type AssistWorkspaceClient = {
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    clientNumber: string | null;
    dateOfBirth: string | null;
    careLevel: string | null;
    careLevelLabel: string;
    costCarrier: string | null;
    insuranceNumber: string | null;
    selfPay: boolean;
    phone: string | null;
    mobile: string | null;
    email: string | null;
    street: string | null;
    postalCode: string | null;
    city: string | null;
    address: string | null;
    assignmentId: string;
    assignedAt: string | null;
    primaryEmployeeId: string | null;
    primaryEmployeeName: string | null;
    primaryEmployeeAvailable: boolean;
    missingFields: string[];
    warnings: string[];
    upcomingVisits: AssistWorkspaceVisit[];
    nextVisit: AssistWorkspaceVisit | null;
    sevenDayVisitCount: number | null;
    planningStatus: 'planned' | 'unplanned' | 'unknown';
    needsAttention: boolean;
    statusLabel: string;
};
export type AssistWorkspaceCoverage = {
    fromDate: string;
    toDate: string;
    sevenDayToDate: string;
};
export type AssistClientsWorkspaceSnapshot = {
    clients: AssistWorkspaceClient[];
    loadedAt: string;
    coverage: AssistWorkspaceCoverage;
    visitsAvailable: boolean;
    visitsError: string | null;
    warnings: string[];
};
export type AssistWorkspaceSource = {
    tenantId: string;
    now: Date;
    assignments: AssistWorkspaceRow[];
    people: AssistWorkspaceRow[];
    entitlements: AssistWorkspaceRow[];
    careLevels: AssistWorkspaceRow[];
    insurance: AssistWorkspaceRow[];
    employees: AssistWorkspaceRow[];
    visits: AssistWorkspaceRow[];
    legacyAssignments?: AssistWorkspaceRow[];
    executionStates?: AssistWorkspaceRow[];
    employeesAvailable: boolean;
    visitsAvailable: boolean;
    visitsError?: string | null;
};
const EMPTY_TEXT = new Set(['-', '–', '—', '.', 'n/a', 'null', 'undefined', 'nicht hinterlegt', 'keine angabe', 'unbekannt']);
export function assistText(value: unknown): string | null {
    const result = typeof value === 'string' ? value.trim() : '';
    return result && !EMPTY_TEXT.has(result.toLocaleLowerCase('de-DE')) ? result : null;
}
export function validAssistDate(value: unknown): value is string {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000'))
        return false;
    const parsed = new Date(`${value}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
const berlinFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function berlinParts(value: string | number | Date) {
    const parts = berlinFormatter.formatToParts(new Date(value));
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}:${part('second')}` };
}
export function assistBerlinDate(value: Date): string { return berlinParts(value).date; }
export function addAssistDays(date: string, days: number): string {
    if (!validAssistDate(date))
        throw new Error('Ungültiger Planungstag.');
    return new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
}
export function assistWorkspaceCoverage(now: Date): AssistWorkspaceCoverage {
    const fromDate = assistBerlinDate(now);
    return { fromDate, toDate: addAssistDays(fromDate, 89), sevenDayToDate: addAssistDays(fromDate, 6) };
}
export function assistBerlinTimestamp(date: string, time = '00:00:00'): string {
    if (!validAssistDate(date) || !/^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(time))
        throw new Error('Ungültige Einsatzzeit.');
    const target = Date.parse(`${date}T${time}Z`);
    let utc = target;
    for (let index = 0; index < 4; index++) {
        const local = berlinParts(utc);
        const delta = target - Date.parse(`${local.date}T${local.time}Z`);
        if (!delta)
            return new Date(utc).toISOString();
        utc += delta;
    }
    throw new Error('Eine Serienzeit liegt in der Zeitumstellung und muss geprüft werden.');
}
const activeAssignmentStatuses = new Set(['active', 'aktiv', 'enabled', 'assigned', 'approved', 'freigegeben', 'confirmed', 'bestaetigt', 'bestätigt']);
export function activeAssistAssignments(rows: AssistWorkspaceRow[], tenantId: string, now: Date): AssistWorkspaceRow[] {
    const byClient = new Map<string, AssistWorkspaceRow>();
    for (const row of rows) {
        if (row.tenant_id !== tenantId || row.module_key !== 'assist' || row.is_active !== true
            || !activeAssignmentStatuses.has(String(row.status ?? '').toLowerCase()) || !assistText(row.client_id))
            continue;
        const assignedAt = Date.parse(String(row.assigned_at ?? ''));
        if (!Number.isFinite(assignedAt) || assignedAt > now.getTime())
            continue;
        const current = byClient.get(String(row.client_id));
        const newer = current == null || String(row.updated_at ?? '') > String(current.updated_at ?? '')
            || (row.updated_at === current.updated_at && String(row.id) > String(current.id));
        if (newer)
            byClient.set(String(row.client_id), row);
    }
    return [...byClient.values()];
}
function scopedRows(rows: AssistWorkspaceRow[], tenantId: string): AssistWorkspaceRow[] {
    return rows.filter(row => row.tenant_id === tenantId);
}
function currentRow(rows: AssistWorkspaceRow[], date: string): AssistWorkspaceRow | undefined {
    return rows.filter(row => validAssistDate(row.valid_from) && row.valid_from <= date
        && (row.valid_until == null || (validAssistDate(row.valid_until) && row.valid_until >= date)))
        .sort((a, b) => String(b.valid_from).localeCompare(String(a.valid_from))
        || String(b.updated_at ?? '').localeCompare(String(a.updated_at ?? '')) || String(a.id).localeCompare(String(b.id)))[0];
}
function careGrade(value: unknown): string | null {
    const normalized = String(value ?? '').toLowerCase().replace(/\s/g, '');
    const match = normalized.match(/^(?:pg|pflegegrad)?([1-5])$/);
    if (match)
        return `pg${match[1]}`;
    if (['none', 'kein', 'keiner', '0'].includes(normalized))
        return 'kein';
    return normalized === 'hospiz' ? 'hospiz' : null;
}
function gradeLabel(value: string | null): string {
    return value?.startsWith('pg') ? `Pflegegrad ${value.slice(2)}` : value === 'kein' ? 'Kein Pflegegrad' : value === 'hospiz' ? 'Hospizversorgung' : 'Nicht hinterlegt';
}
function personName(row: AssistWorkspaceRow): string | null {
    return assistText([assistText(row.first_name), assistText(row.last_name)].filter(Boolean).join(' ')) ?? assistText(row.full_name);
}
function employeeIsCurrent(row: AssistWorkspaceRow | undefined, date: string): boolean {
    return Boolean(row && !row.deleted_at && !['inactive', 'inaktiv', 'archived', 'archiviert', 'deleted'].includes(String(row.status))
        && (!row.entry_date || (validAssistDate(row.entry_date) && row.entry_date <= date))
        && (!row.exit_date || (validAssistDate(row.exit_date) && row.exit_date >= date)));
}
const excludedStatuses = new Set(['completed', 'abgeschlossen', 'finished', 'beendet', 'ended', 'documentation_open', 'dokumentation_offen', 'signature_open', 'unterschrift_offen', 'cancelled', 'canceled', 'storniert', 'no_show', 'nicht_erschienen', 'invoiced', 'paid', 'abgerechnet']);
const activeStatuses: Record<string, string> = { on_the_way: 'Unterwegs', on_way: 'Unterwegs', unterwegs: 'Unterwegs', arrived: 'Angekommen', angekommen: 'Angekommen', started: 'In Durchführung', in_progress: 'In Durchführung', gestartet: 'In Durchführung', paused: 'Pausiert', pausiert: 'Pausiert' };
function visitStatus(row: AssistWorkspaceRow): {
    status: AssistWorkspaceVisit['status'];
    statusLabel: string;
} | null {
    const statuses = [row.canonical_status, row.execution_status, row.legacy_status, row.execution_state_status].map(value => String(value ?? '').toLowerCase());
    if (row.planning_status === 'draft' || row.planning_status === 'cancelled' || row.actual_end_at || row.finished_at || row.service_ended_at
        || statuses.some(status => excludedStatuses.has(status)))
        return null;
    for (const status of statuses)
        if (activeStatuses[status])
            return { status: 'active', statusLabel: activeStatuses[status] };
    if (row.actual_start_at || row.service_started_at)
        return { status: 'active', statusLabel: 'In Durchführung' };
    if (statuses.includes('confirmed') || statuses.includes('bestaetigt') || row.planning_status === 'confirmed')
        return { status: 'confirmed', statusLabel: 'Bestätigt' };
    if (['scheduled', 'at_risk'].includes(String(row.planning_status)) || statuses.includes('planned') || statuses.includes('geplant'))
        return { status: 'planned', statusLabel: row.planning_status === 'at_risk' ? 'Planung prüfen' : 'Geplant' };
    throw new Error('Ein Einsatz hat einen unbekannten Planungsstatus.');
}
function recurrenceObject(value: unknown): AssistWorkspaceRow { return value && typeof value === 'object' && !Array.isArray(value) ? value as AssistWorkspaceRow : {}; }
function recurrenceDates(row: AssistWorkspaceRow, coverage: AssistWorkspaceCoverage): string[] {
    const rule = recurrenceObject(row.recurrence_json);
    const pattern = String(rule.pattern ?? 'none');
    if (pattern === 'none')
        return [];
    if (!['daily', 'weekly', 'biweekly', 'monthly'].includes(pattern))
        throw new Error('Eine Serienregel wird nicht erkannt.');
    const anchor = String(rule.anchorDate ?? row.assignment_date);
    if (!validAssistDate(anchor))
        throw new Error('Eine Serie hat kein gültiges Anfangsdatum.');
    const until = rule.endDate == null ? coverage.toDate : String(rule.endDate);
    if (!validAssistDate(until))
        throw new Error('Eine Serie hat kein gültiges Enddatum.');
    const end = until < coverage.toDate ? until : coverage.toDate;
    const max = rule.occurrenceCount == null ? Infinity : Number(rule.occurrenceCount);
    if (!(max > 0) || (max !== Infinity && !Number.isInteger(max)))
        throw new Error('Die Terminanzahl einer Serie ist ungültig.');
    const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${anchor}T12:00:00Z`)) / 86400000);
    if (days > 36600)
        throw new Error('Eine sehr alte Serie muss vor der Anzeige geprüft werden.');
    const weekdays: Record<string, number> = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
    const start = new Date(`${anchor}T12:00:00Z`);
    const chosen = Array.isArray(rule.weekdays) && rule.weekdays.length ? rule.weekdays.map(day => weekdays[String(day)]) : [start.getUTCDay()];
    if (chosen.some(day => day == null))
        throw new Error('Eine Serie enthält einen ungültigen Wochentag.');
    const dates: string[] = [];
    let count = 0;
    for (let dayOffset = 0; dayOffset <= days && count < max; dayOffset++) {
        const date = new Date(start.getTime() + dayOffset * 86400000);
        const lastMonthDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        const matches = pattern === 'daily' || (pattern === 'monthly' ? date.getUTCDate() === Math.min(start.getUTCDate(), lastMonthDay) : chosen.includes(date.getUTCDay()) && (pattern === 'weekly' || Math.floor(dayOffset / 7) % 2 === 0));
        if (!matches)
            continue;
        count++;
        const key = date.toISOString().slice(0, 10);
        // Include yesterday for an overnight occurrence that is still running today.
        if (key >= addAssistDays(coverage.fromDate, -1))
            dates.push(key);
    }
    return dates;
}
/** Physical occurrence rows win, including cancellations and moved appointments. No legacy mirror is added. */
export function buildAssistWorkspaceVisits(source: Pick<AssistWorkspaceSource, 'tenantId' | 'now' | 'visits' | 'legacyAssignments' | 'executionStates' | 'employees'>): AssistWorkspaceVisit[] {
    const coverage = assistWorkspaceCoverage(source.now), end = Date.parse(assistBerlinTimestamp(addAssistDays(coverage.toDate, 1)));
    const unique = new Map<string, AssistWorkspaceRow>();
    const closed = (row: AssistWorkspaceRow) => Boolean(row.actual_end_at || row.finished_at || row.planning_status === 'cancelled' || excludedStatuses.has(String(row.canonical_status)) || excludedStatuses.has(String(row.execution_status)));
    for (const row of scopedRows(source.visits, source.tenantId)) {
        const recurrence = recurrenceObject(row.recurrence_json);
        const key = recurrence.parentSeriesId && validAssistDate(recurrence.sourceOccurrenceDate) ? `${recurrence.parentSeriesId}::${recurrence.sourceOccurrenceDate}` : String(row.id);
        const previous = unique.get(key);
        if (!previous || (closed(row) && !closed(previous)) || (closed(row) === closed(previous) && String(row.updated_at ?? '') > String(previous.updated_at ?? '')))
            unique.set(key, row);
    }
    const rows = [...unique.values()];
    const rowsById = new Map(rows.map(row => [String(row.id), row]));
    const legacy = new Map(scopedRows(source.legacyAssignments ?? [], source.tenantId).map(row => [String(row.id), row]));
    const execution = new Map(scopedRows(source.executionStates ?? [], source.tenantId).map(row => [String(row.visit_id), row]));
    const employees = new Map(scopedRows(source.employees, source.tenantId).map(row => [String(row.id), row]));
    const physicalDates = new Set(rows.flatMap(row => {
        const recurrence = recurrenceObject(row.recurrence_json);
        return recurrence.parentSeriesId && validAssistDate(recurrence.sourceOccurrenceDate) ? [`${recurrence.parentSeriesId}::${recurrence.sourceOccurrenceDate}`] : [];
    }));
    const result = new Map<string, AssistWorkspaceVisit>();
    const add = (row: AssistWorkspaceRow, virtual = false) => {
        const recurrence = recurrenceObject(row.recurrence_json);
        const parent = recurrence.parentSeriesId ? rowsById.get(String(recurrence.parentSeriesId)) : undefined;
        const sharedParentMirror = Boolean(parent && row.legacy_assignment_id && row.legacy_assignment_id === parent.legacy_assignment_id);
        const previous = !virtual && !sharedParentMirror ? legacy.get(String(row.legacy_assignment_id)) : undefined;
        const state = !virtual ? execution.get(String(row.id)) ?? (!sharedParentMirror ? execution.get(String(row.legacy_assignment_id)) : undefined) : undefined;
        let lifecycle: AssistWorkspaceRow = { ...row, legacy_status: previous?.status, actual_end_at: row.actual_end_at ?? previous?.actual_end_at,
            finished_at: row.finished_at ?? previous?.finished_at, actual_start_at: row.actual_start_at ?? previous?.actual_start_at,
            execution_state_status: state?.assignment_status, service_ended_at: state?.service_ended_at, service_started_at: state?.service_started_at };
        const concreteSeries = Boolean((recurrence.pattern && recurrence.pattern !== 'none') || (recurrence.parentSeriesId && recurrence.sourceOccurrenceDate));
        const lifecycleStatuses = [row.canonical_status, row.execution_status, previous?.status, state?.assignment_status].map(value => String(value ?? ''));
        const cancelled = row.planning_status === 'cancelled' || lifecycleStatuses.some(value => ['cancelled', 'canceled', 'storniert', 'no_show', 'nicht_erschienen'].includes(value));
        const ownEvidence = Boolean(lifecycle.actual_start_at || lifecycle.actual_end_at || lifecycle.finished_at || lifecycle.service_started_at || lifecycle.service_ended_at
            || row.on_the_way_at || row.arrived_at || state?.travel_started_at || state?.travel_ended_at || state?.documentation_complete || state?.signature_complete
            || ['complete', 'review'].includes(String(row.documentation_status)) || ['signed', 'verified'].includes(String(row.proof_status)));
        // Match the existing occurrence contract: copied execution status alone is not proof that this occurrence ran.
        if (!virtual && concreteSeries && !cancelled && !ownEvidence && row.planning_status !== 'draft'
            && lifecycleStatuses.some(value => excludedStatuses.has(value) || Boolean(activeStatuses[value]))) {
            lifecycle = { ...lifecycle, canonical_status: 'confirmed', execution_status: 'pending', legacy_status: null, execution_state_status: null, planning_status: 'confirmed' };
        }
        const status = visitStatus(lifecycle);
        if (!status)
            return;
        const start = Date.parse(String(row.planned_start_at)), stop = Date.parse(String(row.planned_end_at));
        if (!Number.isFinite(start) || !Number.isFinite(stop) || stop <= start)
            throw new Error('Ein Einsatz hat keine gültigen Anfangs- und Endzeiten.');
        if ((stop <= source.now.getTime() && status.status !== 'active') || start >= end)
            return;
        const employeeId = assistText(row.employee_id), employee = employeeId ? employees.get(employeeId) : undefined;
        const id = String(row.id);
        result.set(id, { id, clientId: String(row.client_id), title: assistText(row.title) ?? assistText(row.service_name) ?? 'Einsatz', serviceName: assistText(row.service_name),
            scheduledStart: new Date(start).toISOString(), scheduledEnd: new Date(stop).toISOString(), durationMinutes: Math.round((stop - start) / 60000),
            employeeId, employeeName: employee ? personName(employee) : null, ...status });
    };
    for (const row of rows) {
        add(row);
        const rule = recurrenceObject(row.recurrence_json);
        if (!rule.pattern || rule.pattern === 'none' || rule.parentSeriesId || row.planning_status === 'cancelled' || row.planning_status === 'draft')
            continue;
        const masterDate = String(rule.masterOccurrenceDate ?? row.assignment_date);
        const detached = new Set(Array.isArray(rule.detachedOccurrenceDates) ? rule.detachedOccurrenceDates.map(String) : []);
        const materialized = recurrenceObject(rule.materializedOccurrences);
        const startParts = berlinParts(String(row.planned_start_at)), endParts = berlinParts(String(row.planned_end_at));
        const dayDelta = Math.round((Date.parse(`${endParts.date}T12:00:00Z`) - Date.parse(`${startParts.date}T12:00:00Z`)) / 86400000);
        for (const date of recurrenceDates(row, coverage)) {
            const id = `${row.id}::${date}`;
            if (date === masterDate || detached.has(date) || physicalDates.has(id))
                continue;
            if (materialized[date]) {
                // A missing physical child may have moved outside the horizon or been removed; never resurrect it.
                continue;
            }
            add({ ...row, id, planned_start_at: assistBerlinTimestamp(date, startParts.time), planned_end_at: assistBerlinTimestamp(addAssistDays(date, dayDelta), endParts.time),
                canonical_status: 'confirmed', planning_status: 'confirmed', execution_status: 'pending', actual_start_at: null, actual_end_at: null, finished_at: null }, true);
        }
    }
    return [...result.values()].sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart) || a.id.localeCompare(b.id));
}
export function buildAssistClientsWorkspace(source: AssistWorkspaceSource): AssistClientsWorkspaceSnapshot {
    const coverage = assistWorkspaceCoverage(source.now), assignments = activeAssistAssignments(source.assignments, source.tenantId, source.now);
    const people = new Map(scopedRows(source.people, source.tenantId).map(row => [String(row.id), row]));
    const employeeRows = new Map(scopedRows(source.employees, source.tenantId).map(row => [String(row.id), row]));
    let visitsAvailable = source.visitsAvailable, visitsError = source.visitsError ?? null;
    let visits: AssistWorkspaceVisit[] = [];
    if (visitsAvailable) {
        try {
            visits = buildAssistWorkspaceVisits(source);
        }
        catch (error) {
            visitsAvailable = false;
            visitsError = error instanceof Error ? error.message : 'Die Einsatzplanung konnte nicht ausgewertet werden.';
        }
    }
    const related = (rows: AssistWorkspaceRow[], id: string) => scopedRows(rows, source.tenantId).filter(row => row.client_id === id);
    const warnings: string[] = [];
    const clients: AssistWorkspaceClient[] = [];
    for (const assignment of assignments) {
        const id = String(assignment.client_id), row = people.get(id);
        if (!row) {
            warnings.push('Eine Assist-Zuordnung verweist auf eine nicht verfügbare Klientenakte. Bitte die Zuordnungen prüfen.');
            continue;
        }
        if (row.deleted_at || ['deleted', 'archived', 'archiviert'].includes(String(row.status)))
            continue;
        const entitlementRows = related(source.entitlements, id), legacyCareRows = related(source.careLevels, id);
        const entitlement = currentRow(entitlementRows, coverage.fromDate);
        const oldCare = currentRow(legacyCareRows, coverage.fromDate);
        const insurance = related(source.insurance, id).filter(item => item.is_primary === true).sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))[0];
        const currentInsuranceGrade = !insurance?.care_level_valid_from || (validAssistDate(insurance.care_level_valid_from) && insurance.care_level_valid_from <= coverage.fromDate) ? careGrade(insurance?.care_level) : null;
        // Once dated care records exist, a mirrored base field cannot override their validity window.
        const undatedGrade = entitlementRows.length || legacyCareRows.length ? null : careGrade(row.care_level);
        const level = careGrade(entitlement?.care_grade) ?? careGrade(oldCare?.grade) ?? undatedGrade ?? currentInsuranceGrade;
        const selfPay = insurance?.self_pay === true || ['self_pay', 'private', 'selbstzahler'].includes(String(row.billing_party));
        // Carrier and member number are an inseparable pair, including all legacy fallback paths.
        const carrier = [
            [assistText(entitlement?.care_fund_name), assistText(entitlement?.care_fund_member_id)],
            [assistText(oldCare?.care_fund_name), assistText(oldCare?.care_fund_member_id)],
            [assistText(insurance?.care_fund_name), assistText(insurance?.insurance_number)],
            [assistText(row.cost_bearer), assistText(row.insurance_number)],
            [assistText(insurance?.health_insurance), assistText(insurance?.insurance_number)],
            [assistText(row.insurance_name), assistText(row.insurance_number)],
        ].find(pair => pair[0]);
        const costCarrier = carrier?.[0] ?? null, insuranceNumber = carrier?.[1] ?? null;
        const firstName = assistText(row.first_name) ?? '', lastName = assistText(row.last_name) ?? '', name = personName(row) ?? 'Name fehlt';
        const rawStreet = assistText(row.street), houseNumber = assistText(row.house_number);
        const street = rawStreet ? (houseNumber && !rawStreet.endsWith(houseNumber) ? `${rawStreet} ${houseNumber}` : rawStreet) : null;
        const postalCode = assistText(row.postal_code), city = assistText(row.city), phone = assistText(row.phone), mobile = assistText(row.mobile), email = assistText(row.email);
        const dateOfBirth = validAssistDate(row.date_of_birth) && row.date_of_birth <= coverage.fromDate ? row.date_of_birth : null;
        const primaryEmployeeId = assistText(assignment.primary_employee_id), employee = primaryEmployeeId ? employeeRows.get(primaryEmployeeId) : undefined;
        const primaryEmployeeAvailable = source.employeesAvailable && employeeIsCurrent(employee, coverage.fromDate);
        const primaryEmployeeName = employee ? personName(employee) : null;
        const missingFields: string[] = [];
        if (!firstName || !lastName)
            missingFields.push('Vollständiger Name');
        if (!dateOfBirth)
            missingFields.push('Geburtsdatum');
        if (!level && !selfPay)
            missingFields.push('Pflegegrad');
        if (!costCarrier && !selfPay)
            missingFields.push('Kostenträger');
        if (!insuranceNumber && !selfPay)
            missingFields.push('Versichertennummer');
        if (!street || !postalCode || !city)
            missingFields.push('Vollständige Einsatzadresse');
        if (!phone && !mobile)
            missingFields.push('Telefonnummer');
        const clientWarnings: string[] = [];
        if (!primaryEmployeeId)
            clientWarnings.push('Keine feste Zuständigkeit hinterlegt.');
        else if (source.employeesAvailable && !primaryEmployeeAvailable)
            clientWarnings.push('Die feste Zuständigkeit ist nicht mehr verfügbar. Bitte neu zuordnen.');
        const upcomingVisits = visits.filter(visit => visit.clientId === id);
        const sevenDayVisitCount = visitsAvailable ? upcomingVisits.filter(visit => assistBerlinDate(new Date(visit.scheduledStart)) <= coverage.sevenDayToDate).length : null;
        const statusLabels: Record<string, string> = { active: 'Aktiv', aktiv: 'Aktiv', inactive: 'Inaktiv', inaktiv: 'Inaktiv', interested: 'Interessent:in', prospect: 'Interessent:in', paused: 'Pausiert', discharged: 'Beendet', deceased: 'Verstorben' };
        clients.push({ id, name, firstName, lastName, clientNumber: assistText(row.client_number), dateOfBirth, careLevel: level, careLevelLabel: gradeLabel(level), costCarrier, insuranceNumber, selfPay,
            phone, mobile, email, street, postalCode, city, address: [street, [postalCode, city].filter(Boolean).join(' ')].filter(Boolean).join(', ') || null,
            assignmentId: String(assignment.id), assignedAt: assistText(assignment.assigned_at), primaryEmployeeId, primaryEmployeeName, primaryEmployeeAvailable,
            missingFields, warnings: clientWarnings, upcomingVisits, nextVisit: upcomingVisits[0] ?? null, sevenDayVisitCount,
            planningStatus: !visitsAvailable ? 'unknown' : upcomingVisits.length ? 'planned' : 'unplanned', needsAttention: missingFields.length > 0 || clientWarnings.length > 0,
            statusLabel: statusLabels[String(row.status)] ?? 'Status prüfen' });
    }
    return { clients: clients.sort((a, b) => a.lastName.localeCompare(b.lastName, 'de') || a.firstName.localeCompare(b.firstName, 'de') || a.id.localeCompare(b.id)),
        loadedAt: source.now.toISOString(), coverage, visitsAvailable, visitsError, warnings: [...new Set(warnings)] };
}
function searchText(value: string): string { return value.toLocaleLowerCase('de-DE').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss'); }
export function filterAssistWorkspaceClients(clients: AssistWorkspaceClient[], query = '', filter: AssistWorkspaceFilter = 'all'): AssistWorkspaceClient[] {
    const terms = searchText(query.trim()).split(/\s+/).filter(Boolean);
    return clients.filter(client => {
        if (filter === 'attention' && !client.needsAttention)
            return false;
        if (filter === 'planned' && client.planningStatus !== 'planned')
            return false;
        if (filter === 'unplanned' && client.planningStatus !== 'unplanned')
            return false;
        const text = searchText([client.name, client.clientNumber, client.address, client.phone, client.mobile, client.email, client.costCarrier, client.insuranceNumber, client.careLevel, client.careLevelLabel, client.primaryEmployeeName,
            ...client.upcomingVisits.flatMap(visit => [visit.employeeName, visit.serviceName, visit.title])].filter(Boolean).join(' '));
        return terms.every(term => text.includes(term));
    });
}
export function summarizeAssistWorkspaceClients(clients: AssistWorkspaceClient[], visitsAvailable = true) {
    return { total: clients.length, attention: clients.filter(client => client.needsAttention).length,
        planned: visitsAvailable ? clients.filter(client => client.planningStatus === 'planned').length : null,
        unplanned: visitsAvailable ? clients.filter(client => client.planningStatus === 'unplanned').length : null,
        sevenDayVisits: visitsAvailable ? clients.reduce((sum, client) => sum + (client.sevenDayVisitCount ?? 0), 0) : null };
}
