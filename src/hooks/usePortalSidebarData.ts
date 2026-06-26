import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { usePortalAssistRealtime } from '@/hooks/usePortalAssistRealtime';
import { usePortalContext } from '@/hooks/usePortalContext';
import { fetchAssistDashboardData } from '@/lib/portal/assist/portalAssistDashboardService';
import {
  canAccessPortalFeature,
  resolveCombinedModuleLabel,
  resolvePortalTerminology,
} from '@/lib/portal/engine';
import { getSupabaseClient } from '@/lib/supabase/client';
import { isMissingTableError } from '@/lib/supabase/missingtablefallback';
import type { AssistDashboardData } from '@/types/portal/assist';

export type PortalSidebarQuickAction = {
  key: string;
  label: string;
  icon: string;
  href: string;
};

export type PortalSidebarKpi = {
  label: string;
  value: number | null | undefined;
};

function formatLoginTime(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

async function fetchClientLastLogin(tenantId: string, clientId: string): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('client_portal_access')
    .select('last_login_at')
    .eq('tenant_id', tenantId)
    .eq('client_id', clientId)
    .maybeSingle();

  if (error) {
    if (!isMissingTableError(error)) {
      console.warn('[usePortalSidebarData] last login:', error.message);
    }
    return null;
  }

  return data?.last_login_at ? String(data.last_login_at) : null;
}

/** Shared mandant/status/KPI/quick-action data for portal right sidebar and mobile cards. */
export function usePortalSidebarData() {
  const router = useRouter();
  const { context } = usePortalContext();
  const [dashboard, setDashboard] = useState<AssistDashboardData | null>(null);
  const [lastLogin, setLastLogin] = useState<string | null>(null);

  const loadSidebarData = useCallback(async () => {
    if (!context) return;

    const loginPromise = fetchClientLastLogin(context.tenantId, context.clientId);
    if (context.primaryModule === 'assist') {
      const result = await fetchAssistDashboardData(context);
      if (result.ok) setDashboard(result.data);
    }
    setLastLogin(await loginPromise);
  }, [context]);

  useEffect(() => {
    void loadSidebarData();
  }, [loadSidebarData]);

  const { isConnected: isLiveConnected } = usePortalAssistRealtime(
    context?.tenantId,
    context?.primaryModule === 'assist' ? context.clientId : null,
    () => {
      void loadSidebarData();
    },
  );

  const kpis = useMemo((): PortalSidebarKpi[] => {
    if (dashboard) {
      return [
        { label: 'Einsätze', value: dashboard.kpis.appointments },
        { label: 'Nachrichten', value: dashboard.kpis.messages },
        { label: 'Dokumente', value: dashboard.kpis.documents },
        { label: 'Anfragen offen', value: dashboard.kpis.openRequests },
      ];
    }
    if (!context) return [];
    return [
      { label: 'Einsätze', value: context.metrics.upcomingAppointments },
      { label: 'Nachrichten', value: context.metrics.openMessages },
      { label: 'Dokumente', value: context.metrics.documents },
    ];
  }, [context, dashboard]);

  const quickActions = useMemo((): PortalSidebarQuickAction[] => {
    const actions: PortalSidebarQuickAction[] = [
      { key: 'message', label: 'Nachricht', icon: '💬', href: '/portal/client/messages?compose=1' },
      { key: 'termin', label: 'Einsatzänderung', icon: '📅', href: '/portal/client?action=termin_aendern' },
      { key: 'zusatztermin', label: 'Zusatzeinsatz', icon: '➕', href: '/portal/client?action=zusatztermin' },
      { key: 'upload', label: 'Upload', icon: '📎', href: '/portal/client?action=upload' },
      { key: 'rueckruf', label: 'Rückruf', icon: '📞', href: '/portal/client?action=rueckruf' },
    ];
    if (context && canAccessPortalFeature(context, 'assist', 'nachweise')) {
      actions.push({
        key: 'nachweise',
        label: 'Nachweise',
        icon: '📋',
        href: '/portal/client?action=nachweise',
      });
    }
    return actions;
  }, [context]);

  const terminology = context ? resolvePortalTerminology(context.primaryModule) : null;
  const moduleLabel = context ? resolveCombinedModuleLabel(context.activeModuleKeys) : '';
  const releaseLabel =
    context && context.visibleFeatures.length > 0 ? 'Freigabe aktiv' : 'Freigabe ausstehend';

  const navigateQuickAction = useCallback(
    (href: string) => {
      router.push(href as never);
    },
    [router],
  );

  return {
    context,
    dashboard,
    kpis,
    quickActions,
    lastLogin,
    lastLoginFormatted: formatLoginTime(lastLogin),
    terminology,
    moduleLabel,
    releaseLabel,
    refresh: loadSidebarData,
    navigateQuickAction,
    isLiveConnected,
  };
}
