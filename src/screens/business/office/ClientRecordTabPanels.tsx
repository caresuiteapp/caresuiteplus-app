import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumCard,
  PremiumInput,
  SectionPanel,
  SuccessState,
  Timeline,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchClientConsents, updateClientConsent } from '@/lib/clients/clientConsentsService';
import { ClientRecordDocumentsPanel } from '@/components/office/ClientRecordDocumentsPanel';
import { ClientRecordContractsPanel } from '@/components/office/ClientRecordContractsPanel';
import { addClientMedication, fetchClientMedications } from '@/lib/clients/clientMedicationService';
import { fetchClientPortalAccess } from '@/lib/clients/clientPortalAccessService';
import { ClientPortalAccessPanel } from '@/components/clients/ClientPortalAccessPanel';
import { addTimelineEvent, fetchClientTimeline } from '@/lib/clients/clientTimelineService';
import { buildTimelineEntrySubtitle } from '@/lib/clients/clientTimelineAggregation';
import { addClientVital, fetchClientVitals } from '@/lib/clients/clientVitalsService';
import { ClientTasksPanel } from '@/components/office/ClientTasksPanel';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { fetchClientModuleAssignments } from '@/lib/officeModules/moduleAssignmentService';
import { PRODUCT_LABELS } from '@/data/demo/products';
import {
  AngehoerigeTab,
  EinwilligungenTab,
  PflegegradBudgetTab,
  RisikenNotfallTab,
  VertragAbrechnungTab,
} from '@/screens/office/ClientFullDetailTabs';
import type { ClientFullDetail } from '@/types/modules/client';
import { formatDate, formatDateTime } from '@/lib/formatters/dateTimeFormatters';
import { colors, spacing, typography } from '@/theme';

type TabPanelProps = {
  clientId: string;
  fullClient: ClientFullDetail | null;
  canViewSensitive: boolean;
  onRecordRefresh?: () => void;
};

