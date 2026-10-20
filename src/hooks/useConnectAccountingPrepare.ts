import { useCallback, useEffect, useState } from 'react';
import type { AccountingProviderKey } from '@/types/accounting';
import type { AccountingConnectDashboard } from '@/types/connect/accounting';
import {
  confirmPaymentMatchPrepared,
  fetchAccountingConnectDashboard,
  prepareBelegpaket,
  prepareInvoiceExportBatch,
  preparePaymentImportCsv,
  prepareTaxAdvisorPackageZip,
  suggestPaymentMatch,
  PAYMENT_IMPORT_CSV_TEMPLATE,
} from '@/lib/accounting/connect';
import { useAuth } from '@/lib/auth/context';

export function useConnectAccountingPrepare() {
  const { profile } = useAuth();
  const tenantId = profile?.tenantId ?? null;
  const userId = profile?.id ?? null;

  const [dashboard, setDashboard] = useState<AccountingConnectDashboard | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AccountingProviderKey>('datev');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const result = await fetchAccountingConnectDashboard(tenantId);
    if (result.ok) {
      setDashboard(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runInvoiceExport = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setMessage(null);
    setError(null);
    const result = prepareInvoiceExportBatch({
      tenantId,
      invoiceId: 'inv-001',
      invoiceNumber: 'RE-2026-001',
      providerKey: selectedProvider,
      preparedBy: userId,
    });
    setLoading(false);
    if (result.ok) {
      setMessage('Rechnungsexport vorbereitet — kein externer Transfer.');
      await reload();
    } else {
      setError(result.error);
    }
  }, [tenantId, selectedProvider, userId, reload]);

  const runBelegpaket = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const result = prepareBelegpaket({
      tenantId,
      invoiceIds: ['inv-001', 'inv-002'],
      providerKey: selectedProvider,
      preparedBy: userId,
    });
    setLoading(false);
    if (result.ok) {
      setMessage('Belegpaket vorbereitet.');
      await reload();
    } else {
      setError(result.error);
    }
  }, [tenantId, selectedProvider, userId, reload]);

  const runTaxAdvisorPackage = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const result = prepareTaxAdvisorPackageZip({
      tenantId,
      invoiceIds: ['inv-001'],
      invoiceNumbers: ['RE-2026-001'],
      preparedBy: userId,
    });
    setLoading(false);
    if (result.ok) {
      setMessage('Steuerberater-ZIP vorbereitet.');
      await reload();
    } else {
      setError(result.error);
    }
  }, [tenantId, userId, reload]);

  const runPaymentImport = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    const result = preparePaymentImportCsv({
      tenantId,
      fileName: 'kontoumsaetze-demo.csv',
      csvContent: PAYMENT_IMPORT_CSV_TEMPLATE,
      importedBy: userId,
    });
    setLoading(false);
    if (result.ok) {
      setMessage('Zahlungsimport CSV vorbereitet.');
      await reload();
    } else {
      setError(result.error);
    }
  }, [tenantId, userId, reload]);

  const runBankReconciliation = useCallback(async () => {
    if (!tenantId) return;
    setLoading(true);
    setError(null);
    const tx = dashboard?.bankTransactions[0];
    if (!tx) {
      setError('Zuerst Zahlungsimport durchführen.');
      setLoading(false);
      return;
    }
    const suggest = suggestPaymentMatch({
      tenantId,
      bankTransactionId: tx.id,
      invoiceId: 'inv-001',
    });
    if (!suggest.ok) {
      setError(suggest.error);
      setLoading(false);
      return;
    }
    const confirm = confirmPaymentMatchPrepared({
      tenantId,
      suggestionId: suggest.data.id,
      receiptReference: null,
    });
    setLoading(false);
    if (!confirm.ok) {
      setMessage('Abgleich blockiert wie erwartet — Beleg fehlt.');
    }
    await reload();
  }, [tenantId, dashboard, reload]);

  return {
    dashboard,
    selectedProvider,
    setSelectedProvider,
    loading,
    error,
    message,
    reload,
    runInvoiceExport,
    runBelegpaket,
    runTaxAdvisorPackage,
    runPaymentImport,
    runBankReconciliation,
  };
}

export type { AccountingConnectDashboard };
