import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { CatalogValueSelect } from '@/components/templates';
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
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { createInvoice } from '@/lib/office/invoiceCreateService';
import { spacing } from '@/theme';

export function InvoiceCreateScreen() {
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { can, check, roleLabel, isReadOnly } = usePermissions();
  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState('entwurf');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

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
    if (!title.trim()) {
      setSubmitError('Bezeichnung ist Pflicht.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const result = await createInvoice(
      tenantId,
      { title: title.trim(), clientName: clientName.trim(), dueDate: dueDate.trim() || undefined },
      profile?.roleKey,
    );
    setSubmitting(false);
    if (result.ok) {
      setCreatedId(result.data.id);
    } else {
      setSubmitError(result.error);
    }
  };

  const isEmpty = !title.trim() && !clientName.trim() && !dueDate.trim();

  return (
    <ScreenShell title="Rechnung anlegen" subtitle="Office Abrechnung">
      <FormScreenHero
        eyebrow="OFFICE · RECHNUNGEN"
        title="Rechnung anlegen"
        meta="Bezeichnung, Klient:in und Fälligkeit erfassen"
        icon="🧾"
        formMode="create"
        wpNumber={226}
      />
      {isEmpty ? (
        <EmptyState title="Neue Rechnung" message="Pflichtfeld Bezeichnung und optionale Zuordnung ausfüllen." />
      ) : null}
      <PremiumCard style={styles.card}>
        <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} />
        <PremiumInput label="Klient:in" value={clientName} onChangeText={setClientName} />
        <PremiumInput label="Fälligkeitsdatum" value={dueDate} onChangeText={setDueDate} placeholder="JJJJ-MM-TT" />
        <CatalogValueSelect
          catalogType="invoice_status"
          label="Status (Katalog)"
          value={invoiceStatus}
          onChange={setInvoiceStatus}
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
