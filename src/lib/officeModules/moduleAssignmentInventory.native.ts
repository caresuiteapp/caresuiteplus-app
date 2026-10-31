// Generated native presentation from src/lib/officeModules/moduleAssignmentInventory.web.ts. Update through scripts/port-native-workspaces.mjs.
import { mergeClientRecordDocuments } from '@/lib/clients/clientDocumentMerge';
type Row = Record<string, unknown>;
const text = (value: unknown): value is string => typeof value === 'string' && !!value.trim();
const ERROR = 'Die Dokumentenmetadaten konnten nicht vollständig gelesen werden.';
/**
 * Count the same logical documents as the Office archive, without bodies, storage paths or separate person-name records.
 * Input must preserve the archive's PostgreSQL order: updated_at DESC NULLS FIRST, then id DESC.
 * Do not re-sort timestamps in JavaScript: Date loses the microseconds used to resolve legacy intake versions.
 */
export function countModuleAssignmentDocumentInventory(stored: readonly Row[], intake: readonly Row[], tenantId: string): number {
    const storedMetadata: Parameters<typeof mergeClientRecordDocuments>[0] = stored.map(row => {
        if (!text(row.id) || row.tenant_id !== tenantId || !text(row.client_id) || typeof row.title !== 'string' || typeof row.file_name !== 'string'
            || row.intake_document_id != null && !text(row.intake_document_id))
            throw new Error(ERROR);
        // Neutral defaults satisfy the shared display model; only identity fields affect its merged length.
        return { id: row.id, tenantId, clientId: row.client_id, title: row.title, fileName: row.file_name,
            documentSource: row.source === 'intake' ? 'intake' : 'upload', intakeDocumentId: row.intake_document_id == null ? null : String(row.intake_document_id),
            mimeType: '', category: 'sonstige', storagePath: null, status: 'entwurf', sensitivity: 'care', uploadedBy: null, validUntil: null, createdAt: '', updatedAt: '' };
    });
    const intakeMetadata: Parameters<typeof mergeClientRecordDocuments>[1] = intake.map(row => {
        if (!text(row.id) || row.tenant_id !== tenantId || !text(row.client_id) || !text(row.template_key) || !text(row.status) || typeof row.title !== 'string' || typeof row.document_type !== 'string')
            throw new Error(ERROR);
        return { id: row.id, tenant_id: tenantId, client_id: row.client_id, template_key: row.template_key, document_type: row.document_type,
            title: row.title, status: row.status, finalized_html: null, preview_html: null, finalized_at: null, created_at: '', updated_at: '' };
    });
    return mergeClientRecordDocuments(storedMetadata, intakeMetadata).length;
}
