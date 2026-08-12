import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormScreenHero } from '@/components/forms';
import { ScreenShell } from '@/components/layout';
import {
  ErrorState,
  FilterChipGroup,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
  SuccessState,
} from '@/components/ui';
import { useAuth } from '@/lib/auth/context';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAsyncQuery } from '@/hooks/core';
import { fetchEligibleCareClients } from '@/lib/careAssessment';
import { createCarePlan } from '@/lib/pflege/carePlanListService';
import { colors, spacing } from '@/theme';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CarePlanCreateScreen() {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const clients = useAsyncQuery(
    () => tenantId
      ? fetchEligibleCareClients(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey],
    { enabled: Boolean(tenantId) },
  );
  const [clientId, setClientId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [goals, setGoals] = useState('');
  const [resources, setResources] = useState('');
  const [risks, setRisks] = useState('');
  const [validFrom, setValidFrom] = useState(today());
  const [validUntil, setValidUntil] = useState('');
  const [measureTitle, setMeasureTitle] = useState('');
  const [measureGoal, setMeasureGoal] = useState('');
  const [intervention, setIntervention] = useState('');
  const [frequency, setFrequency] = useState('');
  const [responsibleRole, setResponsibleRole] = useState('Pflegefachkraft');
  const [warningSigns, setWarningSigns] = useState('');
  const [escalationPath, setEscalationPath] = useState('');
  const [evaluationCriteria, setEvaluationCriteria] = useState('');
  const [nextEvaluationAt, setNextEvaluationAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const clientOptions = useMemo(
    () => (clients.data ?? []).map((client) => ({
      key: client.id,
      label: `${client.lastName}, ${client.firstName}${client.careLevel ? ` · ${client.careLevel}` : ''}`,
    })),
    [clients.data],
  );

  const save = async () => {
    setError(null);
    if (!tenantId) return setError('Kein Mandant verfügbar.');
    if (!clientId || !title.trim() || !description.trim() || !goals.trim()) {
      return setError('Klient:in, Bezeichnung, Versorgungssituation und Pflegeziele sind erforderlich.');
    }
    if (!measureTitle.trim() || !intervention.trim() || !frequency.trim()) {
      return setError('Die erste Maßnahme benötigt Bezeichnung, Durchführung und Häufigkeit.');
    }
    setBusy(true);
    const result = await createCarePlan(tenantId, profile?.roleKey, {
      clientId,
      title,
      description,
      goals,
      resources,
      risks,
      validFrom,
      validUntil: validUntil || null,
      sourceAssessmentId: null,
      primaryNurseId: null,
      actorName: profile?.displayName ?? 'Pflegefachperson',
      items: [{
        title: measureTitle,
        goal: measureGoal || goals,
        intervention,
        frequency,
        responsibleRole,
        warningSigns,
        escalationPath,
        evaluationCriteria,
        nextEvaluationAt: nextEvaluationAt || null,
        status: 'active',
        sortOrder: 0,
      }],
    });
    setBusy(false);
    if (!result.ok) return setError(result.error);
    setCreatedId(result.data.id);
  };

  if (clients.loading) {
    return <ScreenShell title="Pflegeplan anlegen"><LoadingState message="Aktive Pflegefälle werden geladen…" /></ScreenShell>;
  }
  if (createdId) {
    return (
      <ScreenShell title="Pflegeplan angelegt" showBack={false}>
        <SuccessState message="Der Pflegeplan wurde live gespeichert, versioniert und zurückgelesen." />
        <PremiumButton title="Pflegeplan öffnen" fullWidth onPress={() => router.replace(`/pflege/plans/${createdId}` as never)} />
      </ScreenShell>
    );
  }

  return (
    <ScreenShell title="Pflegeplan anlegen" subtitle="Live · versioniert · auditierbar" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <FormScreenHero
          eyebrow="PFLEGE · LIVE-FACHKERN"
          title="Individuellen Pflegeplan erstellen"
          meta="Pflegefall, Ausgangssituation, Ziele und erste handlungsleitende Maßnahme"
          icon="📋"
          formMode="create"
          accentColor={colors.cyan}
        />
        <SectionPanel title="1. Aktiver Pflegefall" subtitle="Ausschließlich Klient:innen mit aktiver Pflegezuordnung">
          {clientOptions.length ? (
            <FilterChipGroup wrap options={clientOptions} value={clientId} onChange={setClientId} />
          ) : (
            <ErrorState message="Es ist kein aktiver Pflegefall verfügbar. Zuerst muss die Pflegezuordnung abgeschlossen werden." />
          )}
        </SectionPanel>
        <SectionPanel title="2. Pflegefachliche Ausgangslage">
          <PremiumInput label="Bezeichnung *" value={title} onChangeText={setTitle} />
          <PremiumInput label="Versorgungssituation / Zusammenfassung *" value={description} onChangeText={setDescription} multiline />
          <PremiumInput label="Ressourcen und Fähigkeiten" value={resources} onChangeText={setResources} multiline />
          <PremiumInput label="Risiken und besondere Anforderungen" value={risks} onChangeText={setRisks} multiline />
          <PremiumInput label="Individuelle Pflegeziele *" value={goals} onChangeText={setGoals} multiline />
          <View style={styles.row}>
            <PremiumInput label="Gültig ab (JJJJ-MM-TT) *" value={validFrom} onChangeText={setValidFrom} />
            <PremiumInput label="Gültig bis (optional)" value={validUntil} onChangeText={setValidUntil} />
          </View>
        </SectionPanel>
        <SectionPanel title="3. Erste handlungsleitende Maßnahme" subtitle="Weitere Maßnahmen können in der Fortschreibung ergänzt werden">
          <PremiumInput label="Maßnahme *" value={measureTitle} onChangeText={setMeasureTitle} />
          <PremiumInput label="Persönliches Ziel" value={measureGoal} onChangeText={setMeasureGoal} multiline />
          <PremiumInput label="Konkrete Durchführung *" value={intervention} onChangeText={setIntervention} multiline />
          <PremiumInput label="Zeitpunkt / Häufigkeit *" value={frequency} onChangeText={setFrequency} />
          <PremiumInput label="Verantwortliche Qualifikation/Rolle" value={responsibleRole} onChangeText={setResponsibleRole} />
          <PremiumInput label="Warn- und Abbruchkriterien" value={warningSigns} onChangeText={setWarningSigns} multiline />
          <PremiumInput label="Eskalationsweg" value={escalationPath} onChangeText={setEscalationPath} multiline />
          <PremiumInput label="Evaluationskriterien" value={evaluationCriteria} onChangeText={setEvaluationCriteria} multiline />
          <PremiumInput label="Nächste Evaluation (JJJJ-MM-TT)" value={nextEvaluationAt} onChangeText={setNextEvaluationAt} />
        </SectionPanel>
        {error ? <ErrorState title="Pflegeplan nicht gespeichert" message={error} /> : null}
        <PremiumButton title="Live speichern und prüfen" fullWidth loading={busy} disabled={busy || !clientOptions.length} onPress={save} />
        <PremiumButton title="Abbrechen" variant="secondary" fullWidth onPress={() => router.back()} />
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});
