// Generated native presentation from src/lib/qm/qmRegisterDomain.web.ts. Update through scripts/port-native-workspaces.mjs.
export type QmRegisterKind = 'audits' | 'measures' | 'compliance' | 'changes' | 'legal' | 'md';
export type QmRegisterEntry = {
    id: string;
    title: string;
    status: string;
    category: string;
    date: string | null;
    owner: string;
    summary: string;
    details: {
        label: string;
        value: string;
    }[];
    documentIds: string[];
};
export const QM_REGISTER_LABELS: Record<string, string> = {
    planned: 'Geplant', in_progress: 'In Bearbeitung', completed: 'Abgeschlossen', follow_up: 'Nacharbeit',
    open: 'Offen', overdue: 'Überfällig', fulfilled: 'Erfüllt', waived: 'Ausgenommen', cancelled: 'Abgebrochen',
    draft: 'Entwurf', in_preparation: 'In Vorbereitung', pending_approval: 'Freigabe ausstehend',
    approved: 'Freigegeben', exported: 'Exportiert', shared: 'Geteilt', revoked: 'Widerrufen',
    internal: 'Intern', external: 'Extern', md_inspection: 'MD-Prüfung', correction: 'Korrektur',
    improvement: 'Verbesserung', legal_update: 'Rechtsänderung', audit_finding: 'Auditfeststellung',
};
const text = (row: Record<string, unknown>, key: string): string => typeof row[key] === 'string' ? row[key] as string : '';
const optional = (row: Record<string, unknown>, key: string): string => text(row, key).trim() || 'Nicht hinterlegt';
const date = (row: Record<string, unknown>, key: string): string | null => text(row, key) || null;
const ids = (row: Record<string, unknown>, key: string): string[] => Array.isArray(row[key])
    ? (row[key] as unknown[]).filter((value): value is string => typeof value === 'string' && value.length > 0) : [];
/** A foreign/malformed row fails the entire result; it never becomes a plausible empty register. */
export function mapQmRegisterRows(kind: QmRegisterKind, rows: unknown[], tenantId: string): {
    ok: true;
    data: QmRegisterEntry[];
} | {
    ok: false;
    error: string;
} {
    const mapped: QmRegisterEntry[] = [];
    for (const value of rows) {
        if (!value || typeof value !== 'object' || Array.isArray(value))
            return { ok: false, error: 'Die QM-Daten konnten nicht vollständig zugeordnet werden.' };
        const row = value as Record<string, unknown>;
        if (!text(row, 'id') || row.tenant_id !== tenantId || !text(row, 'title').trim()) {
            return { ok: false, error: 'Die QM-Daten konnten diesem Mandanten nicht vollständig zugeordnet werden.' };
        }
        const entry: QmRegisterEntry = {
            id: text(row, 'id'), title: text(row, 'title'), status: text(row, 'status'), category: '',
            date: null, owner: '', summary: '', details: [], documentIds: [],
        };
        switch (kind) {
            case 'audits':
                entry.category = text(row, 'audit_type');
                entry.date = date(row, 'scheduled_at');
                entry.owner = optional(row, 'auditor_name');
                entry.summary = text(row, 'summary');
                entry.details = [{ label: 'Feststellungen', value: typeof row.findings_count === 'number' && Number.isInteger(row.findings_count) && row.findings_count >= 0 ? String(row.findings_count) : 'Nicht bestätigt' },
                    { label: 'Abgeschlossen am', value: optional(row, 'completed_at') }];
                break;
            case 'measures':
                entry.date = date(row, 'due_at');
                entry.owner = optional(row, 'assigned_to');
                entry.summary = text(row, 'description');
                entry.details = [{ label: 'Audit-Bezug', value: optional(row, 'audit_id') }, { label: 'Abgeschlossen am', value: optional(row, 'completed_at') }];
                break;
            case 'compliance':
                entry.date = date(row, 'due_at');
                entry.owner = optional(row, 'responsible_role');
                entry.summary = text(row, 'notes');
                entry.documentIds = ids(row, 'evidence_document_ids');
                entry.details = [{ label: 'Rechtsgrundlage', value: optional(row, 'legal_reference_id') }];
                break;
            case 'changes':
                entry.category = text(row, 'change_type');
                entry.date = date(row, 'created_at');
                entry.owner = optional(row, 'requested_by');
                entry.summary = text(row, 'description');
                entry.documentIds = text(row, 'document_id') ? [text(row, 'document_id')] : [];
                entry.details = [{ label: 'Abgeschlossen am', value: optional(row, 'completed_at') }];
                break;
            case 'legal':
                entry.category = text(row, 'reference_code');
                entry.date = date(row, 'effective_from');
                entry.owner = optional(row, 'source');
                entry.summary = text(row, 'summary');
                entry.documentIds = ids(row, 'document_ids');
                break;
            case 'md':
                entry.category = typeof row.inspection_year === 'number' && Number.isInteger(row.inspection_year) ? `Prüfjahr ${row.inspection_year}` : 'Prüfjahr nicht bestätigt';
                entry.date = date(row, 'created_at');
                entry.owner = optional(row, 'approved_by');
                entry.summary = text(row, 'notes');
                entry.details = [{ label: 'Datenschutzbestätigung gespeichert', value: row.datenschutz_confirmed === true ? 'Ja' : row.datenschutz_confirmed === false ? 'Nein' : 'Nicht bestätigt' },
                    { label: 'Freigabezeitpunkt', value: optional(row, 'approved_at') }];
                break;
        }
        mapped.push(entry);
    }
    return { ok: true, data: mapped };
}
export function filterQmRegister(entries: readonly QmRegisterEntry[], search: string, status: string): QmRegisterEntry[] {
    const terms = search.toLocaleLowerCase('de-DE').trim().split(/\s+/u).filter(Boolean);
    return entries.filter(entry => (status === 'all' || entry.status === status) && terms.every(term => [entry.title, entry.owner, entry.summary, entry.category, QM_REGISTER_LABELS[entry.category], entry.status, QM_REGISTER_LABELS[entry.status]]
        .filter(Boolean).join(' ').toLocaleLowerCase('de-DE').includes(term)));
}
export function qmRegisterDate(value: string | null): string {
    if (!value)
        return 'Nicht hinterlegt';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Datum nicht bestätigt' : parsed.toLocaleDateString('de-DE');
}
