import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FormScreenHero } from '@/components/forms';
import { CareEntitySelect } from '@/components/inputs';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientList } from '@/lib/office/clientListService';
import {
  createInvoice,
  fetchInvoiceCatalogOptions,
  fetchInvoicePositionPreview,
  getInvoiceCatalogQuantities,
} from '@/lib/office/invoiceCreateService';
import {
  buildBillingPeriodOptions,
  buildSystemInvoiceNumber,
  calculateDueDate,
  INVOICE_TYPE_OPTIONS,
  PAYMENT_TERM_OPTIONS,
} from '@/lib/office/invoiceSystemFields';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { formatCurrency } from '@/lib/office/invoiceListService';
import { spacing } from '@/theme';

export function InvoiceCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel, isReadOnly } = usePermissions();
  const billingPeriods = useMemo(() => buildBillingPeriodOptions(), []);
  const [invoiceType, setInvoiceType] = useState('service');
  const [clientId, setClientId] = useState('');
  const [billingPeriod, setBillingPeriod] = useState(billingPeriods[0]?.value ?? '');
  const [paymentTermDays, setPaymentTermDays] = useState('14');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const clientsQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientList(tenantId, profile?.roleKey, { lifecycleFilter: 'active' });
    },
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) },
  );
  const clientOptions = useMemo(
    () =>
      (clientsQuery.data ?? []).map((client) => ({
        value: client.id,
        label: `${client.lastName}, ${client.firstName}`,
        description: [client.city, formatCareLevel(client.careLevel)].filter(Boolean).join(' · '),
      })),
    [clientsQuery.data],
  );
  const dueDate = calculateDueDate(paymentTermDays);
  const positionsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId || !billingPeriod) {
        return Promise.resolve({ ok: false as const, error: 'Auswahl unvollständig.' });
      }
      return fetchInvoicePositionPreview(tenantId, clientId, billingPeriod, profile?.roleKey);
    },
    [tenantId, clientId, billingPeriod, profile?.roleKey],
    { enabled: Boolean(tenantId && clientId && billingPeriod) },
  );
  const positionPreview =
    positionsQuery.data?.clientId === clientId && positionsQuery.data.billingPeriod === billingPeriod
      ? positionsQuery.data
      : null;
  const catalogQuery = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchInvoiceCatalogOptions(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) },
  );
  const catalogOptions = useMemo(
    () =>
      (catalogQuery.data ?? []).map((item) => ({
        value: item.id,
        label: item.name,
        description: `${formatCurrency(item.priceCents)} je ${item.unitLabel}`,
      })),
    [catalogQuery.data],
  );
  const selectedCatalogItem = (catalogQuery.data ?? []).find((item) => item.id === catalogItemId);
  const quantityOptions = useMemo(() => {
    const values = selectedCatalogItem ? getInvoiceCatalogQuantities(selectedCatalogItem.unit) : [1];
    return values.map((value) => ({
      value: String(value),
      label: `${new Intl.NumberFormat('de-DE').format(value)} ${selectedCatalogItem?.unitLabel ?? 'Einheit(en)'}`,
    }));
  }, [selectedCatalogItem]);
  const usesCatalogPosition = Boolean(positionPreview && positionPreview.count === 0);
  const catalogTotalCents = selectedCatalogItem
    ? Math.round(selectedCatalogItem.priceCents * Number(catalogQuantity))
    : 0;

  useEffect(() => {
    setCatalogItemId('');
    setCatalogQuantity('1');
  }, [clientId, billingPeriod]);

  useEffect(() => {
    if (selectedCatalogItem && !quantityOptions.some((option) => option.value === catalogQuantity)) {
      setCatalogQuantity(quantityOptions[0]?.value ?? '1');
    }
  }, [catalogQuantity, quantityOptions, selectedCatalogItem]);

  if (!can('office.invoices.view') || isReadOnly) {
    return (
      <ScreenShell title="Rechnung anlegen" subtitle={roleLabel ?? 'Office'}>
        <LockedActionBanner
          message={check('office.invoices.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (submitting) {
    return (
      <ScreenShell title="Rechnung anlegen" subtitle="Speichern…">
        <LoadingState message="Rechnung wird angelegt…" />
      </ScreenShell>
    );
  }

  if (createdId) {
    return (
      <ScreenShell title="Rechnung angelegt" subtitle="WP 226">
        <SuccessState message="Rechnung wurde mit einer systemgeführten Position angelegt." />
        <PremiumButton
          title="Zur Detailansicht"
          fullWidth
          onPress={() => router.replace(`/business/office/invoices/${createdId}` as never)}
        />
      </ScreenShell>
    );
  }

  const handleSubmit = async () => {
    if (!tenantId) {
      setSubmitError('Kein Mandant am Profil hinterlegt.');
      return;
    }
    if (!clientId) {
      setSubmitError('Bitte eine Klientin oder einen Klienten auswählen.');
      return;
    }
    if (!invoiceType || !billingPeriod || !paymentTermDays) {
      setSubmitError('Bitte alle Systemfelder auswählen.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await createInvoice(
      tenantId,
      {
        title: buildSystemInvoiceNumber(invoiceType, billingPeriod),
        clientId,
        dueDate,
        billingPeriod,
        catalogItemId: usesCatalogPosition ? catalogItemId : undefined,
        catalogQuantity: usesCatalogPosition ? Number(catalogQuantity) : undefined,
      },
      profile?.roleKey,
    );
    setSubmitting(false);
    if (result.ok) {
      setCreatedId(result.data.id);
    } else {
      setSubmitError(result.error);
    }
  };

  return (
    <ScreenShell title="Rechnung anlegen" subtitle="Office Abrechnung">
      <FormScreenHero
        eyebrow="OFFICE · RECHNUNGEN"
        title="Rechnung anlegen"
        meta="Systemgeführt auswählen – Nummer, Status und Fälligkeit entstehen automatisch"
        icon="🧾"
        formMode="create"
        wpNumber={226}
        compact
      />
      <PremiumCard style={styles.card}>
        <CareEntitySelect
          label="Klient:in"
          required
          value={clientId}
          options={clientOptions}
          onChange={setClientId}
          loading={clientsQuery.loading}
          error={clientsQuery.error}
          placeholder="Klient:in aus dem System auswählen"
          searchPlaceholder="Nach Name, Ort oder Pflegegrad suchen…"
          emptyMessage="Keine aktive Klientin bzw. kein aktiver Klient vorhanden."
        />
        <CareEntitySelect
          label="Rechnungsart"
          required
          value={invoiceType}
          options={[...INVOICE_TYPE_OPTIONS]}
          onChange={setInvoiceType}
        />
        <CareEntitySelect
          label="Abrechnungsmonat"
          required
          value={billingPeriod}
          options={billingPeriods}
          onChange={setBillingPeriod}
        />
        {clientId ? (
          positionsQuery.loading || !positionPreview ? (
            <LoadingState message="Abrechenbare Leistungsnachweise werden geprüft…" />
          ) : positionPreview.count > 0 ? (
            <LockedActionBanner
              title={`${positionPreview.count} abrechenbare Leistungsnachweise`}
              message={`Diese Positionen werden automatisch übernommen · Gesamtbetrag ${formatCurrency(positionPreview.totalCents)}.`}
            />
          ) : (
            <>
              <LockedActionBanner
                title="Position aus Leistungskatalog auswählen"
                message="Es gibt keine freigegebenen Leistungsnachweise. Die Rechnung kann mit einer kontrollierten Katalogposition als Entwurf angelegt werden."
              />
              <CareEntitySelect
                label="Leistung"
                required
                value={catalogItemId}
                options={catalogOptions}
                onChange={setCatalogItemId}
                loading={catalogQuery.loading}
                error={catalogQuery.error}
                placeholder="Leistung aus dem Systemkatalog auswählen"
                searchPlaceholder="Leistung suchen…"
                emptyMessage="Keine aktive Leistung mit Preis im Katalog vorhanden."
              />
              {selectedCatalogItem ? (
                <>
                  <CareEntitySelect
                    label="Menge"
                    required
                    value={catalogQuantity}
                    options={quantityOptions}
                    onChange={setCatalogQuantity}
                  />
                  <LockedActionBanner
                    title="Automatisch berechnete Position"
                    message={`${selectedCatalogItem.name} · ${formatCurrency(selectedCatalogItem.priceCents)} je ${selectedCatalogItem.unitLabel} · Gesamt ${formatCurrency(catalogTotalCents)}.`}
                  />
                </>
              ) : null}
            </>
          )
        ) : null}
        <CareEntitySelect
          label="Zahlungsziel"
          required
          value={paymentTermDays}
          options={[...PAYMENT_TERM_OPTIONS]}
          onChange={setPaymentTermDays}
        />
        <LockedActionBanner
          title="Automatische Rechnungsdaten"
          message={`Status: Entwurf · Fällig am ${formatDate(dueDate)} · Rechnungsnummer wird beim Anlegen systemseitig erzeugt.`}
        />
        {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}
        <PremiumButton
          title="Anlegen"
          fullWidth
          disabled={
            !clientId
            || !positionPreview
            || (usesCatalogPosition && (!catalogItemId || !catalogQuantity))
          }
          onPress={handleSubmit}
        />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
});
