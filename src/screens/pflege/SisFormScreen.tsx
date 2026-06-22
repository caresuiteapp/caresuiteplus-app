import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { demoClients } from '@/data/demo/clients';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { usePermissions } from '@/hooks/usePermissions';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import {
  createSisFormAssessment,
  fetchSisFormDetail,
  removeSisRisk,
  saveSisFormAssessment,
  updateSisTopicField,
  upsertSisRisk,
} from '@/lib/pflege/sisFormService';
import { SIS_TOPIC_FIELDS, type SisFormDetail, type SisRiskEntry, type SisRiskLevel, type SisTopicKey } from '@/types/modules/sisForm';
import { colors, spacing, typography } from '@/theme';

const RISK_LEVELS: { key: SisRiskLevel; label: string }[] = [
  { key: 'kein_risiko', label: 'Kein Risiko' },
  { key: 'niedrig', label: 'Niedrig' },
  { key: 'mittel', label: 'Mittel' },
  { key: 'hoch', label: 'Hoch' },
  { key: 'akut', label: 'Akut' },
  { key: 'unbekannt', label: 'Unbekannt' },
];

const RISK_TYPES = [
  'Sturz',
  'Dekubitus',
  'Dehydration',
  'Mangelernährung',
  'Schmerz',
  'Infektion',
  'Medikationsrisiko',
  'Aspiration',
];

type SisFormScreenProps = {
  mode: 'create' | 'edit';
};

