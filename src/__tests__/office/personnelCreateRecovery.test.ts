import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPersonnelProfile } from '@/lib/office/createPersonnelProfile.web';
import { EMPTY_EMPLOYEE_FORM } from '@/types/forms/employeeForm';
const h = vi.hoisted(() => ({ create: vi.fn(), upload: vi.fn(), persist: vi.fn() }));
vi.mock('@/lib/office/employeeCreateService', () => ({ createEmployee: h.create }));
vi.mock('@/lib/office/employeeAvatarService', () => ({ uploadEmployeeAvatar: h.upload, persistEmployeeAvatarUrl: h.persist }));
vi.mock('@/lib/services/mode', () => ({ getServiceMode: () => 'supabase' }));
const form = { ...EMPTY_EMPLOYEE_FORM, firstName: 'Mara', lastName: 'Sommer', email: 'mara@example.invalid', jobTitle: 'pflegefachkraft', profilePhoto: { displayUri: 'blob:test', pending: { uri: 'blob:test' } as never, removed: false } };
beforeEach(() => { vi.clearAllMocks(); h.create.mockResolvedValue({ ok: true, data: { id: 'saved-person' } }); h.upload.mockResolvedValue({ ok: true, data: { avatarUrl: 'tenant/avatar' } }); h.persist.mockResolvedValue({ ok: true, data: undefined }); });
describe('personnel create/photo recovery', () => {
  it.each(['error', 'throw'] as const)('preserves the saved ID when the photo upload returns %s', async mode => {
    if (mode === 'error') h.upload.mockResolvedValue({ ok: false, error: 'offline' }); else h.upload.mockRejectedValue(new Error('offline'));
    const result = await createPersonnelProfile('tenant', form, 'business_admin');
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.data.id).toBe('saved-person'); expect(result.data.warning).toContain('Personalakte wurde angelegt'); }
    expect(h.create).toHaveBeenCalledOnce(); expect(h.create.mock.calls[0][1].profilePhoto).toBeNull(); expect(h.persist).not.toHaveBeenCalled();
  });
  it('does not upload a photo when core creation is denied', async () => {
    h.create.mockResolvedValue({ ok: false, error: 'Keine Berechtigung.' });
    expect(await createPersonnelProfile('tenant', form, 'business_admin')).toEqual({ ok: false, error: 'Keine Berechtigung.' });
    expect(h.upload).not.toHaveBeenCalled();
  });
  it('reports a failed photo association without creating another record', async () => {
    h.persist.mockResolvedValue({ ok: false, error: 'permission' });
    const result = await createPersonnelProfile('tenant', form, 'business_admin');
    expect(result.ok && result.data.warning).toContain('noch nicht zugeordnet');
    expect(h.create).toHaveBeenCalledOnce();
  });
});
