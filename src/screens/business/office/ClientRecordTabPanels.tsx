import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CareCatalogSelect } from '@/components/inputs';
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
import { createContractFromTemplate, fetchClientContracts } from '@/lib/clients/clientContractsService';
import { fetchClientConsents, updateClientConsent } from '@/lib/clients/clientConsentsService';
import { listClientDocuments, uploadClientDocument } from '@/lib/clients/clientDocumentsService';
import { addClientMedication, fetchClientMedications } from '@/lib/clients/clientMedicationService';
import { fetchClientPortalAccess, invitePortalAccess } from '@/lib/clients/clientPortalAccessService';
import { addTimelineEvent, fetchClientTimeline } from '@/lib/clients/clientTimelineService';
import { addClientVital, fetchClientVitals } from '@/lib/clients/clientVitalsService';
import { fetchClientTasks, addClientTaskFromCatalog } from '@/lib/clients/clientTasksService';
import type { ClientRecordTabKey } from '@/lib/clients/clientIntakeFieldRules';
import { fetchClientModuleAssignments } from '@/lib/officeModules/moduleAssignmentService';
import { PRODUCT_LABELS } from '@/data/demo/products';
import { TASK_CATALOG } from '@/data/demo/clients';
import {
  AngehoerigeTab,
  DokumenteTab,
  EinwilligungenTab,
  EinsatzAufgabenTab,
  PflegegradBudgetTab,
  PortalTab,
  RisikenNotfallTab,
  VerlaufTab,
  VertragAbrechnungTab,
} from '@/screens/office/ClientFullDetailTabs';
import type { ClientFullDetail } from '@/types/modules/client';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
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