export function SisFormScreen({ mode }: SisFormScreenProps) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const tenantId = useServiceTenantId();
  const { isReadOnly, roleLabel } = usePermissions();

  const [form, setForm] = useState<SisFormDetail | null>(null);
  const [clientId, setClientId] = useState(demoClients[0]?.id ?? 'client-001');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const query = useAsyncQuery(
    () => {
      if (mode === 'create' || !id || !tenantId) {
        return Promise.resolve({ ok: true as const, data: null });
      }
      return fetchSisFormDetail(tenantId, id, profile?.roleKey);
    },
    [mode, id, tenantId, profile?.roleKey],
    { enabled: mode === 'edit' && !!id && !!tenantId },
  );

  useEffect(() => {
    if (query.data) setForm(query.data);
  }, [query.data]);

  async function handleCreateDraft() {
    if (!tenantId || isReadOnly || !clientId) return;
    const client = demoClients.find((c) => c.id === clientId);
    const clientName = client ? `${client.firstName} ${client.lastName}` : 'Unbekannt';
    setSaving(true);
    setActionError(null);
    const result = await createSisFormAssessment(
      tenantId,
      {
        clientId,
        clientName,
        assessorName: profile?.displayName ?? 'Pflegekraft Demo',
      },
      profile?.roleKey,
    );
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setForm(result.data);
    router.replace(`/pflege/sis/${result.data.id}` as never);
  }

  async function handleSave() {
    if (!tenantId || isReadOnly || !form) return;
    setSaving(true);
    setActionError(null);
    const result = await saveSisFormAssessment(tenantId, form, profile?.roleKey);
    setSaving(false);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setForm(result.data);
  }

  function updateTopic(topic: SisTopicKey, field: keyof SisFormDetail['topics'][SisTopicKey], value: string) {
    if (!form) return;
    setForm(updateSisTopicField(form, topic, field, value));
  }

  function addRisk() {
    if (!form) return;
    const risk: SisRiskEntry = {
      id: `risk-${Date.now()}`,
      riskType: RISK_TYPES[0]!,
      level: 'mittel',
      measureRef: '',
      notes: '',
    };
    setForm(upsertSisRisk(form, risk));
  }

  if (mode === 'edit' && query.loading) {
    return (
      <ScreenShell title="SIS" subtitle="Wird geladen…">
        <LoadingState message="SIS-Assessment wird geladen…" />
      </ScreenShell>
    );
  }

  if (mode === 'edit' && (query.error || (!form && !query.loading))) {
    return (
      <ScreenShell title="SIS" subtitle="Fehler">
        <ErrorState message={query.error ?? 'Assessment nicht gefunden.'} onRetry={query.refresh} />
      </ScreenShell>
    );
  }

  if (mode === 'create' && !form) {
    return (
      <ScreenShell title="SIS anlegen" subtitle={`6 Themenfelder · ${roleLabel ?? 'Demo'}`}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <InfoBanner
            variant="info"
            title="Strukturierte Informationserhebung"
            message="Sechs Themenfelder mit Ressourcen, Problemen, Wünschen, Gewohnheiten, Beobachtungen und Handlungsbedarf."
          />
          {actionError ? <InfoBanner variant="danger" title="Fehler" message={actionError} /> : null}
          <SectionPanel title="Klient:in">
            <Text style={styles.fieldLabel}>Klient:in</Text>
            <FilterChipGroup
              options={demoClients.slice(0, 8).map((c) => ({
                key: c.id,
                label: `${c.firstName} ${c.lastName}`,
              }))}
              value={clientId}
              onChange={setClientId}
            />
            <PremiumButton
              title={saving ? 'Anlegen…' : 'SIS-Entwurf anlegen'}
              disabled={isReadOnly || saving || !clientId}
              onPress={handleCreateDraft}
            />
          </SectionPanel>
        </ScrollView>
      </ScreenShell>
    );
  }

  if (!form) return null;

  return (
    <ScreenShell
      title={mode === 'create' ? 'SIS anlegen' : 'SIS bearbeiten'}
      subtitle={`${form.clientName} · Score ${form.overallScore} · ${roleLabel ?? 'Demo'}`}
      onBack={() => router.back()}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        {actionError ? <InfoBanner variant="danger" title="Speichern fehlgeschlagen" message={actionError} /> : null}

        {SIS_TOPIC_FIELDS.map((topic) => (
          <SectionPanel key={topic} title={topic} subtitle="Ressourcen · Probleme · Wünsche · Gewohnheiten · Beobachtungen · Handlungsbedarf">
            <PremiumInput label="Ressourcen" value={form.topics[topic].resources} onChangeText={(v) => updateTopic(topic, 'resources', v)} editable={!isReadOnly} />
            <PremiumInput label="Probleme" value={form.topics[topic].problems} onChangeText={(v) => updateTopic(topic, 'problems', v)} editable={!isReadOnly} />
            <PremiumInput label="Wünsche" value={form.topics[topic].wishes} onChangeText={(v) => updateTopic(topic, 'wishes', v)} editable={!isReadOnly} />
            <PremiumInput label="Gewohnheiten" value={form.topics[topic].habits} onChangeText={(v) => updateTopic(topic, 'habits', v)} editable={!isReadOnly} />
            <PremiumInput label="Beobachtungen" value={form.topics[topic].observations} onChangeText={(v) => updateTopic(topic, 'observations', v)} editable={!isReadOnly} />
            <PremiumInput label="Handlungsbedarf" value={form.topics[topic].actionNeeded} onChangeText={(v) => updateTopic(topic, 'actionNeeded', v)} editable={!isReadOnly} />
          </SectionPanel>
        ))}

        <SectionPanel title="Risikomatrix" subtitle="Risikoarten, Stufen und Maßnahmenbezug">
          {form.risks.length === 0 ? (
            <EmptyState title="Keine Risiken" message="Risiko hinzufügen für Sturz, Dekubitus, Medikation usw." />
          ) : (
            form.risks.map((risk) => (
              <View key={risk.id} style={styles.riskCard}>
                <Text style={styles.riskTitle}>{risk.riskType}</Text>
                <PremiumInput
                  label="Risikoart"
                  value={risk.riskType}
                  onChangeText={(v) => setForm(upsertSisRisk(form, { ...risk, riskType: v }))}
                  editable={!isReadOnly}
                />
                <View style={styles.levelRow}>
                  {RISK_LEVELS.map((level) => (
                    <PremiumButton
                      key={level.key}
                      title={level.label}
                      variant={risk.level === level.key ? 'primary' : 'secondary'}
                      onPress={() => setForm(upsertSisRisk(form, { ...risk, level: level.key }))}
                    />
                  ))}
                </View>
                <PremiumInput
                  label="Maßnahmenbezug"
                  value={risk.measureRef}
                  onChangeText={(v) => setForm(upsertSisRisk(form, { ...risk, measureRef: v }))}
                  editable={!isReadOnly}
                />
                <PremiumInput
                  label="Notizen"
                  value={risk.notes}
                  onChangeText={(v) => setForm(upsertSisRisk(form, { ...risk, notes: v }))}
                  editable={!isReadOnly}
                />
                {!isReadOnly ? (
                  <PremiumButton
                    title="Risiko entfernen"
                    variant="secondary"
                    onPress={() => setForm(removeSisRisk(form, risk.id))}
                  />
                ) : null}
              </View>
            ))
          )}
          {!isReadOnly ? <PremiumButton title="+ Risiko hinzufügen" variant="secondary" onPress={addRisk} /> : null}
        </SectionPanel>

        {!isReadOnly ? (
          <PremiumButton title={saving ? 'Speichern…' : 'SIS speichern'} loading={saving} onPress={handleSave} />
        ) : null}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: spacing.xxl, gap: spacing.sm },
  fieldLabel: { ...typography.label, color: colors.textMuted },
  riskCard: {
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 10,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  riskTitle: { ...typography.label },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
