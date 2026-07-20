import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
import { createInvoice } from '@/lib/office/invoiceCreateService';
import {
  buildBillingPeriodOptions,
  buildSystemInvoiceNumber,
  calculateDueDate,
  INVOICE_TYPE_OPTIONS,
  PAYMENT_TERM_OPTIONS,
} from '@/lib/office/invoiceSystemFields';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
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
        description: [client.city, client.careLevel].filter(Boolean).join(' · '),
      })),
    [clientsQuery.data],
  );
  const dueDate = calculateDueDate(paymentTermDays);

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
        <SuccessState message="Rechnung wurde im Demo-Mandanten angelegt." />
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
        <PremiumButton title="Anlegen" fullWidth onPress={handleSubmit} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </PremiumCard>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
});
