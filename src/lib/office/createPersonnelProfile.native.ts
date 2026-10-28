// Generated native presentation from src/lib/office/createPersonnelProfile.web.ts. Update through scripts/port-native-workspaces.mjs.
import type { EmployeeFormData } from '@/types/forms/employeeForm';
import type { RoleKey, ServiceResult } from '@/types';
import { createEmployee } from './employeeCreateService';
import { uploadEmployeeAvatar, persistEmployeeAvatarUrl } from './employeeAvatarService';
import { getServiceMode } from '@/lib/services/mode';
/** A failed optional photo must never turn an existing profile into a retryable create. */
export async function createPersonnelProfile(tenantId: string, form: EmployeeFormData, roleKey?: RoleKey | null): Promise<ServiceResult<{
    id: string;
    warning?: string;
}>> {
    const created = await createEmployee(tenantId, { ...form, profilePhoto: null }, roleKey);
    if (!created.ok)
        return created;
    const photo = form.profilePhoto;
    if (getServiceMode() !== 'supabase' || !photo?.pending || photo.removed)
        return created;
    try {
        const uploaded = await uploadEmployeeAvatar(tenantId, created.data.id, photo.pending);
        if (!uploaded.ok)
            return { ok: true, data: { ...created.data, warning: 'Die Personalakte wurde angelegt. Das Profilfoto konnte nicht gespeichert werden. Sie können es in den Stammdaten erneut hochladen.' } };
        const saved = await persistEmployeeAvatarUrl(tenantId, created.data.id, uploaded.data.avatarUrl);
        if (!saved.ok)
            return { ok: true, data: { ...created.data, warning: 'Die Personalakte wurde angelegt. Das Profilfoto konnte noch nicht zugeordnet werden. Bitte prüfen Sie das Foto in den Stammdaten.' } };
    }
    catch {
        return { ok: true, data: { ...created.data, warning: 'Die Personalakte wurde angelegt. Der Fotoupload wurde unterbrochen. Bitte laden Sie das Foto in den Stammdaten erneut hoch.' } };
    }
    return created;
}
