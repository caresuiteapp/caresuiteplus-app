import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { CareEntitySelect } from '@/components/inputs';
import { FormScreenHero } from '@/components/forms';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchInvoiceDetail, updateInvoice } from '@/lib/office/invoiceDetailService';
import { calculateDueDate, PAYMENT_TERM_OPTIONS } from '@/lib/office/invoiceSystemFields';
import { INVOICE_STATUS_LABELS } from '@/lib/office/invoiceStatus';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

export function InvoiceEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel, isReadOnly } = usePermissions();
  const [notes, setNotes] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      if (!id) return Promise.resolve({ ok: false as const, error: 'Keine Rechnungs-ID.' });
      return fetchInvoiceDetail(id, tenantId, profile?.roleKey);
    },
    [tenantId, id, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );

  useEffect(() => {
    if (query.data) {
      setNotes(query.data.notes ?? '');
      setDueDate(query.data.dueDate.slice(0, 10));
    }
  }, [query.data]);

  const dueDateOptions = useMemo(() => {
    const options = PAYMENT_TERM_OPTIONS.map((term) => {
      const value = calculateDueDate(term.value);
      return { value, label: `${term.label} · ${formatDate(value)}` };
    });
    if (dueDate && !options.some((option) => option.value === dueDate)) {
      options.unshift({ value: dueDate, label: `Aktuelle Fälligkeit · ${formatDate(dueDate)}` });
    }
    return options;
  }, [dueDate]);

  if (!can('office.invoices.view') || isReadOnly) {
    return (
      <ScreenShell title="Rechnung bearbeiten" subtitle={roleLabel ?? 'Office'}>
        <LockedActionBanner
          message={check('office.invoices.view').reason ?? 'Keine Berechtigung.'}
          roleLabel={roleLabel}
        />
      </ScreenShell>
    );
  }

  if (query.loading && !query.data) {
    return (
      <ScreenShell title="Rechnung bearbeiten" subtitle="Wird geladen…">
        <LoadingState message="Rechnung wird geladen…" />
      </ScreenShell>
    );
  }

  if (query.error && !query.data) {
    return (
      <ScreenShell title="Rechnung bearbeiten" subtitle="Fehler">
        <ErrorState message={query.error} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  const invoice = query.data;
  if (!invoice) {
    return (
      <ScreenShell title="Rechnung bearbeiten" subtitle="Nicht gefunden">
        <EmptyState title="Rechnung nicht gefunden" message="Der Datensatz existiert nicht im Demo-Mandanten." />
      </ScreenShell>
    );
  }

  const handleSave = async () => {
    if (!tenantId || !id) return;
    setSaving(true);
    setSaveError(null);
    const result = await updateInvoice(
      id,
      tenantId,
      { notes, dueDate },
      profile?.roleKey,
      profile?.displayName ?? 'Büro Demo',
    );
    setSaving(false);
    if (result.ok) {
      setSaved(true);
      await query.refresh();
    } else {
      setSaveError(result.error);
    }
  };

  if (saved) {
    return (
      <ScreenShell title="Gespeichert" subtitle={invoice.invoiceNumber}>
        <SuccessState message="Rechnungsstammdaten wurden aktualisiert." />
        <PremiumButton
          title="Zur Detailansicht"
          fullWidth
          onPress={() => router.replace(`/business/office/invoices/${id}` as never)}
        />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Rechnung bearbeiten" subtitle={invoice.invoiceNumber}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="OFFICE · RECHNUNGEN"
          title={invoice.invoiceNumber}
          meta={`Klient:in ${invoice.clientName} · ${INVOICE_STATUS_LABELS[invoice.status]}`}
          icon="🧾"
          formMode="edit"
          wpNumber={227}
        />
        <PremiumCard style={styles.card}>
          <CareEntitySelect
            label="Fälligkeit"
            required
            value={dueDate}
            options={dueDateOptions}
            onChange={setDueDate}
          />
          <LockedActionBanner
            title={`Status: ${INVOICE_STATUS_LABELS[invoice.status]}`}
            message="Statuswechsel werden kontrolliert in der Rechnungsdetailansicht durchgeführt."
          />
          <PremiumInput label="Interne Hinweise" value={notes} onChangeText={setNotes} multiline />
          {saveError ? <ErrorState title="Speichern" message={saveError} /> : null}
          {!notes.trim() && !dueDate.trim() ? (
            <EmptyState title="Keine Angaben" message="Fälligkeit und Hinweise ergänzen." />
          ) : null}
          <PremiumButton title="Speichern" loading={saving} onPress={handleSave} />
          <PremiumButton title="Abbrechen" variant="secondary" onPress={() => router.back()} />
        </PremiumCard>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, paddingBottom: spacing.xxl },
  card: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted },
});
