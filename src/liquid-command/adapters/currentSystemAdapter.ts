import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import {
  fetchClientList,
  fetchEmployeeList,
  fetchInvoiceList,
  fetchOfficeDocumentList,
} from '@/lib/office';
import { fetchVisitDispositionList } from '@/lib/assist/visitService';
import type { ClientListItem } from '@/types/modules/office';
import type { EmployeeListItem } from '@/types/modules/employeeList';
import type { InvoiceListItem } from '@/types/modules/billing';
import type { PortalDocumentListItem } from '@/types/portal/documents';
import type { VisitDispositionListItem } from '@/lib/assist/visitTypes';
import { resolveEffectiveRoleKey } from '@/lib/auth/sessionTarget';

export type LiquidCurrentData = {
  clients: ClientListItem[];
  employees: EmployeeListItem[];
  invoices: InvoiceListItem[];
  documents: PortalDocumentListItem[];
  visits: VisitDispositionListItem[];
};

export type LiquidDataSourceKey = keyof LiquidCurrentData;

export type LiquidCurrentDataState = {
  data: LiquidCurrentData;
  loading: boolean;
  initialized: boolean;
  tenantId: string | null;
  roleKey: string | null;
  errors: Partial<Record<LiquidDataSourceKey | 'session', string>>;
  reload: () => Promise<void>;
  lastSynchronizedAt: string | null;
};

const EMPTY_DATA: LiquidCurrentData = {
  clients: [],
  employees: [],
  invoices: [],
  documents: [],
  visits: [],
};

type DatasetResult<K extends LiquidDataSourceKey> = {
  key: K;
  data: LiquidCurrentData[K] | null;
  error: string | null;
};

async function resolveDataset<K extends LiquidDataSourceKey>(
  key: K,
  load: () => Promise<{ ok: true; data: LiquidCurrentData[K] } | { ok: false; error: string }>,
): Promise<DatasetResult<K>> {
  try {
    const result = await load();
    if (!result.ok) return { key, data: null, error: result.error };
    return { key, data: result.data, error: null };
  } catch (cause) {
    return {
      key,
      data: null,
      error: cause instanceof Error ? cause.message : `${key} konnten nicht geladen werden.`,
    };
  }
}

/**
 * Strict migration boundary for Liquid Command.
 *
 * The new UI imports no legacy screen, layout, component, navigation or style.
 * Productive data is requested only through the current service layer and is
 * translated into one stable state contract here.
 */
export function useCurrentSystemAdapter(): LiquidCurrentDataState {
  const { profile, portalSession, user, authReady, isAuthenticated } = useAuth();
  const hasActivePortalSession = Boolean(portalSession?.roleKey);
  const tenantId = hasActivePortalSession
    ? (portalSession?.tenantId ?? profile?.tenantId ?? null)
    : (profile?.tenantId ?? portalSession?.tenantId ?? null);
  const roleKey = resolveEffectiveRoleKey(profile, user, portalSession);
  const [data, setData] = useState<LiquidCurrentData>(EMPTY_DATA);
  const [errors, setErrors] = useState<LiquidCurrentDataState['errors']>({});
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [lastSynchronizedAt, setLastSynchronizedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!authReady) return;
    if (!isAuthenticated || !tenantId) {
      setData(EMPTY_DATA);
      setErrors({
        session: isAuthenticated
          ? 'Der Mandantenkontext ist noch nicht verfügbar. Bitte Profil erneut laden.'
          : 'Für produktive Daten ist eine Anmeldung erforderlich.',
      });
      setInitialized(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrors({});

    const results = await Promise.all([
      resolveDataset('clients', () => fetchClientList(tenantId, roleKey)),
      resolveDataset('employees', () => fetchEmployeeList(tenantId, roleKey, profile)),
      resolveDataset('invoices', () => fetchInvoiceList(tenantId, roleKey)),
      resolveDataset('documents', () => fetchOfficeDocumentList(tenantId, roleKey)),
      resolveDataset('visits', () => fetchVisitDispositionList(tenantId, roleKey)),
    ]);

    const nextData: LiquidCurrentData = { ...EMPTY_DATA };
    const nextErrors: LiquidCurrentDataState['errors'] = {};

    for (const result of results) {
      if (result.data) {
        if (result.key === 'clients') nextData.clients = result.data as LiquidCurrentData['clients'];
        if (result.key === 'employees') nextData.employees = result.data as LiquidCurrentData['employees'];
        if (result.key === 'invoices') nextData.invoices = result.data as LiquidCurrentData['invoices'];
        if (result.key === 'documents') nextData.documents = result.data as LiquidCurrentData['documents'];
        if (result.key === 'visits') nextData.visits = result.data as LiquidCurrentData['visits'];
      }
      if (result.error) nextErrors[result.key] = result.error;
    }

    setData(nextData);
    setErrors(nextErrors);
    setLastSynchronizedAt(new Date().toISOString());
    setInitialized(true);
    setLoading(false);
  }, [authReady, isAuthenticated, profile, roleKey, tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return useMemo(
    () => ({
      data,
      loading,
      initialized,
      tenantId,
      roleKey,
      errors,
      reload,
      lastSynchronizedAt,
    }),
    [data, errors, initialized, lastSynchronizedAt, loading, reload, roleKey, tenantId],
  );
}
