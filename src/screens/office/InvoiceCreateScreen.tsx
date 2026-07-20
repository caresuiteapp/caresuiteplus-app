import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FormScreenHero } from '@/components/forms';
import { CareDateInput, CareEntitySelect } from '@/components/inputs';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientList } from '@/lib/office/clientListService';
import {
  createInvoice,
  fetchInvoiceBudgetCapacity,
  fetchInvoiceCatalogOptions,
  fetchInvoicePositionPreview,
  getInvoiceCatalogQuantities,
  parseInvoiceQuantity,
} from '@/lib/office/invoiceCreateService';
import {
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
  const initialDates = useMemo(() => {
    const now = new Date();
    const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    return {
      invoiceDate: iso(now),
      periodStart: iso(new Date(now.getFullYear(), now.getMonth(), 1)),
      periodEnd: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }, []);
  const [invoiceType, setInvoiceType] = useState('service');
  const [clientId, setClientId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(initialDates.invoiceDate);
  const [servicePeriodStart, setServicePeriodStart] = useState(initialDates.periodStart);
  const [servicePeriodEnd, setServicePeriodEnd] = useState(initialDates.periodEnd);
  const [paymentTermDays, setPaymentTermDays] = useState('14');
  const [catalogItemId, setCatalogItemId] = useState('');
  const [catalogQuantity, setCatalogQuantity] = useState('1');
  const [quantityMode, setQuantityMode] = useState<'preset' | 'manual'>('preset');
  const [manualQuantity, setManualQuantity] = useState('');
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
  const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate)
    ? calculateDueDate(paymentTermDays, new Date(`${invoiceDate}T12:00:00`))
    : '';
  const validServicePeriod = Boolean(
    /^\d{4}-\d{2}-\d{2}$/.test(servicePeriodStart)
    && /^\d{4}-\d{2}-\d{2}$/.test(servicePeriodEnd)
    && servicePeriodStart <= servicePeriodEnd,
  );
  const positionsQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId || !validServicePeriod) {
        return Promise.resolve({ ok: false as const, error: 'Auswahl unvollständig.' });
      }
      return fetchInvoicePositionPreview(
        tenantId,
        clientId,
        servicePeriodStart,
        servicePeriodEnd,
        profile?.roleKey,
      );
    },
    [tenantId, clientId, servicePeriodStart, servicePeriodEnd, validServicePeriod, profile?.roleKey],
    { enabled: Boolean(tenantId && clientId && validServicePeriod) },
  );
  const positionPreview =
    positionsQuery.data?.clientId === clientId
      && positionsQuery.data.servicePeriodStart === servicePeriodStart
      && positionsQuery.data.servicePeriodEnd === servicePeriodEnd
      ? positionsQuery.data
      : null;
  const capacityQuery = useAsyncQuery(
    () => {
      if (!tenantId || !clientId || !validServicePeriod) {
        return Promise.resolve({ ok: false as const, error: 'Auswahl unvollständig.' });
      }
      return fetchInvoiceBudgetCapacity(
        tenantId,
        clientId,
        servicePeriodStart,
        servicePeriodEnd,
        profile?.roleKey,
      );
    },
    [tenantId, clientId, servicePeriodStart, servicePeriodEnd, validServicePeriod, profile?.roleKey],
    { enabled: Boolean(tenantId && clientId && validServicePeriod) },
  );
  const budgetCapacity = capacityQuery.data?.clientId === clientId
    && capacityQuery.data.servicePeriodStart === servicePeriodStart
    && capacityQuery.data.servicePeriodEnd === servicePeriodEnd
    ? capacityQuery.data
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
  const grossUnitPriceCents = selectedCatalogItem
    ? Math.round(selectedCatalogItem.priceCents * (1 + selectedCatalogItem.taxRate / 100))
    : 0;
  const quantityOptions = useMemo(() => {
    const values = selectedCatalogItem ? getInvoiceCatalogQuantities(selectedCatalogItem.unit) : [1];
    return values.map((value) => ({
      value: String(value),
      label: `${new Intl.NumberFormat('de-DE').format(value)} ${selectedCatalogItem?.unitLabel ?? 'Einheit(en)'}`,
    }));
  }, [selectedCatalogItem]);
  const usesCatalogPosition = Boolean(positionPreview && positionPreview.count === 0);
  const parsedManualQuantity = parseInvoiceQuantity(manualQuantity);
  const effectiveQuantity = quantityMode === 'manual' ? parsedManualQuantity : Number(catalogQuantity);
  const catalogTotalCents = selectedCatalogItem
    && effectiveQuantity
    ? Math.round(selectedCatalogItem.priceCents * effectiveQuantity * (1 + selectedCatalogItem.taxRate / 100))
    : 0;
  const maximumHours = selectedCatalogItem?.unit === 'hour' && budgetCapacity
    && grossUnitPriceCents > 0
    ? Math.floor((budgetCapacity.effectiveMaximumCents / grossUnitPriceCents) * 100) / 100
    : null;
  const quantityExceedsBudget = Boolean(
    budgetCapacity
    && catalogTotalCents > budgetCapacity.effectiveMaximumCents
    && budgetCapacity.effectiveMaximumCents > 0,
  );

  useEffect(() => {
    setCatalogItemId('');
    setCatalogQuantity('1');
    setManualQuantity('');
    setQuantityMode('preset');
  }, [clientId, servicePeriodStart, servicePeriodEnd]);

  useEffect(() => {
    if (selectedCatalogItem && !quantityOptions.some((option) => option.value === catalogQuantity)) {
      setCatalogQuantity(quantityOptions[0]?.value ?? '1');
    }
  }, [catalogQuantity, quantityOptions, selectedCatalogItem]);

  useEffect(() => {
    setQuantityMode('preset');
    setCatalogQuantity('1');
    setManualQuantity('');
  }, [catalogItemId]);

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
    if (!invoiceType || !invoiceDate || !validServicePeriod || !paymentTermDays) {
      setSubmitError('Bitte alle Systemfelder auswählen.');
      return;
    }
    if (usesCatalogPosition && (!effectiveQuantity || quantityExceedsBudget)) {
      setSubmitError(quantityExceedsBudget ? 'Die gewählte Stundenmenge überschreitet das verfügbare Budget.' : 'Bitte eine gültige Menge eingeben.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await createInvoice(
      tenantId,
      {
        title: buildSystemInvoiceNumber(invoiceType, servicePeriodStart.slice(0, 7)),
        clientId,
        dueDate,
        invoiceDate,
        servicePeriodStart,
        servicePeriodEnd,
        catalogItemId: usesCatalogPosition ? catalogItemId : undefined,
        catalogQuantity: usesCatalogPosition ? (effectiveQuantity ?? undefined) : undefined,
        catalogQuantityMode: usesCatalogPosition ? quantityMode : undefined,
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
        meta="Leistungszeitraum und Rechnungsdatum auswählen – Nummer, Status und Fälligkeit entstehen automatisch"
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
        <CareDateInput label="Leistung von *" value={servicePeriodStart} onChange={setServicePeriodStart} />
        <CareDateInput
          label="Leistung bis *"
          value={servicePeriodEnd}
          onChange={setServicePeriodEnd}
          error={servicePeriodStart && servicePeriodEnd && servicePeriodStart > servicePeriodEnd
            ? 'Das Enddatum muss am oder nach dem Startdatum liegen.'
            : undefined}
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
                  {selectedCatalogItem.unit === 'hour' ? (
                    <CareEntitySelect
                      label="Stundenerfassung"
                      required
                      value={quantityMode}
                      options={[
                        { value: 'preset', label: 'Standardauswahl' },
                        { value: 'manual', label: 'Genaue Stunden eingeben', description: 'Bis zu zwei Nachkommastellen, z. B. 18,52' },
                      ]}
                      onChange={(value) => setQuantityMode(value as 'preset' | 'manual')}
                    />
                  ) : null}
                  {quantityMode === 'manual' && selectedCatalogItem.unit === 'hour' ? (
                    <PremiumInput
                      label="Stunden *"
                      value={manualQuantity}
                      onChangeText={setManualQuantity}
                      keyboardType="decimal-pad"
                      placeholder="z. B. 18,52"
                      hint={maximumHours != null ? `Maximal ${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(maximumHours)} Std. für das verfügbare Budget.` : 'Höchstens zwei Nachkommastellen.'}
                      error={manualQuantity && !parsedManualQuantity
                        ? 'Bitte eine positive Zahl mit höchstens zwei Nachkommastellen eingeben.'
                        : quantityExceedsBudget
                          ? 'Die Stunden überschreiten das verfügbare Budget.'
                          : undefined}
                    />
                  ) : (
                    <CareEntitySelect
                      label={selectedCatalogItem.unit === 'hour' ? 'Stunden' : 'Menge'}
                      required
                      value={catalogQuantity}
                      options={quantityOptions}
                      onChange={setCatalogQuantity}
                    />
                  )}
                  {budgetCapacity && selectedCatalogItem.unit === 'hour' ? (
                    <LockedActionBanner
                      title={`${formatCareLevel(budgetCapacity.careLevel)} · maximal ${new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(maximumHours ?? 0)} Stunden`}
                      message={`Regelanspruch im Zeitraum: § 45b ${formatCurrency(budgetCapacity.baseBudgetCents)}${budgetCapacity.conversionBudgetCents > 0 ? ` + 40 % Umwandlung ${formatCurrency(budgetCapacity.conversionBudgetCents)}` : ' · keine Umwandlung bei PG1'} · ${budgetCapacity.coveredMonths} Kalendermonat(e). Berechnungsbasis: ${formatCurrency(budgetCapacity.effectiveMaximumCents)}${budgetCapacity.availableBudgetCents != null ? ' tatsächlich verfügbar' : ''} bei ${formatCurrency(selectedCatalogItem.priceCents)} je Stunde.`}
                    />
                  ) : null}
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
        <CareDateInput label="Rechnungsdatum *" value={invoiceDate} onChange={setInvoiceDate} />
        <LockedActionBanner
          title="Automatische Rechnungsdaten"
          message={`Status: Entwurf · Rechnungsdatum ${formatDate(invoiceDate)} · Fällig am ${formatDate(dueDate)} · Rechnungsnummer wird beim Anlegen systemseitig erzeugt.`}
        />
        {submitError ? <ErrorState title="Speichern" message={submitError} /> : null}
        <PremiumButton
          title="Anlegen"
          fullWidth
          disabled={
            !clientId
            || !invoiceDate
            || !validServicePeriod
            || !positionPreview
            || (usesCatalogPosition && (!catalogItemId || !effectiveQuantity || quantityExceedsBudget))
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