function useClientTabQuery<T>(
  clientId: string,
  fetcher: (tenantId: string, clientId: string) => Promise<{ ok: boolean; data?: T; error?: string }>,
  enabled = true,
) {
  const tenantId = useServiceTenantId();
  return useAsyncQuery<T>(
    () => {
      if (!tenantId || !clientId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetcher(tenantId, clientId) as Promise<{ ok: true; data: T } | { ok: false; error: string }>;
    },
    [tenantId, clientId],
    { enabled: enabled && !!tenantId && !!clientId },
  );
}

export function ClientRecordConsentsPanel({ clientId, fullClient, onRecordRefresh }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const query = useClientTabQuery(clientId, fetchClientConsents);

  async function toggleConsent(consentId: string, granted: boolean) {
    if (!tenantId || isReadOnly) return;
    const result = await updateClientConsent(tenantId, clientId, consentId, granted);
    if (result.ok) {
      await query.refresh();
      onRecordRefresh?.();
    }
  }

  if (query.loading && !query.data) return <LoadingState message="Einwilligungen werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const consents = query.data ?? fullClient?.consents ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel title="Einwilligungen">
        {consents.length === 0 ? (
          <EmptyState title="Keine Einwilligungen" message="Einwilligungen werden bei der Aufnahme erfasst." />
        ) : (
          consents.map((c) => (
            <PremiumCard key={c.id} style={styles.card}>
              <Text style={styles.primary}>{c.title}</Text>
              <Text style={styles.secondary}>{c.consentType} · {c.granted ? 'erteilt' : 'offen'}</Text>
              {!isReadOnly ? (
                <PremiumButton
                  title={c.granted ? 'Widerrufen' : 'Erteilen'}
                  variant="secondary"
                  onPress={() => toggleConsent(c.id, !c.granted)}
                />
              ) : null}
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function ClientRecordMedicationPanel({ clientId, onRecordRefresh }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [schedule, setSchedule] = useState('1-0-1-0');
  const query = useClientTabQuery(clientId, fetchClientMedications);

  async function handleAdd() {
    if (!tenantId || isReadOnly || !name.trim()) return;
    await addClientMedication(tenantId, clientId, { name: name.trim(), dosage, scheduleSchema: schedule });
    setName('');
    setDosage('');
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && !query.data) return <LoadingState message="Medikation wird geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  return (
    <View style={styles.panel}>
      <SectionPanel title="Medikation">
        {(query.data ?? []).length === 0 ? (
          <EmptyState title="Keine Medikamente" message="Medikamente aus Pflegeplan oder manuell erfassen." />
        ) : (
          query.data!.map((m) => (
            <PremiumCard key={m.id} style={styles.card}>
              <Text style={styles.primary}>{m.name}</Text>
              <Text style={styles.secondary}>
                {m.dosage ?? '—'} · Schema {m.scheduleSchema ?? '—'} · {m.status}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      {!isReadOnly ? (
        <SectionPanel title="Medikament hinzufügen">
          <PremiumInput label="Name *" value={name} onChangeText={setName} />
          <PremiumInput label="Dosierung" value={dosage} onChangeText={setDosage} />
          <PremiumInput label="Schema (morgens-mittags-abends-nachts)" value={schedule} onChangeText={setSchedule} />
          <PremiumButton title="Speichern" onPress={handleAdd} />
        </SectionPanel>
      ) : null}
    </View>
  );
}

export function ClientRecordVitalsPanel({ clientId, onRecordRefresh }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [vitalType, setVitalType] = useState('puls');
  const [value, setValue] = useState('');
  const query = useClientTabQuery(clientId, fetchClientVitals);

  async function handleAdd() {
    if (!tenantId || isReadOnly || !value.trim()) return;
    await addClientVital(tenantId, clientId, {
      vitalType,
      value: value.trim(),
      unit: vitalType === 'puls' ? 'bpm' : undefined,
    });
    setValue('');
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && !query.data) return <LoadingState message="Vitalwerte werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  return (
    <View style={styles.panel}>
      <SectionPanel title="Vitalwerte">
        {(query.data ?? []).length === 0 ? (
          <EmptyState title="Keine Vitalwerte" />
        ) : (
          query.data!.map((v) => (
            <PremiumCard key={v.id} style={styles.card}>
              <Text style={styles.primary}>{v.vitalType}: {v.value}{v.unit ? ` ${v.unit}` : ''}</Text>
              <Text style={styles.secondary}>{formatDate(v.recordedAt)}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      {!isReadOnly ? (
        <SectionPanel title="Messung erfassen">
          <FilterChipGroup
            options={[
              { key: 'puls', label: 'Puls' },
              { key: 'blutdruck', label: 'Blutdruck' },
              { key: 'temperatur', label: 'Temperatur' },
              { key: 'blutzucker', label: 'Blutzucker' },
            ]}
            value={vitalType}
            onChange={setVitalType}
          />
          <PremiumInput label="Wert *" value={value} onChangeText={setValue} />
          <PremiumButton title="Messung speichern" onPress={handleAdd} />
        </SectionPanel>
      ) : null}
    </View>
  );
}

export function ClientRecordTimelinePanel({ clientId, fullClient }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const [note, setNote] = useState('');
  const query = useClientTabQuery(clientId, (tid, cid) => fetchClientTimeline(tid, cid));

  async function handleAdd() {
    if (!tenantId || isReadOnly || !note.trim()) return;
    await addTimelineEvent(tenantId, clientId, {
      title: note.trim(),
      subtitle: 'Manuelle Notiz',
      actorName: profile?.displayName ?? 'Office',
      timestamp: new Date().toISOString(),
      icon: '📝',
      status: 'aktiv',
      isInternal: false,
      eventType: 'notiz',
      metadata: null,
    });
    setNote('');
    await query.refresh();
  }

  if (query.loading && !query.data) return <LoadingState message="Verlauf wird geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const items = (query.data ?? []).map((e) => ({
    id: e.id,
    icon: e.icon,
    title: e.title,
    subtitle: `${formatDateTime(e.timestamp)} · ${buildTimelineEntrySubtitle(e)}`,
    timestamp: e.timestamp,
    status: e.status,
    type: 'care' as const,
  }));

  const internalNotes = fullClient?.internalNotes ?? [];

  return (
    <View style={styles.panel}>
      <SectionPanel title="Verlauf / Timeline">
        {items.length === 0 ? (
          <EmptyState
            title="Noch keine Einträge"
            message="Änderungen an Stammdaten, Dokumenten, Portal und Aufgaben erscheinen hier automatisch. Sie können auch manuelle Notizen hinzufügen."
          />
        ) : (
          <Timeline items={items} maxItems={500} />
        )}
      </SectionPanel>
      {internalNotes.length > 0 ? (
        <SectionPanel title="Interne Notizen" subtitle="Nur Office — nicht im Portal">
          {internalNotes.map((n) => (
            <PremiumCard key={n.id} accentColor={colors.violet} style={styles.card}>
              <Text style={styles.secondary}>{n.category} · {n.createdBy}</Text>
              <Text style={styles.primary}>{n.content}</Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      ) : null}
      {!isReadOnly ? (
        <SectionPanel title="Eintrag hinzufügen">
          <PremiumInput label="Notiz" value={note} onChangeText={setNote} multiline />
          <PremiumButton title="Eintrag speichern" onPress={handleAdd} />
        </SectionPanel>
      ) : null}
    </View>
  );
}

export function ClientRecordModulesPanel({ clientId }: TabPanelProps) {
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const query = useAsyncQuery(
    () => {
      if (!tenantId) return Promise.resolve({ ok: false as const, error: 'Kein Mandant.' });
      return fetchClientModuleAssignments(tenantId, profile?.roleKey);
    },
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );

  if (query.loading && !query.data) return <LoadingState message="Modulzuordnungen werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const assignments = (query.data ?? []).filter((a) => a.clientId === clientId);

  return (
    <View style={styles.panel}>
      <SectionPanel title="Zugeordnete Module">
        {assignments.length === 0 ? (
          <EmptyState title="Keine Modulzuordnungen" message="Module werden in Office → Modulzuordnungen verwaltet." />
        ) : (
          assignments.map((a) => (
            <PremiumCard key={a.id} style={styles.card}>
              <Text style={styles.primary}>{PRODUCT_LABELS[a.moduleKey]}</Text>
              <Text style={styles.secondary}>
                {a.primaryEmployeeName ?? '—'} · {formatDate(a.assignedAt)} · {a.status}
              </Text>
              <PremiumBadge label={a.status} variant="cyan" />
            </PremiumCard>
          ))
        )}
      </SectionPanel>
    </View>
  );
}

export function ClientRecordPortalPanel({ clientId, fullClient, onRecordRefresh }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const query = useClientTabQuery(clientId, fetchClientPortalAccess);

  if (fullClient && tenantId) {
    return (
      <View style={styles.panel}>
        <ClientPortalAccessPanel
          client={fullClient}
          tenantId={tenantId}
          isReadOnly={isReadOnly}
          onRefresh={onRecordRefresh}
        />
      </View>
    );
  }

  if (query.loading) return <LoadingState message="Portal-Zugänge werden geladen…" />;
  if (query.error) return <ErrorState message={query.error} onRetry={query.refresh} />;

  return (
    <View style={styles.panel}>
      <SectionPanel title="Portal-Zugänge">
        {(query.data ?? []).length === 0 ? <EmptyState title="Keine Zugänge" /> : null}
      </SectionPanel>
    </View>
  );
}

export function ClientRecordTasksPanel({
  clientId,
  fullClient,
  onRecordRefresh,
  showShiftPreferences = false,
}: TabPanelProps & { showShiftPreferences?: boolean }) {
  return (
    <ClientTasksPanel
      clientId={clientId}
      fullClient={fullClient}
      showShiftPreferences={showShiftPreferences}
      onRecordRefresh={onRecordRefresh}
    />
  );
}

export function ClientRecordTabContent({
  tab,
  clientId,
  fullClient,
  canViewSensitive,
  onRecordRefresh,
}: TabPanelProps & { tab: ClientRecordTabKey }) {
  const panelProps: TabPanelProps = { clientId, fullClient, canViewSensitive, onRecordRefresh };

  if (fullClient) {
    if (tab === 'angehoerige') return <AngehoerigeTab client={fullClient} />;
    if (tab === 'pflegegrad') return <PflegegradBudgetTab client={fullClient} />;
    if (tab === 'abrechnung') return <VertragAbrechnungTab client={fullClient} />;
    if (tab === 'vertrag') {
      return <ClientRecordContractsPanel clientId={clientId} fullClient={fullClient} />;
    }
    if (tab === 'risiken') return <RisikenNotfallTab client={fullClient} canViewSensitive={canViewSensitive} />;
    if (tab === 'dokumente') {
      return (
        <ClientRecordDocumentsPanel
          clientId={clientId}
          initialDocuments={fullClient.documents}
          onRecordRefresh={onRecordRefresh}
        />
      );
    }
    if (tab === 'einwilligungen') {
      return (
        <View style={styles.panel}>
          <EinwilligungenTab client={fullClient} />
          <ClientRecordConsentsPanel {...panelProps} />
        </View>
      );
    }
    if (tab === 'verlauf') {
      return <ClientRecordTimelinePanel {...panelProps} />;
    }
    if (tab === 'aufgaben') {
      return <ClientRecordTasksPanel {...panelProps} />;
    }
    if (tab === 'einsaetze') {
      return <ClientRecordTasksPanel {...panelProps} showShiftPreferences />;
    }
  }

  switch (tab) {
    case 'dokumente':
      return (
        <ClientRecordDocumentsPanel
          clientId={clientId}
          initialDocuments={fullClient?.documents}
          onRecordRefresh={onRecordRefresh}
        />
      );
    case 'einwilligungen':
      return <ClientRecordConsentsPanel {...panelProps} />;
    case 'vertrag':
      return <ClientRecordContractsPanel clientId={clientId} fullClient={fullClient} />;
    case 'medikation':
      return <ClientRecordMedicationPanel {...panelProps} />;
    case 'vitalwerte':
      return <ClientRecordVitalsPanel {...panelProps} />;
    case 'verlauf':
      return <ClientRecordTimelinePanel {...panelProps} />;
    case 'module':
      return <ClientRecordModulesPanel {...panelProps} />;
    case 'portal':
      return <ClientRecordPortalPanel {...panelProps} />;
    case 'aufgaben':
      return <ClientRecordTasksPanel {...panelProps} />;
    case 'einsaetze':
      return <ClientRecordTasksPanel {...panelProps} showShiftPreferences />;
    default:
      return (
        <SectionPanel title="Bereich">
          <EmptyState
            title="Keine Detailansicht"
            message="Für diesen Kontext sind noch keine spezifischen Akte-Daten hinterlegt."
          />
        </SectionPanel>
      );
  }
}

const styles = StyleSheet.create({
  panel: { gap: spacing.md, paddingBottom: spacing.lg },
  card: { marginBottom: spacing.sm },
  primary: { ...typography.label },
  secondary: { ...typography.caption, color: colors.textMuted, marginTop: spacing.xs },
});