export function ClientRecordDocumentsPanel({ clientId, fullClient, onRecordRefresh }: TabPanelProps) {
  const router = useRouter();
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('vertrag');
  const [fileName, setFileName] = useState('');
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const query = useClientTabQuery(clientId, listClientDocuments);

  async function handleUpload() {
    if (!tenantId || isReadOnly || !title.trim() || !fileName.trim()) return;
    setWorking(true);
    setMessage(null);
    const result = await uploadClientDocument(tenantId, clientId, {
      title: title.trim(),
      category,
      fileName: fileName.trim(),
      mimeType: 'application/pdf',
    });
    setWorking(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setTitle('');
    setFileName('');
    setMessage('Dokument hochgeladen.');
    await query.refresh();
    onRecordRefresh?.();
  }

  if (query.loading && !query.data) return <LoadingState message="Dokumente werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  const documents = query.data ?? fullClient?.documents ?? [];

  return (
    <View style={styles.panel}>
      {message ? <SuccessState message={message} /> : null}
      <SectionPanel title="Dokumente in Akte">
        {documents.length === 0 ? (
          <EmptyState title="Keine Dokumente" message="Laden Sie ein Dokument hoch oder generieren Sie eines aus Vorlagen." />
        ) : (
          documents.map((doc) => (
            <PremiumCard key={doc.id} style={styles.card}>
              <Text style={styles.primary}>{doc.title}</Text>
              <Text style={styles.secondary}>{doc.fileName} · {doc.category} · {doc.status}</Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      {!isReadOnly ? (
        <SectionPanel title="Dokument hochladen">
          <PremiumInput label="Titel *" value={title} onChangeText={setTitle} />
          <CareCatalogSelect catalogKey="document_category" label="Kategorie" value={category} onChange={setCategory} />
          <PremiumInput label="Dateiname *" value={fileName} onChangeText={setFileName} placeholder="vertrag.pdf" />
          <PremiumButton title={working ? 'Speichern…' : 'In Akte speichern'} onPress={handleUpload} disabled={working} />
        </SectionPanel>
      ) : null}
      <PremiumButton
        title="Rechtliche Dokumente (Vorlage → Signatur)"
        variant="secondary"
        onPress={() => router.push(`/business/office/clients/${clientId}/documents` as never)}
      />
    </View>
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

export function ClientRecordContractsPanel({ clientId }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [contractType, setContractType] = useState('kundenvertrag');
  const query = useClientTabQuery(clientId, fetchClientContracts);

  async function handleCreate() {
    if (!tenantId || isReadOnly) return;
    await createContractFromTemplate(tenantId, clientId, contractType);
    await query.refresh();
  }

  if (query.loading && !query.data) return <LoadingState message="Verträge werden geladen…" />;
  if (query.error && !query.data) return <ErrorState message={query.error} onRetry={query.refresh} />;

  return (
    <View style={styles.panel}>
      <SectionPanel title="Verträge">
        {(query.data ?? []).length === 0 ? (
          <EmptyState title="Keine Verträge" />
        ) : (
          query.data!.map((c) => (
            <PremiumCard key={c.id} style={styles.card}>
              <Text style={styles.primary}>{c.contractNumber}</Text>
              <Text style={styles.secondary}>
                {formatDate(c.contractStart)} · {c.status} · {c.signedAt ? 'signiert' : 'offen'}
              </Text>
            </PremiumCard>
          ))
        )}
      </SectionPanel>
      {!isReadOnly ? (
        <SectionPanel title="Vertrag aus Vorlage">
          <FilterChipGroup
            options={[
              { key: 'kundenvertrag', label: 'Kundenvertrag' },
              { key: 'pflegevertrag', label: 'Pflegevertrag' },
              { key: 'leistungsvereinbarung', label: 'Leistungsvereinbarung' },
            ]}
            value={contractType}
            onChange={setContractType}
          />
          <PremiumButton title="Vertrag anlegen" variant="secondary" onPress={handleCreate} />
        </SectionPanel>
      ) : null}
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

export function ClientRecordTimelinePanel({ clientId }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [note, setNote] = useState('');
  const query = useClientTabQuery(clientId, (tid, cid) => fetchClientTimeline(tid, cid));

  async function handleAdd() {
    if (!tenantId || isReadOnly || !note.trim()) return;
    await addTimelineEvent(tenantId, clientId, {
      title: note.trim(),
      subtitle: 'Office-Eintrag',
      actorName: 'Office Demo',
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
    subtitle: e.subtitle ?? e.actorName ?? undefined,
    timestamp: e.timestamp,
    status: e.status,
    type: 'care' as const,
  }));

  return (
    <View style={styles.panel}>
      <SectionPanel title="Verlauf / Timeline">
        {items.length === 0 ? <EmptyState title="Keine Einträge" /> : <Timeline items={items} />}
      </SectionPanel>
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
  const [email, setEmail] = useState('');
  const query = useClientTabQuery(clientId, fetchClientPortalAccess);

  async function handleInvite() {
    if (!tenantId || isReadOnly || !email.trim()) return;
    await invitePortalAccess(tenantId, clientId, email.trim());
    setEmail('');
    await query.refresh();
    onRecordRefresh?.();
  }

  if (fullClient) {
    return (
      <View style={styles.panel}>
        <PortalTab client={fullClient} />
        {!isReadOnly ? (
          <SectionPanel title="Portal einladen">
            <PremiumInput label="E-Mail" value={email} onChangeText={setEmail} />
            <PremiumButton title="Einladung senden" onPress={handleInvite} />
          </SectionPanel>
        ) : null}
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

export function ClientRecordTasksPanel({ clientId, fullClient }: TabPanelProps) {
  const { isReadOnly } = usePermissions();
  const tenantId = useServiceTenantId();
  const [catalogId, setCatalogId] = useState(TASK_CATALOG[0]?.id ?? '');
  const query = useClientTabQuery(clientId, fetchClientTasks);

  async function handleAddTask() {
    if (!tenantId || isReadOnly || !catalogId) return;
    await addClientTaskFromCatalog(tenantId, clientId, catalogId);
    await query.refresh();
  }

  if (fullClient) return <EinsatzAufgabenTab client={fullClient} />;
  if (query.loading) return <LoadingState message="Aufgaben werden geladen…" />;

  return (
    <View style={styles.panel}>
      <SectionPanel title="Aufgaben">
        {(query.data ?? []).length === 0 ? <EmptyState title="Keine Aufgaben" /> : null}
      </SectionPanel>
      {!isReadOnly ? (
        <SectionPanel title="Aus Katalog">
          <FilterChipGroup
            options={TASK_CATALOG.slice(0, 6).map((t) => ({ key: t.id, label: t.title }))}
            value={catalogId}
            onChange={setCatalogId}
          />
          <PremiumButton title="Aufgabe hinzufügen" onPress={handleAddTask} />
        </SectionPanel>
      ) : null}
    </View>
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
    if (tab === 'vertrag' || tab === 'abrechnung') return <VertragAbrechnungTab client={fullClient} />;
    if (tab === 'risiken') return <RisikenNotfallTab client={fullClient} canViewSensitive={canViewSensitive} />;
    if (tab === 'dokumente') {
      return (
        <View style={styles.panel}>
          <DokumenteTab client={fullClient} />
          <ClientRecordDocumentsPanel {...panelProps} />
        </View>
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
      return (
        <View style={styles.panel}>
          <VerlaufTab client={fullClient} />
          <ClientRecordTimelinePanel {...panelProps} />
        </View>
      );
    }
    if (tab === 'aufgaben' || tab === 'einsaetze') return <ClientRecordTasksPanel {...panelProps} />;
  }

  switch (tab) {
    case 'dokumente':
      return <ClientRecordDocumentsPanel {...panelProps} />;
    case 'einwilligungen':
      return <ClientRecordConsentsPanel {...panelProps} />;
    case 'vertrag':
      return <ClientRecordContractsPanel {...panelProps} />;
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
    case 'einsaetze':
      return <ClientRecordTasksPanel {...panelProps} />;
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
