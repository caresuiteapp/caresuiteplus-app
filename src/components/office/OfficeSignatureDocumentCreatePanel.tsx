import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AuroraSegmentedControl } from '@/components/aurora';
import { PremiumButton, PremiumInput } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { fetchClientList } from '@/lib/office/clientListService';
import { fetchEmployeeList } from '@/lib/office/employeeListService';
import type {
  OfficeCreateSignatureDocumentInput,
  PortalSignatureDocumentType,
  PortalSignaturePriority,
  PortalSignatureRecipientType,
  PortalSignatureRequirement,
} from '@/types/portal/documentSignatures';
import {
  PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS,
  PORTAL_SIGNATURE_PRIORITY_LABELS,
} from '@/types/portal/documentSignatures';
import { spacing, typography } from '@/theme';

const DOCUMENT_TYPES = Object.keys(PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS) as PortalSignatureDocumentType[];

type Props = {
  accentColor: string;
  onCancel: () => void;
  onSubmit: (
    input: Omit<OfficeCreateSignatureDocumentInput, 'tenantId' | 'creatorName' | 'creatorProfileId'>,
  ) => Promise<{ ok: boolean; error?: string }>;
};

export function OfficeSignatureDocumentCreatePanel({ accentColor, onCancel, onSubmit }: Props) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [title, setTitle] = useState('');
  const [documentType, setDocumentType] = useState<PortalSignatureDocumentType>('sonstiges');
  const [recipientType, setRecipientType] = useState<PortalSignatureRecipientType>('employee');
  const [employeeId, setEmployeeId] = useState('');
  const [clientId, setClientId] = useState('');
  const [signatureRequirement, setSignatureRequirement] =
    useState<PortalSignatureRequirement>('employee');
  const [priority, setPriority] = useState<PortalSignaturePriority>('normal');
  const [dueDate, setDueDate] = useState('');
  const [requiredBeforeAssignment, setRequiredBeforeAssignment] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeesQuery = useAsyncQuery(
    () => fetchEmployeeList(tenantId!, profile?.roleKey, profile),
    [tenantId, profile?.roleKey, profile?.id],
    { enabled: !!tenantId },
  );
  const clientsQuery = useAsyncQuery(
    () => fetchClientList(tenantId!, profile?.roleKey, { lifecycleFilter: 'active' }),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  const employeeOptions = useMemo(
    () =>
      (employeesQuery.data ?? []).map((employee) => ({
        key: employee.id,
        label: `${employee.firstName} ${employee.lastName}`.trim(),
      })),
    [employeesQuery.data],
  );
  const clientOptions = useMemo(
    () =>
      (clientsQuery.data ?? []).map((client) => ({
        key: client.id,
        label: `${client.firstName} ${client.lastName}`.trim(),
      })),
    [clientsQuery.data],
  );

  const handleSubmit = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Bitte einen Dokumenttitel eingeben.');
      return;
    }
    if (!employeeId) {
      setError('Bitte einen Mitarbeitenden für die Portal-Zustellung wählen.');
      return;
    }
    if (recipientType === 'client' && !clientId) {
      setError('Bitte eine Klient:in auswählen.');
      return;
    }

    setSubmitting(true);
    const selectedClient = (clientsQuery.data ?? []).find((c) => c.id === clientId);
    const result = await onSubmit({
      title: title.trim(),
      documentType,
      recipientType,
      employeeId,
      clientId: recipientType === 'client' ? clientId : null,
      clientName: selectedClient
        ? `${selectedClient.firstName} ${selectedClient.lastName}`.trim()
        : null,
      signatureRequirement,
      dueDate: dueDate.trim() ? new Date(dueDate).toISOString() : null,
      priority,
      requiredBeforeAssignment,
      allowDownload: true,
      previewHtml: `<h1>${title.trim()}</h1><p>Bitte lesen Sie dieses Dokument vollständig und unterschreiben Sie im Mitarbeiterportal.</p>`,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error ?? 'Senden fehlgeschlagen.');
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.heading}>Dokument zur Unterschrift senden</Text>
      <PremiumInput label="Dokumenttitel" value={title} onChangeText={setTitle} />
      <Text style={styles.label}>Dokumenttyp</Text>
      <AuroraSegmentedControl
        options={DOCUMENT_TYPES.slice(0, 4).map((type) => ({
          key: type,
          label: PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[type],
        }))}
        value={documentType}
        onChange={(key) => setDocumentType(key as PortalSignatureDocumentType)}
      />
      <Text style={styles.label}>Empfänger</Text>
      <AuroraSegmentedControl
        options={[
          { key: 'employee', label: 'Mitarbeiter' },
          { key: 'client', label: 'Klient' },
        ]}
        value={recipientType}
        onChange={(key) => setRecipientType(key as PortalSignatureRecipientType)}
      />
      <Text style={styles.label}>Zustellung an Mitarbeiter (Portal)</Text>
      <AuroraSegmentedControl
        options={
          employeeOptions.length > 0
            ? employeeOptions.slice(0, 5)
            : [{ key: '', label: 'Keine MA geladen' }]
        }
        value={employeeId}
        onChange={setEmployeeId}
      />
      {recipientType === 'client' ? (
        <>
          <Text style={styles.label}>Klient:in</Text>
          <AuroraSegmentedControl
            options={
              clientOptions.length > 0
                ? clientOptions.slice(0, 5)
                : [{ key: '', label: 'Keine Klient:innen geladen' }]
            }
            value={clientId}
            onChange={setClientId}
          />
        </>
      ) : null}
      <Text style={styles.label}>Unterschrift erforderlich</Text>
      <AuroraSegmentedControl
        options={[
          { key: 'employee', label: 'Mitarbeiter' },
          { key: 'client', label: 'Klient' },
          { key: 'both_sequential', label: 'Beide' },
        ]}
        value={signatureRequirement}
        onChange={(key) => setSignatureRequirement(key as PortalSignatureRequirement)}
      />
      <Text style={styles.label}>Priorität</Text>
      <AuroraSegmentedControl
        options={Object.entries(PORTAL_SIGNATURE_PRIORITY_LABELS).map(([key, label]) => ({
          key,
          label,
        }))}
        value={priority}
        onChange={(key) => setPriority(key as PortalSignaturePriority)}
      />
      <PremiumInput
        label="Fälligkeitsdatum (YYYY-MM-DD)"
        value={dueDate}
        onChangeText={setDueDate}
        placeholder="2026-07-15"
      />
      <PremiumButton
        title={requiredBeforeAssignment ? 'Pflicht vor Einsatz: Ja' : 'Pflicht vor Einsatz: Nein'}
        variant="ghost"
        onPress={() => setRequiredBeforeAssignment((value) => !value)}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <PremiumButton title="Abbrechen" variant="ghost" onPress={onCancel} />
        <PremiumButton
          title="An Portal senden"
          loading={submitting}
          onPress={() => void handleSubmit()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  heading: { ...typography.body, fontWeight: '700' },
  label: { ...typography.caption, marginTop: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end', marginTop: spacing.sm },
  error: { ...typography.caption, color: '#ef4444' },
});
