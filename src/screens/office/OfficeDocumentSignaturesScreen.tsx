import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { C14vSubpageShell } from '@/components/layout/C14vSubpageShell';
import { AuroraSegmentedControl } from '@/components/aurora';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
} from '@/components/ui';
import { useOfficeDocumentSignatures } from '@/hooks/useOfficeDocumentSignatures';
import { usePermissions } from '@/hooks/usePermissions';
import { moduleColor } from '@/design/tokens/modules';
import type { PortalSignatureDocument } from '@/types/portal/documentSignatures';
import {
  PORTAL_SIGNATURE_PRIORITY_LABELS,
  PORTAL_SIGNATURE_STATUS_LABELS,
  PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS,
} from '@/types/portal/documentSignatures';
import type { PortalSignatureDocumentType } from '@/types/portal/documentSignatures';
import { spacing, typography } from '@/theme';

type OfficeFilter = 'all' | 'open' | 'completed';

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE');
}

export function OfficeDocumentSignaturesScreen() {
  const officeAccent = moduleColor('office');
  const { can } = usePermissions();
  const { items, loading, error, refresh, create, withdraw } = useOfficeDocumentSignatures();
  const [filter, setFilter] = useState<OfficeFilter>('open');
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const canManage = can('office.documents.signatures.manage' as never);

  const filtered = useMemo(() => {
    if (filter === 'open') {
      return items.filter((d) =>
        ['new', 'open', 'in_progress', 'partially_signed'].includes(d.status),
      );
    }
    if (filter === 'completed') return items.filter((d) => d.status === 'completed');
    return items;
  }, [items, filter]);

  const handleCreate = async () => {
    setCreateError(null);
    setCreating(true);
    const result = await create({
      title: title.trim() || 'Neues Dokument',
      documentType: 'sonstiges' as PortalSignatureDocumentType,
      recipientType: 'employee',
      employeeId: 'employee-003',
      signatureRequirement: 'employee',
      priority: 'normal',
      previewHtml: '<h1>Dokument zur Unterschrift</h1><p>Bitte unterschreiben Sie dieses Dokument im Mitarbeiterportal.</p>',
    });
    setCreating(false);
    if (result.ok) {
      setShowCreate(false);
      setTitle('');
    } else {
      setCreateError(result.error ?? 'Senden fehlgeschlagen.');
    }
  };

  if (loading && items.length === 0) {
    return (
      <C14vSubpageShell title="Dokumente & Unterschriften" showBack={false} scroll={false}>
        <LoadingState message="Signaturaufträge werden geladen…" />
      </C14vSubpageShell>
    );
  }

  return (
    <C14vSubpageShell
      title="Dokumente & Unterschriften"
      eyebrow="OFFICE · SIGNATUR"
      subtitle="Dokumente an Mitarbeitende und Klient:innen senden"
      moduleLabel="Office"
      showBack={false}
      accentColor={officeAccent}
      actions={[
        ...(canManage
          ? [{
              key: 'create',
              label: 'Senden',
              onPress: () => setShowCreate(true),
              variant: 'primary' as const,
            }]
          : []),
        { key: 'refresh', label: 'Aktualisieren', onPress: () => refresh(), variant: 'ghost' as const },
      ]}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <ErrorState message={error} onRetry={refresh} /> : null}

        <AuroraSegmentedControl
          options={[
            { key: 'open', label: 'Offen' },
            { key: 'completed', label: 'Erledigt' },
            { key: 'all', label: 'Alle' },
          ]}
          value={filter}
          onChange={(key) => setFilter(key as OfficeFilter)}
        />

        {showCreate ? (
          <PremiumCard accentColor={officeAccent} style={styles.createCard}>
            <Text style={styles.createTitle}>Dokument zur Unterschrift senden</Text>
            <PremiumInput label="Dokumenttitel" value={title} onChangeText={setTitle} />
            {createError ? <Text style={styles.errorText}>{createError}</Text> : null}
            <View style={styles.createActions}>
              <PremiumButton title="Abbrechen" variant="ghost" onPress={() => setShowCreate(false)} />
              <PremiumButton title="An Portal senden" loading={creating} onPress={() => void handleCreate()} />
            </View>
          </PremiumCard>
        ) : null}

        {filtered.length === 0 ? (
          <EmptyState
            title="Keine Signaturaufträge"
            message="Senden Sie ein Dokument an das Mitarbeiterportal zur Unterschrift."
          />
        ) : (
          filtered.map((doc) => (
            <SignatureDocumentCard
              key={doc.id}
              doc={doc}
              accentColor={officeAccent}
              canManage={canManage}
              onWithdraw={() => void withdraw(doc.id)}
            />
          ))
        )}
      </ScrollView>
    </C14vSubpageShell>
  );
}

function SignatureDocumentCard({
  doc,
  accentColor,
  canManage,
  onWithdraw,
}: {
  doc: PortalSignatureDocument;
  accentColor: string;
  canManage: boolean;
  onWithdraw: () => void;
}) {
  const isOpen = ['new', 'open', 'in_progress', 'partially_signed'].includes(doc.status);
  return (
    <PremiumCard accentColor={accentColor} style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{doc.title}</Text>
        <PremiumBadge label={PORTAL_SIGNATURE_STATUS_LABELS[doc.status]} variant="cyan" />
      </View>
      <Text style={styles.meta}>
        {PORTAL_SIGNATURE_DOCUMENT_TYPE_LABELS[doc.documentType]} · {doc.clientName ?? 'Mitarbeiter'}
      </Text>
      <Text style={styles.meta}>
        Fällig: {formatDate(doc.dueDate)} · Priorität: {PORTAL_SIGNATURE_PRIORITY_LABELS[doc.priority]}
      </Text>
      <Text style={styles.meta}>Gesendet: {formatDate(doc.sentAt)}</Text>
      {canManage && isOpen ? (
        <PremiumButton title="Zurückziehen" variant="ghost" onPress={onWithdraw} />
      ) : null}
    </PremiumCard>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: spacing.md, padding: spacing.md },
  card: { width: '100%' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...typography.body, fontWeight: '700', flex: 1 },
  meta: { ...typography.caption, marginTop: spacing.xs },
  createCard: { gap: spacing.sm },
  createTitle: { ...typography.body, fontWeight: '700' },
  createActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  errorText: { ...typography.caption, color: '#ef4444' },
});
