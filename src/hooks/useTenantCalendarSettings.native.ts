// Generated native presentation from src/hooks/useTenantCalendarSettings.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CalendarModuleScope, TenantCalendarSettings, TenantCalendarSettingsForm } from '@/types/modules/calendarEvent';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchTenantCalendarSettings, saveTenantCalendarSettings, subscribeTenantCalendarSettings, toTenantCalendarSettingsForm } from "../lib/office/tenantCalendarSettingsService.native.ts";
type State = {
    key: string;
    settings: TenantCalendarSettings | null;
    loading: boolean;
    saving: boolean;
    error: string | null;
};
export function useTenantCalendarSettings(scope: CalendarModuleScope = 'office') {
    const { profile } = useAuth();
    const tenantId = useServiceTenantId();
    const settingsScope = scope === 'assist' ? 'assist' : 'office';
    const key = JSON.stringify([tenantId, profile?.id, profile?.roleKey, settingsScope]);
    const identity = useRef(key);
    identity.current = key;
    const request = useRef(0), mounted = useRef(true), saveFlight = useRef<string | null>(null);
    const empty: State = { key, settings: null, loading: !!tenantId, saving: false, error: null };
    const [state, setState] = useState<State>(empty);
    const current = state.key === key ? state : empty;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; request.current++; }; }, []);
    const refresh = useCallback(async () => {
        const id = ++request.current;
        if (!tenantId) {
            setState({ key, settings: null, loading: false, saving: false, error: null });
            return;
        }
        setState((prev) => ({ key, settings: prev.key === key ? prev.settings : null, loading: true, saving: false, error: null }));
        const result = await fetchTenantCalendarSettings(tenantId, profile?.roleKey, { scope: settingsScope });
        if (!mounted.current || identity.current !== key || request.current !== id)
            return;
        setState((prev) => ({ ...prev, key, loading: false, error: result.ok ? null : result.error,
            settings: result.ok ? result.data : prev.key === key ? prev.settings : null }));
    }, [tenantId, profile?.roleKey, settingsScope, key]);
    useEffect(() => { void refresh(); return () => { request.current++; }; }, [refresh]);
    useEffect(() => subscribeTenantCalendarSettings((settings) => {
        if (!mounted.current || identity.current !== key || settings.tenantId !== tenantId)
            return;
        request.current++;
        setState({ key, settings, loading: false, saving: false, error: null });
    }), [key, tenantId]);
    const save = useCallback(async (form: TenantCalendarSettingsForm) => {
        if (!tenantId || identity.current !== key || !mounted.current)
            return { ok: false as const, error: 'Kein Unternehmen ausgewählt.' };
        if (saveFlight.current === key)
            return { ok: false as const, error: 'Die Einstellungen werden bereits gespeichert.' };
        saveFlight.current = key;
        setState((prev) => ({ ...prev, key, saving: true, error: null }));
        try {
            const result = await saveTenantCalendarSettings(tenantId, form, profile?.roleKey, { scope: settingsScope });
            if (mounted.current && identity.current === key)
                setState((prev) => ({ ...prev, saving: false, error: result.ok ? null : result.error, settings: result.ok ? result.data : prev.settings }));
            return result;
        }
        finally {
            if (saveFlight.current === key)
                saveFlight.current = null;
        }
    }, [tenantId, profile?.roleKey, settingsScope, key]);
    const form = useMemo(() => current.settings ? toTenantCalendarSettingsForm(current.settings) : null, [current.settings]);
    return { ...current, form, refresh, save };
}
