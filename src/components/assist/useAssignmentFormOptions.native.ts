// Generated native presentation from src/components/assist/useAssignmentFormOptions.web.ts. Update through scripts/port-native-workspaces.mjs.
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { loadAssistAssignmentOptions } from '@/lib/assistCatalog';
import type { AssistAssignmentOptions } from '@/types/assistCatalog';
/** Form-local options never cross company, user, or retry boundaries. */
export function useAssignmentFormOptions(enabled = true) {
    const tenantId = useServiceTenantId();
    const { profile } = useAuth();
    const scope = JSON.stringify([tenantId, profile?.id, profile?.roleKey, enabled]);
    const [state, setState] = useState<{
        scope: string;
        options: AssistAssignmentOptions | null;
        loading: boolean;
        error: string | null;
    }>({ scope, options: null, loading: true, error: null });
    const [retry, setRetry] = useState(0);
    useEffect(() => { let cancelled = false; setState({ scope, options: null, loading: !!tenantId && enabled, error: !tenantId ? 'Kein Unternehmen ausgewählt.' : null }); if (!tenantId || !enabled)
        return; void loadAssistAssignmentOptions(tenantId, profile?.roleKey).then(result => { if (!cancelled)
        setState({ scope, options: result.ok ? result.data : null, loading: false, error: result.ok ? null : result.error }); }).catch(cause => { if (!cancelled)
        setState({ scope, options: null, loading: false, error: cause instanceof Error ? cause.message : 'Auswahl konnte nicht geladen werden.' }); }); return () => { cancelled = true; }; }, [tenantId, profile?.id, profile?.roleKey, enabled, scope, retry]);
    return { ...(state.scope === scope ? state : { options: null, loading: true, error: null }), reload: () => setRetry(value => value + 1) };
}
