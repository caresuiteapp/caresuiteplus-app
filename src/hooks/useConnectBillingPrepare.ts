import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BillingExportBatch,
  BillingPreparationResult,
  BillingProviderConfig,
  BillingValidationReport,
  ConnectBillingMode,
  CostCarrier,
  RejectionManagementCase,
  TenantIkProfile,
} from '@/types/connect/billing';
import { CONNECT_BILLING_MODE_LABELS } from '@/types/connect/billing';
import {
  BILLING_MODE_DEFINITIONS,
  createExportPackageAsync,
  fetchCostCarriers,
  fetchTenantIkProfile,
  getRejectionCases,
  listBillingProviders,
  prepareBillingAsync,
  updateTenantBillingMode,
  upsertTenantIkProfile,
} from '@/lib/billing/connect';
import { useAuth } from '@/lib/auth/context';

export function useConnectBillingPrepare() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId ?? null;
  const userId = profile?.id ?? null;

  const [ikProfile, setIkProfile] = useState<TenantIkProfile | null>(null);
  const [billingMode, setBillingMode] = useState<ConnectBillingMode>('leistungsnachweise_export');
  const [costCarriers, setCostCarriers] = useState<CostCarrier[]>([]);
  const [carrierQuery, setCarrierQuery] = useState('');
  const [providers, setProviders] = useState<BillingProviderConfig[]>([]);
  const [validation, setValidation] = useState<BillingValidationReport | null>(null);
  const [preparation, setPreparation] = useState<BillingPreparationResult | null>(null);
  const [exportBatch, setExportBatch] = useState<BillingExportBatch | null>(null);
  const [rejections, setRejections] = useState<RejectionManagementCase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const billingModeOptions = useMemo(
    () =>
      BILLING_MODE_DEFINITIONS.map((entry) => ({
        key: entry.key,
        label: CONNECT_BILLING_MODE_LABELS[entry.key],
        description: entry.description,
      })),
    [],
  );

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const [ikResult, carrierResult] = await Promise.all([
      fetchTenantIkProfile(tenantId),
      fetchCostCarriers(tenantId, carrierQuery),
    ]);
    if (ikResult.ok) {
      setIkProfile(ikResult.data);
      if (ikResult.data?.billingMode) setBillingMode(ikResult.data.billingMode);
    }
    if (carrierResult.ok) setCostCarriers(carrierResult.data);
    setProviders(listBillingProviders(tenantId));
    setRejections(getRejectionCases(tenantId));
    setLoading(false);
  }, [tenantId, carrierQuery]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectBillingMode = useCallback(
    async (mode: ConnectBillingMode) => {
      if (!tenantId) return;
      setBillingMode(mode);
      const result = updateTenantBillingMode(tenantId, mode, userId);
      if (result.ok) setIkProfile(result.data);
    },
    [tenantId, userId],
  );

  const saveIkProfile = useCallback(
    async (patch: { ikNumber?: string | null; bankIban?: string | null; bankAccountHolder?: string | null }) => {
      if (!tenantId) return;
      const result = upsertTenantIkProfile(tenantId, patch);
      if (result.ok) setIkProfile(result.data);
      else setError(result.error);
    },
    [tenantId],
  );

  const searchCarriers = useCallback(
    async (query: string) => {
      setCarrierQuery(query);
      if (!tenantId) return;
      const result = await fetchCostCarriers(tenantId, query);
      if (result.ok) setCostCarriers(result.data);
    },
    [tenantId],
  );

  const runPrepareBilling = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const result = await prepareBillingAsync({
      tenantId,
      billingMode,
      preparedBy: userId,
      billingCase: {
        pflegegrad: 2,
        hasAbtretungEinwilligung: true,
        hasLeistungsnachweis: true,
        hasUnterschrift: true,
        costCarrierId: costCarriers[0]?.costCarrierId ?? null,
        tenantIkNumber: ikProfile?.ikNumber ?? null,
        leistungszeitraumFrom: '2026-05-01',
        leistungszeitraumTo: '2026-05-31',
        budgetAvailableCents: 50000,
        amountCents: 12000,
        stundensatzCents: 3800,
        rechnungsnummer: 'RE-2026-PREP-001',
        leistungsart: 'SGB XI §36',
      },
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreparation(result.data);
    setValidation(result.data.validation);
  }, [tenantId, billingMode, userId, costCarriers, ikProfile?.ikNumber]);

  const createExport = useCallback(async () => {
    if (!tenantId || !validation?.passed) return;
    setLoading(true);
    const result = await createExportPackageAsync({
      tenantId,
      billingMode,
      validationReport: validation,
      preparedBy: userId,
      clientId: 'client-demo',
      invoiceId: 'invoice-demo',
    });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setExportBatch(result.data.batch);
  }, [tenantId, validation, billingMode, userId]);

  return {
    tenantId,
    ikProfile,
    billingMode,
    billingModeOptions,
    costCarriers,
    carrierQuery,
    providers,
    validation,
    preparation,
    exportBatch,
    rejections,
    loading,
    error,
    selectBillingMode,
    saveIkProfile,
    searchCarriers,
    runPrepareBilling,
    createExport,
    reload,
  };
}
