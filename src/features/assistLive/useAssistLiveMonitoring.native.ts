// Generated native presentation from src/features/assistLive/useAssistLiveMonitoring.web.ts. Update through scripts/port-native-workspaces.mjs.
import {nativeDocument as document} from '@/lib/platform/nativeWorkflowEnvironment.native';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useVisibilityAwarePolling } from '@/lib/polling/useVisibilityAwarePolling';
import { LIVE_TRACKING_POLL_MS } from '@/hooks/core';
import { useDevicePerformance, livePollIntervalMs } from '@/lib/performance';
import { getServiceMode } from '@/lib/services/mode';
import { getSupabaseClient } from "../../lib/supabase/client.ts";
import { hasPermission, hasPermissionInList } from '@/lib/permissions';
import type { PermissionKey } from '@/types/permissions';
import { getAssistLiveMonitoringWorkspace, buildLiveWorkspaceOverview, liveMonitoringDayKey } from './getAssistLiveMonitoringWorkspace';
export type UseAssistLiveMonitoringOptions = {
    enabled?: boolean;
    effectivePermissions?: readonly PermissionKey[];
    isReadOnly?: boolean;
};
const LIVE_TABLES = ['assist_visits', 'assignments', 'assist_tracking_sessions', 'assist_location_points', 'assist_time_events', 'employee_location_consents', 'assist_visit_execution_state', 'assist_visit_documentation', 'assist_visit_signatures', 'assist_visit_proofs'] as const;
/** Read-only monitor. It never asks the administration device for a GPS permission. */
export function useAssistLiveMonitoring(options?: UseAssistLiveMonitoringOptions) {
    const { profile, user } = useAuth();
    const tenantId = useServiceTenantId();
    const roleKey = profile?.roleKey ?? null;
    const mode = getServiceMode();
    const permissionKey = options?.effectivePermissions ? [...options.effectivePermissions].sort().join('|') : '';
    const enabled = options?.enabled !== false && Boolean(tenantId && profile?.id) && (options?.effectivePermissions ? hasPermissionInList(options.effectivePermissions, 'assist.assignments.view') : hasPermission(roleKey, 'assist.assignments.view'));
    const perf = useDevicePerformance();
    const pollMs = livePollIntervalMs(perf.profile, LIVE_TRACKING_POLL_MS);
    const [now, setNow] = useState(() => Date.now());
    const day = liveMonitoringDayKey(now);
    const queryKey = JSON.stringify([tenantId, profile?.id, user?.id, roleKey, permissionKey, options?.isReadOnly, enabled, mode, day]);
    const query = useAsyncQuery(() => getAssistLiveMonitoringWorkspace(tenantId!, roleKey, undefined, options?.effectivePermissions), [tenantId, profile?.id, user?.id, roleKey, permissionKey, options?.isReadOnly, enabled, mode, day], { enabled, queryKey });
    const refresh = query.refresh;
    useVisibilityAwarePolling({ enabled, intervalMs: 15000, onPoll: () => setNow(Date.now()) });
    useVisibilityAwarePolling({ enabled, intervalMs: pollMs, onPoll: () => { void refresh(); } });
    const instanceId = useId();
    const [connection, setConnection] = useState<{
        key: string;
        connected: boolean;
    } | null>(null);
    useEffect(() => {
        if (!enabled || !tenantId || mode !== 'supabase')
            return;
        const supabase = getSupabaseClient();
        if (!supabase)
            return;
        let disposed = false;
        let pending: ReturnType<typeof setTimeout> | null = null;
        const scheduleRefresh = () => {
            if (disposed || pending || (typeof document !== 'undefined' && document.visibilityState === 'hidden'))
                return;
            // Coalesce bursts of location points and execution writes into one read.
            pending = setTimeout(() => { pending = null; if (!disposed)
                void refresh(); }, 700);
        };
        const channel = supabase.channel(`assist-live-web:${tenantId}:${profile?.id}:${instanceId}`);
        for (const table of LIVE_TABLES)
            channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `tenant_id=eq.${tenantId}` }, scheduleRefresh);
        channel.subscribe((status) => {
            if (disposed)
                return;
            setConnection({ key: queryKey, connected: status === 'SUBSCRIBED' });
            if (status === 'SUBSCRIBED')
                scheduleRefresh();
        });
        return () => {
            disposed = true;
            if (pending)
                clearTimeout(pending);
            void supabase.removeChannel(channel);
        };
    }, [enabled, tenantId, profile?.id, mode, instanceId, queryKey, refresh]);
    const overview = useMemo(() => query.data ? buildLiveWorkspaceOverview(query.data.rows, query.data.generatedAt, Math.max(now, Date.now())) : undefined, [query.data, now]);
    const counters = useMemo(() => overview ? {
        todayCount: overview.todayCount, runningCount: overview.runningCount, activeTrackingCount: overview.activeTrackingCount,
        freshGpsCount: overview.freshGpsCount, consentPendingCount: overview.consentPendingCount, gpsDeniedCount: overview.gpsDeniedCount,
    } : null, [overview]);
    const refreshWithResult = useCallback(() => query.refreshWithResult(), [query.refreshWithResult]);
    return {
        overview, counters, loading: query.loading, error: query.error, refreshError: query.refreshError,
        refreshing: query.refreshing, refresh, refreshWithResult, generatedAt: overview?.generatedAt ?? null,
        isRealtimeConnected: connection?.key === queryKey && connection.connected,
        partialData: overview?.partialData ?? false, warnings: overview?.warnings ?? [],
    };
}
