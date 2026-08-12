import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState, ErrorState, FilterChipGroup, LoadingState, PremiumBadge,
  PremiumButton, PremiumCard, PremiumInput, SectionPanel, SuccessState,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import {
  createCareDiagnosis, createCareMedicalOrder, fetchCareDiagnoses, fetchCareMedicalOrders,
} from '@/lib/pflege/careClinicalCoreService';
import { colors, spacing, typography } from '@/theme';

const today = () => new Date().toISOString().slice(0, 10);

function useCareClientOptions() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => tenantId
      ? fetchEligibleCareClients(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const options = useMemo(() => (query.data ?? []).map((client) => ({
    key: client.id,
    label: `${client.lastName}, ${client.firstName}${client.careLevel ? ` · ${client.careLevel}` : ''}`,
  })), [query.data]);
  return { tenantId, profile, query, options };
}

export function CareDiagnosesScreen() {
  const { tenantId, profile, query: clients, options } = useCareClientOptions();
  const diagnoses = useAsyncQuery(
    () => tenantId
      ? fetchCareDiagnoses(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const [clientId, setClientId] = useState('');
  const [icdCode, setIcdCode] = useState('');
  const [icdTitle, setIcdTitle] = useState('');
  const [statement, setStatement] = useState('');
  const [physician, setPhysician] = useState('');
  const [diagnosedAt, setDiagnosedAt] = useState(today());
  const [relevance, setRelevance] = useState('');
  const [precautions, setPrecautions] = useState('');
  const [sourceDocument, setSourceDocument] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const save = async () => {
    if (!tenantId) return;
    setBusy(true); setError(null); setSuccess(false);
    const result = await createCareDiagnosis(tenantId, {
      clientId, icdCode, icdTitle, physicianStatement: statement, diagnosedAt,
      diagnosedBy: physician, sourceDocument, relevanceForCare: relevance,
      precautions, actorName: profile?.displayName ?? 'Pflegefachperson',
    }, profile?.roleKey);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSuccess(true); setIcdCode(''); setIcdTitle(''); setStatement(''); setRelevance(''); setPrecautions('');
    await diagnoses.refresh();
  };

  if (clients.loading || diagnoses.loading) return <ScreenShell title="Diagnosen"><LoadingState message="Pflegediagnosen werden live geladen…" /></ScreenShell>;
  return (
    <ScreenShell title="Diagnosen" subtitle="Ärztliche Angaben · pflegefachliche Relevanz · Live-Audit">
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionPanel title="Diagnose dokumentieren" subtitle="Dokumentation einer ärztlichen Angabe – keine automatische Diagnoseentscheidung">
          <Text style={styles.caption}>Aktiver Pflegefall</Text>
          <FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} />
          <View style={styles.row}><PremiumInput label="ICD-10-GM" value={icdCode} onChangeText={setIcdCode} /><PremiumInput label="Bezeichnung *" value={icdTitle} onChangeText={setIcdTitle} /></View>
          <PremiumInput label="Wortlaut / ärztliche Angabe *" value={statement} onChangeText={setStatement} multiline />
          <View style={styles.row}><PremiumInput label="Mitteilende Ärztin/Arzt *" value={physician} onChangeText={setPhysician} /><PremiumInput label="Diagnosedatum" value={diagnosedAt} onChangeText={setDiagnosedAt} /></View>
          <PremiumInput label="Relevanz für Pflege und Maßnahmen" value={relevance} onChangeText={setRelevance} multiline />
          <PremiumInput label="Vorsichtsmaßnahmen / Beobachtung" value={precautions} onChangeText={setPrecautions} multiline />
          <PremiumInput label="Quelldokument / Fundstelle" value={sourceDocument} onChangeText={setSourceDocument} />
          {error ? <ErrorState message={error} /> : null}{success ? <SuccessState message="Diagnose wurde live gespeichert und zurückgelesen." /> : null}
          <PremiumButton title="Diagnose live speichern" fullWidth loading={busy} disabled={busy || !options.length} onPress={save} />
        </SectionPanel>
        <SectionPanel title="Aktive und historische Diagnosen" subtitle={`${diagnoses.data?.length ?? 0} Datensätze`}>
          {!diagnoses.data?.length ? <EmptyState title="Keine Diagnosen" message="Es sind noch keine ärztlichen Diagnoseangaben dokumentiert." /> : diagnoses.data.map((item) => (
            <PremiumCard key={item.id} style={styles.card}>
              <View style={styles.cardHeader}><Text style={styles.title}>{item.icdCode ? `${item.icdCode} · ` : ''}{item.icdTitle}</Text><PremiumBadge label={item.status} variant={item.status === 'active' ? 'green' : 'muted'} dot /></View>
              <Text style={styles.meta}>{item.clientName} · {item.diagnosedBy || 'Arztangabe ohne Namenssnapshot'}</Text>
              <Text style={styles.body}>{item.physicianStatement}</Text>
              {item.relevanceForCare ? <Text style={styles.bodyStrong}>Pflegerelevanz: {item.relevanceForCare}</Text> : null}
              <Text style={styles.meta}>Erfasst durch {item.recordedByName || 'System'} · {new Date(item.createdAt).toLocaleString('de-DE')}</Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

export function CareOrdersScreen() {
  const { tenantId, profile, query: clients, options } = useCareClientOptions();
  const orders = useAsyncQuery(
    () => tenantId
      ? fetchCareMedicalOrders(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey], { enabled: Boolean(tenantId) },
  );
  const [clientId, setClientId] = useState('');
  const [orderType, setOrderType] = useState('HKP / Behandlungspflege');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [physician, setPhysician] = useState('');
  const [orderedAt, setOrderedAt] = useState(today());
  const [validFrom, setValidFrom] = useState(today());
  const [validUntil, setValidUntil] = useState('');
  const [approvalRequired, setApprovalRequired] = useState('no');
  const [frequency, setFrequency] = useState('');
  const [instructions, setInstructions] = useState('');
  const [qualification, setQualification] = useState('Pflegefachkraft');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const save = async () => {
    if (!tenantId) return;
    setBusy(true); setError(null); setSuccess(false);
    const result = await createCareMedicalOrder(tenantId, {
      clientId, orderType, title, description, orderingPhysician: physician,
      orderedAt, validFrom, validUntil, approvalRequired: approvalRequired === 'yes',
      frequency, executionInstructions: instructions, qualificationRequirement: qualification,
      actorName: profile?.displayName ?? 'Pflegefachperson',
    }, profile?.roleKey);
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSuccess(true); setTitle(''); setDescription(''); setFrequency(''); setInstructions('');
    await orders.refresh();
  };

  if (clients.loading || orders.loading) return <ScreenShell title="Verordnungen"><LoadingState message="Ärztliche Verordnungen werden live geladen…" /></ScreenShell>;
  return (
    <ScreenShell title="Verordnungen" subtitle="Gültigkeit · Genehmigung · Qualifikation · Live">
      <ScrollView contentContainerStyle={styles.scroll}>
        <SectionPanel title="Ärztliche Verordnung erfassen">
          <Text style={styles.caption}>Aktiver Pflegefall</Text><FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} />
          <PremiumInput label="Verordnungsart *" value={orderType} onChangeText={setOrderType} />
          <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} />
          <PremiumInput label="Verordneter Inhalt *" value={description} onChangeText={setDescription} multiline />
          <PremiumInput label="Verordnende Ärztin/Arzt *" value={physician} onChangeText={setPhysician} />
          <View style={styles.row}><PremiumInput label="Verordnet am" value={orderedAt} onChangeText={setOrderedAt} /><PremiumInput label="Gültig ab" value={validFrom} onChangeText={setValidFrom} /><PremiumInput label="Gültig bis" value={validUntil} onChangeText={setValidUntil} /></View>
          <Text style={styles.caption}>Kostenträgergenehmigung</Text><FilterChipGroup options={[{ key: 'no', label: 'Nicht erforderlich' }, { key: 'yes', label: 'Erforderlich / offen' }]} value={approvalRequired} onChange={setApprovalRequired} />
          <PremiumInput label="Häufigkeit / Zeitfenster" value={frequency} onChangeText={setFrequency} />
          <PremiumInput label="Durchführungsanweisung" value={instructions} onChangeText={setInstructions} multiline />
          <PremiumInput label="Erforderliche Qualifikation" value={qualification} onChangeText={setQualification} />
          {error ? <ErrorState message={error} /> : null}{success ? <SuccessState message="Verordnung wurde live gespeichert und zurückgelesen." /> : null}
          <PremiumButton title="Verordnung live speichern" fullWidth loading={busy} disabled={busy || !options.length} onPress={save} />
        </SectionPanel>
        <SectionPanel title="Verordnungsbestand" subtitle={`${orders.data?.length ?? 0} Datensätze`}>
          {!orders.data?.length ? <EmptyState title="Keine Verordnungen" message="Es sind noch keine ärztlichen Verordnungen dokumentiert." /> : orders.data.map((item) => (
            <PremiumCard key={item.id} style={styles.card}>
              <View style={styles.cardHeader}><Text style={styles.title}>{item.title}</Text><PremiumBadge label={item.status} variant={item.status === 'active' ? 'green' : 'orange'} dot /></View>
              <Text style={styles.meta}>{item.clientName} · {item.orderingPhysician}</Text><Text style={styles.body}>{item.description}</Text>
              <Text style={styles.bodyStrong}>{item.frequency || 'Keine Frequenz hinterlegt'} · {item.qualificationRequirement}</Text>
              <Text style={styles.meta}>Gültig {item.validFrom}{item.validUntil ? ` bis ${item.validUntil}` : ' unbefristet'} · Genehmigung: {item.insurerApprovalStatus}</Text>
            </PremiumCard>
          ))}
        </SectionPanel>
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  caption: { ...typography.caption, color: colors.textMuted },
  card: { gap: spacing.xs }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.h3, flex: 1 }, meta: { ...typography.caption, color: colors.textMuted },
  body: { ...typography.body, color: colors.textSecondary }, bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary },
});
