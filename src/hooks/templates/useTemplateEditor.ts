import { useCallback, useState } from 'react';
import type { CreateTemplateInput, UpdateTemplateInput } from '@/types/templates';
import {
  archiveTemplate,
  createTemplate,
  duplicateSystemTemplateForTenant,
  updateTemplate,
} from '@/lib/templates';
import { getServiceMode } from '@/lib/services/mode';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';

export function useTemplateEditor(templateId?: string | null) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const serviceMode = getServiceMode();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = useCallback(
    async (input: CreateTemplateInput) => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      setSaving(true);
      setError(null);
      const result = await createTemplate(tenantId, input, profile?.roleKey, profile?.id);
      setSaving(false);
      if (!result.ok) setError(result.error);
      return result;
    },
    [tenantId, profile?.roleKey, profile?.id],
  );

  const update = useCallback(
    async (patch: UpdateTemplateInput) => {
      if (!tenantId || !templateId) return { ok: false as const, error: 'Kein Mandant oder Vorlage.' };
      setSaving(true);
      setError(null);
      const result = await updateTemplate(tenantId, templateId, patch, profile?.roleKey);
      setSaving(false);
      if (!result.ok) setError(result.error);
      return result;
    },
    [tenantId, templateId, profile?.roleKey],
  );

  const archive = useCallback(async () => {
    if (!tenantId || !templateId) return { ok: false as const, error: 'Kein Mandant oder Vorlage.' };
    setSaving(true);
    setError(null);
    const result = await archiveTemplate(tenantId, templateId, profile?.roleKey);
    setSaving(false);
    if (!result.ok) setError(result.error);
    return result;
  }, [tenantId, templateId, profile?.roleKey]);

  const duplicateFromSystem = useCallback(
    async (systemTemplateId: string) => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      setSaving(true);
      setError(null);
      const result = await duplicateSystemTemplateForTenant(
        tenantId,
        systemTemplateId,
        profile?.roleKey,
        profile?.id,
      );
      setSaving(false);
      if (!result.ok) setError(result.error);
      return result;
    },
    [tenantId, profile?.roleKey, profile?.id],
  );

  return {
    create,
    update,
    archive,
    duplicateFromSystem,
    saving,
    error,
    serviceMode,
    tenantId,
    canEdit: serviceMode === 'demo' || serviceMode === 'supabase',
  };
}
