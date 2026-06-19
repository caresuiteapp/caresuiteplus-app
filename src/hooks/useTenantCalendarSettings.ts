import { useCallback, useEffect, useState } from 'react';
import type { TenantCalendarSettings, TenantCalendarSettingsForm } from '@/types/modules/calendarEvent';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import {
  fetchTenantCalendarSettings,
  saveTenantCalendarSettings,
  toTenantCalendarSettingsForm,
} from '@/lib/office/tenantCalendarSettingsService';

export function useTenantCalendarSettings() {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [settings, setSettings] = useState<TenantCalendarSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!tenantId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await fetchTenantCalendarSettings(tenantId, profile?.roleKey);
    if (result.ok) {
      setSettings(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [tenantId, profile?.roleKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const save = useCallback(
    async (form: TenantCalendarSettingsForm) => {
      if (!tenantId) return { ok: false as const, error: 'Kein Mandant.' };
      setSaving(true);
      setError(null);
      const result = await saveTenantCalendarSettings(tenantId, form, profile?.roleKey);
      if (result.ok) {
        setSettings(result.data);
      } else {
        setError(result.error);
      }
      setSaving(false);
      return result;
    },
    [tenantId, profile?.roleKey],
  );

  return {
    settings,
    form: settings ? toTenantCalendarSettingsForm(settings) : null,
    loading,
    saving,
    error,
    refresh,
    save,
  };
}
