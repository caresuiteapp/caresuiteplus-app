// Generated native presentation from src/lib/office/personnelDocumentDownload.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { RoleKey, ServiceResult } from '@/types';
import { fetchEmployeePersonnelFile } from './employeePersonnelFileService';
import { getSupabaseClient } from "../supabase/client.ts";
import { getServiceMode } from '@/lib/services/mode';
import { isTenantStoragePath } from '@/lib/storage/storagePaths';
export async function downloadPersonnelDocument(tenantId: string, employeeId: string, documentId: string, actorRoleKey?: RoleKey | null, actorProfileId?: string | null): Promise<ServiceResult<{
    blob: Blob;
    filename: string;
}>> {
    const permitted = await fetchEmployeePersonnelFile(tenantId, employeeId, actorRoleKey, { userId: actorProfileId });
    if (!permitted.ok)
        return permitted;
    const document = permitted.data.documents.find(item => item.id === documentId && item.tenantId === tenantId && item.employeeId === employeeId);
    if (!document || !isTenantStoragePath(document.storagePath, tenantId))
        return { ok: false, error: 'Das Dokument ist nicht verfügbar oder für Ihre Rolle nicht freigegeben.' };
    if (getServiceMode() !== 'supabase')
        return { ok: false, error: 'Zu diesem Beispieldokument ist keine Datei hinterlegt.' };
    const client = getSupabaseClient();
    if (!client)
        return { ok: false, error: 'Die Verbindung zur Dokumentablage ist nicht verfügbar.' };
    const result = await client.storage.from('office-documents').download(document.storagePath!);
    if (result.error || !result.data)
        return { ok: false, error: 'Die Datei konnte nicht geladen werden. Prüfen Sie Ihre Berechtigung oder versuchen Sie es erneut.' };
    return { ok: true, data: { blob: result.data, filename: document.fileName || 'Personalunterlage' } };
}
