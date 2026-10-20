import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, FilterChipGroup, InfoBanner, LoadingState, PremiumBadge, PremiumButton, PremiumCard, PremiumInput, SectionPanel, SuccessState } from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { fetchCareDiagnoses } from '@/lib/pflege/careClinicalCoreService';
import { recoverCareDiagnosisJournal, recordCareDiagnosisDurably } from '@/lib/pflege/careDiagnosisAtomicWorkflow.web';
import { berlinCalendarDate } from '@/lib/pflege/careTourWorkflow';
import { hasPermission } from '@/lib/permissions';
import { colors, spacing, typography } from '@/theme';

export function CareDiagnosesWebScreen() {
  const tenantId = useServiceTenantId(); const { profile } = useAuth(); const mounted = useRef(true); const ownerRef = useRef('');
  const clients = useAsyncQuery(() => tenantId ? fetchEligibleCareClients(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.id, profile?.roleKey], { enabled: !!tenantId });
  const diagnoses = useAsyncQuery(() => tenantId ? fetchCareDiagnoses(tenantId, profile?.roleKey) : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }), [tenantId, profile?.id, profile?.roleKey], { enabled: !!tenantId });
  const options = useMemo(() => (clients.data ?? []).map(c => ({ key: c.id, label: `${c.lastName}, ${c.firstName}${c.careLevel ? ` · ${c.careLevel}` : ''}` })), [clients.data]);
  const [clientId, setClientId] = useState(''); const [icdCode, setIcdCode] = useState(''); const [icdTitle, setIcdTitle] = useState('');
  const [statement, setStatement] = useState(''); const [physician, setPhysician] = useState(''); const [diagnosedAt, setDiagnosedAt] = useState(berlinCalendarDate());
  const [relevance, setRelevance] = useState(''); const [precautions, setPrecautions] = useState(''); const [sourceDocument, setSourceDocument] = useState('');
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null); const [success, setSuccess] = useState<string | null>(null);
  ownerRef.current = JSON.stringify([tenantId, profile?.id ?? '', clientId]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!tenantId || !clientId || !profile?.id) return;
    let current = true; setBusy(true);
    recoverCareDiagnosisJournal(tenantId, clientId, profile.id).then(async result => {
      if (!current || !mounted.current) return;
      setBusy(false);
      if (!result) return;
      if (!result.ok) setError(`Offene Diagnoseanfrage: ${result.error}`);
      else { setSuccess('Die zuvor unklare Diagnoseanfrage wurde anhand der nativen Doppelquittung bestätigt.'); await diagnoses.refresh(); }
    });
    return () => { current = false; };
  }, [tenantId, clientId, profile?.id]);
  const save = async () => {
    if (!tenantId || !profile?.id || !clientId) return;
    const owner = JSON.stringify([tenantId, profile.id, clientId]); setBusy(true); setError(null); setSuccess(null);
    const result = await recordCareDiagnosisDurably({ tenantId, clientId, actorId: profile.id, requestId: crypto.randomUUID(),
      icdCode, icdTitle, physicianStatement: statement, diagnosedAt: diagnosedAt || null, diagnosedBy: physician,
      sourceDocument, relevanceForCare: relevance, precautions, actorName: profile.displayName ?? 'Pflegefachperson' });
    if (!mounted.current || owner !== ownerRef.current) return;
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setSuccess('Pflegediagnose und unveränderliche klinische Fassung wurden gemeinsam bestätigt.');
    setIcdCode(''); setIcdTitle(''); setStatement(''); setRelevance(''); setPrecautions(''); setSourceDocument('');
    await diagnoses.refresh();
  };
  if (clients.loading || diagnoses.loading) return <ScreenShell title="Diagnosen"><LoadingState message="Pflegediagnosen werden live geladen…" /></ScreenShell>;
  return <ScreenShell title="Diagnosen" subtitle="Ärztliche Angabe · unveränderliche Fassung · gemeinsame Serverquittung">
    <ScrollView contentContainerStyle={styles.scroll}>
      <InfoBanner variant="info" title="Keine automatische Diagnoseentscheidung" message="Der Webweg dokumentiert den übermittelten ärztlichen Wortlaut. Er erzeugt keine Diagnose aus Freitext und bestätigt keine klinische Richtigkeit. Bei unklarer Serverantwort bleibt dieselbe Anfrage gesperrt, bis ihr nativer Doppelbeleg vorliegt." />
      <SectionPanel title="Ärztliche Angabe dokumentieren" subtitle="Pflegediagnose und klinischer Verlauf werden atomar verbunden">
        <Text style={styles.caption}>Aktiver Pflegefall</Text><FilterChipGroup wrap options={options} value={clientId} onChange={setClientId} />
        <View style={styles.row}><PremiumInput label="ICD-10-GM" value={icdCode} onChangeText={setIcdCode} /><PremiumInput label="Bezeichnung *" value={icdTitle} onChangeText={setIcdTitle} /></View>
        <PremiumInput label="Wortlaut / ärztliche Angabe *" value={statement} onChangeText={setStatement} multiline />
        <View style={styles.row}><PremiumInput label="Mitteilende Ärztin/Arzt *" value={physician} onChangeText={setPhysician} /><PremiumInput label="Diagnosedatum" value={diagnosedAt} onChangeText={setDiagnosedAt} /></View>
        <PremiumInput label="Quelldokument / genaue Fundstelle" value={sourceDocument} onChangeText={setSourceDocument} />
        <PremiumInput label="Relevanz für Pflege und Maßnahmen" value={relevance} onChangeText={setRelevance} multiline />
        <PremiumInput label="Vorsichtsmaßnahmen / Beobachtung" value={precautions} onChangeText={setPrecautions} multiline />
        {error ? <ErrorState message={error} /> : null}{success ? <SuccessState message={success} /> : null}
        <PremiumButton title="Ärztliche Angabe verbindlich speichern" fullWidth loading={busy} disabled={busy || !clientId || !hasPermission(profile?.roleKey, 'pflege.diagnoses.manage')} onPress={save} />
      </SectionPanel>
      <SectionPanel title="Aktive und historische Pflegediagnosen" subtitle={`${diagnoses.data?.length ?? 0} Datensätze`}>
        {!diagnoses.data?.length ? <EmptyState title="Keine bestätigten Datensätze" message="Ein leerer Bestand bestätigt keine Diagnosenfreiheit." /> : diagnoses.data.map(item => <PremiumCard key={item.id} style={styles.card}>
          <View style={styles.cardHeader}><Text style={styles.title}>{item.icdCode ? `${item.icdCode} · ` : ''}{item.icdTitle}</Text><PremiumBadge label={item.status} variant={item.status === 'active' ? 'green' : 'muted'} dot /></View>
          <Text style={styles.meta}>{item.clientName} · {item.diagnosedBy || 'Mitteilende Person nicht geliefert'}</Text><Text style={styles.body}>{item.physicianStatement}</Text>
          {item.relevanceForCare ? <Text style={styles.bodyStrong}>Pflegerelevanz: {item.relevanceForCare}</Text> : null}
          <Text style={styles.meta}>Erfasst durch {item.recordedByName || 'Nicht geliefert'} · {new Date(item.createdAt).toLocaleString('de-DE')}</Text>
        </PremiumCard>)}
      </SectionPanel>
    </ScrollView>
  </ScreenShell>;
}
const styles = StyleSheet.create({ scroll: { paddingBottom: spacing.xxl, gap: spacing.md }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  caption: { ...typography.caption, color: colors.textMuted }, card: { gap: spacing.xs }, cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  title: { ...typography.h3, flex: 1 }, meta: { ...typography.caption, color: colors.textMuted }, body: { ...typography.body, color: colors.textSecondary },
  bodyStrong: { ...typography.bodyStrong, color: colors.textPrimary } });
