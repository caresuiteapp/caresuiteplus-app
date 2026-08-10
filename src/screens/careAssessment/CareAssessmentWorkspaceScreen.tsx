import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenShell } from '@/components/layout';
import {
  EmptyState,
  ErrorState,
  FilterChipGroup,
  InfoBanner,
  LoadingState,
  PremiumBadge,
  PremiumButton,
  PremiumInput,
  SectionPanel,
} from '@/components/ui';
import { useAsyncQuery } from '@/hooks/core/useAsyncQuery';
import { useResidentList } from '@/hooks/useResidentList';
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { hasPermission } from '@/lib/permissions';
import {
  CARE_ASSESSMENT_TOPIC_LABELS,
  CARE_RISK_CATALOG,
  QPR_2026_CHECKS,
  addCareAssessmentEvaluation,
  calculateCareAssessmentCompleteness,
  createCareAssessment,
  fetchEligibleCareClients,
  fetchCareAssessment,
  getRiskLabel,
  saveCareAssessment,
  transitionCareAssessment,
} from '@/lib/careAssessment';
import type {
  CareAssessment,
  CareAssessmentMeasure,
  CareAssessmentRisk,
  CareAssessmentSubjectType,
  CareAssessmentTopicKey,
} from '@/types/modules/careAssessment';
import { colors, radius, spacing, typography } from '@/theme';

type Selectable = {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  careLevel?: string | null;
};
const sections = [
  { key: 'person', label: 'Person & Originalton', short: '01' },
  { key: 'topics', label: 'Sechs Themenfelder', short: '02' },
  { key: 'risks', label: 'Risikomatrix', short: '03' },
  { key: 'measures', label: 'Maßnahmenplanung', short: '04' },
  { key: 'quality', label: 'Prüfung & Freigabe', short: '05' },
  { key: 'evaluation', label: 'Evaluation', short: '06' },
  { key: 'history', label: 'Verlauf & Versionen', short: '07' },
] as const;
type Section = (typeof sections)[number]['key'];
const inDays = (days: number) => new Date(Date.now() + days * 86400000).toISOString();

function CreateClient() {
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const query = useAsyncQuery(
    () => tenantId
      ? fetchEligibleCareClients(tenantId, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Kein Mandant.' }),
    [tenantId, profile?.roleKey],
    { enabled: !!tenantId },
  );
  return <CreateForm subjectType="client" items={query.data ?? []} loading={query.loading} error={query.error} />;
}
function CreateResident() {
  const list = useResidentList();
  return <CreateForm subjectType="resident" items={list.allItems} loading={list.loading} error={list.error} />;
}

function CreateForm({ subjectType, items, loading, error }: {
  subjectType: CareAssessmentSubjectType;
  items: Selectable[];
  loading: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const [subjectId, setSubjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const resident = subjectType === 'resident';
  const base = resident ? '/stationaer/assessment' : '/pflege/sis';
  const canManage = hasPermission(profile?.roleKey, resident ? 'stationaer.assessments.manage' : 'pflege.assessments.manage');
  useEffect(() => { if (!subjectId && items[0]) setSubjectId(items[0].id); }, [items, subjectId]);
  async function create() {
    if (!tenantId || !subjectId) return;
    const selected = items.find((item) => item.id === subjectId);
    if (!selected) return;
    setSaving(true);
    const result = await createCareAssessment(tenantId, {
      subjectType,
      subjectId,
      subjectName: `${selected.firstName} ${selected.lastName}`,
      variant: resident ? 'stationaer' : 'ambulant',
      reason: 'initial',
      assessorName: profile?.displayName ?? '',
    }, profile?.roleKey);
    setSaving(false);
    if (!result.ok) return setActionError(result.error);
    router.replace(`${base}/${result.data.id}` as never);
  }
  return (
    <ScreenShell title={resident ? 'Stationäres Assessment starten' : 'SIS / Assessment starten'} subtitle="Personenzentrierter Pflegeprozess">
      {loading ? <LoadingState message="Personen werden geladen…" /> : null}
      {error ? <ErrorState message={error} /> : null}
      {actionError ? <ErrorState message={actionError} /> : null}
      {!loading && !items.length ? (
        <EmptyState
          title={resident ? 'Keine aktive Bewohnerin oder kein aktiver Bewohner' : 'Kein aktiver Pflegefall'}
          message={resident
            ? 'Vorher muss eine Person im stationären Fachbereich aufgenommen werden.'
            : 'Die SIS zeigt ausschließlich Personen mit aktiver Pflege-Zuordnung. Assist-Klient:innen werden nicht übernommen.'}
        />
      ) : (
        <SectionPanel title={resident ? 'Bewohner:in' : 'Klient:in'}>
          <InfoBanner
            variant="info"
            title={resident ? 'Stationärer Aufnahmebestand' : 'Eigenständiger Pflege-Klientenstamm'}
            message={resident
              ? 'Es werden ausschließlich aktive Bewohner:innen angeboten.'
              : 'Es werden ausschließlich ausdrücklich in Pflege aufgenommene Personen angeboten. Keine Assist-Übernahme.'}
          />
          <FilterChipGroup
            wrap
            options={items.map((item) => ({
              key: item.id,
              label: `${item.lastName}, ${item.firstName}${item.careLevel ? ` · ${item.careLevel}` : ''}`,
            }))}
            value={subjectId}
            onChange={setSubjectId}
          />
          <PremiumInput label="Verantwortliche Pflegefachperson" value={profile?.displayName ?? ''} editable={false} />
          <PremiumButton title="Pflegeprozess starten" disabled={!subjectId || !canManage || saving} loading={saving} onPress={create} />
        </SectionPanel>
      )}
    </ScreenShell>
  );
}

export function CareAssessmentWorkspaceScreen({ subjectType, mode }: {
  subjectType: CareAssessmentSubjectType;
  mode: 'create' | 'workspace';
}) {
  if (mode === 'create') return subjectType === 'resident' ? <CreateResident /> : <CreateClient />;
  return <Workspace subjectType={subjectType} />;
}

function Workspace({ subjectType }: { subjectType: CareAssessmentSubjectType }) {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const tenantId = useServiceTenantId();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [value, setValue] = useState<CareAssessment | null>(null);
  const [section, setSection] = useState<Section>('person');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [evaluationOutcome, setEvaluationOutcome] = useState<'effective' | 'partly_effective' | 'not_effective' | 'deteriorated' | 'not_assessable'>('effective');
  const [observedEffect, setObservedEffect] = useState('');
  const [personFeedback, setPersonFeedback] = useState('');
  const [professionalConclusion, setProfessionalConclusion] = useState('');
  const [changesRequired, setChangesRequired] = useState('');
  const resident = subjectType === 'resident';
  const compact = width < 1060;
  const canManage = hasPermission(profile?.roleKey, resident ? 'stationaer.assessments.manage' : 'pflege.assessments.manage');
  const query = useAsyncQuery(
    () => tenantId && id
      ? fetchCareAssessment(tenantId, id, subjectType, profile?.roleKey)
      : Promise.resolve({ ok: false as const, error: 'Assessment-ID fehlt.' }),
    [tenantId, id, subjectType, profile?.roleKey],
    { enabled: !!tenantId && !!id },
  );
  useEffect(() => { if (query.data) setValue(query.data); }, [query.data]);
  const completeness = useMemo(() => value ? calculateCareAssessmentCompleteness(value) : null, [value]);
  const locked = !canManage || ['approved', 'superseded', 'archived'].includes(value?.status ?? '');
  const evaluationLocked = !canManage || ['superseded', 'archived'].includes(value?.status ?? '');
  const patch = (next: Partial<CareAssessment>) => setValue((current) => current ? ({ ...current, ...next }) : current);
  const patchTopic = (key: CareAssessmentTopicKey, field: string, next: string) => setValue((current) => current ? ({
    ...current,
    topics: current.topics.map((item) => item.topicKey === key ? ({ ...item, [field]: next }) : item),
  }) : current);
  const patchRisk = (index: number, next: Partial<CareAssessmentRisk>) => setValue((current) => current ? ({
    ...current,
    risks: current.risks.map((item, i) => i === index ? ({ ...item, ...next }) : item),
  }) : current);
  const patchMeasure = (index: number, next: Partial<CareAssessmentMeasure>) => setValue((current) => current ? ({
    ...current,
    measures: current.measures.map((item, i) => i === index ? ({ ...item, ...next }) : item),
  }) : current);
  function addRisk() {
    if (!value) return;
    const item = CARE_RISK_CATALOG.find((candidate) => !value.risks.some((risk) => risk.riskKey === candidate.key)) ?? CARE_RISK_CATALOG[0];
    patch({ risks: [...value.risks, {
      riskKey: item.key, state: 'unclear', urgency: 'timely', evidence: '', protectiveFactors: '',
      professionalRationale: '', counselingProvided: '', personDecision: '', refusalDocumented: false,
      focusedAssessmentKey: item.focusedAssessment, focusedAssessmentResult: {}, linkedBodyMapMarkerIds: [],
      nextReviewAt: inDays(30),
    }] });
  }
  function addMeasure() {
    if (!value) return;
    const risk = value.risks.find((item) => item.state === 'present' || item.state === 'unclear');
    patch({ measures: [...value.measures, {
      title: risk ? `Maßnahme: ${getRiskLabel(risk.riskKey)}` : 'Neue Pflegemaßnahme',
      relatedTopicKey: null, relatedRiskKey: risk?.riskKey ?? null, personalGoal: '', intervention: '',
      timing: '', frequency: '', responsibleRole: 'Pflegefachperson', personContribution: '',
      relativesContribution: '', warningSigns: '', escalationPath: '', evaluationCriteria: '',
      nextEvaluationAt: inDays(30), status: 'planned',
    }] });
  }
  async function save(nextStatus?: 'professional_review' | 'approved') {
    if (!value || !tenantId || locked) return;
    setBusy(true); setMessage(null);
    const saved = await saveCareAssessment(tenantId, value, profile?.roleKey);
    if (!saved.ok) { setBusy(false); return setMessage(saved.error); }
    if (!nextStatus) { setBusy(false); setValue(saved.data); return setMessage('Zwischenstand gespeichert.'); }
    const transitioned = await transitionCareAssessment(tenantId, saved.data, nextStatus, profile?.displayName ?? '', profile?.roleKey);
    setBusy(false);
    if (!transitioned.ok) return setMessage(transitioned.error);
    setValue(transitioned.data);
    setMessage(nextStatus === 'approved' ? 'Fachlich freigegeben und versioniert.' : 'Zur fachlichen Prüfung übergeben.');
  }
  async function addEvaluation() {
    if (!value || !tenantId || evaluationLocked || !professionalConclusion.trim()) return;
    setBusy(true); setMessage(null);
    const result = await addCareAssessmentEvaluation(tenantId, value, {
      outcome: evaluationOutcome,
      observedEffect,
      personFeedback,
      professionalConclusion,
      changesRequired,
      evaluatedAt: new Date().toISOString(),
      evaluatorName: profile?.displayName ?? '',
    }, profile?.roleKey);
    setBusy(false);
    if (!result.ok) return setMessage(result.error);
    setValue(result.data);
    setObservedEffect(''); setPersonFeedback(''); setProfessionalConclusion(''); setChangesRequired('');
    setMessage('Evaluation revisionssicher gespeichert.');
  }
  if (query.loading && !value) return <ScreenShell title="SIS & Assessment"><LoadingState message="Pflegeprozess wird geladen…" /></ScreenShell>;
  if (query.error && !value) return <ScreenShell title="SIS & Assessment"><ErrorState message={query.error} onRetry={query.refresh} /></ScreenShell>;
  if (!value || !completeness) return null;
  const bodyMap = resident ? `/stationaer/bewohner/${value.subjectId}/bodymap` : `/pflege/bodymap?clientId=${value.subjectId}`;
  const topicLabel = (key: CareAssessmentTopicKey) => {
    if (key === 'living_environment') return resident ? 'Wohnen und Häuslichkeit' : 'Haushaltsführung';
    return CARE_ASSESSMENT_TOPIC_LABELS[key];
  };
  return (
    <ScreenShell
      title={`${value.subjectName} · SIS & Assessment`}
      subtitle={`Version ${value.version} · ${completeness.percent} % vollständig`}
      rightSlot={<PremiumBadge label={value.status} variant={value.status === 'approved' ? 'green' : 'cyan'} />}
    >
      {value.reassessmentRequired ? <InfoBanner variant="danger" title="Neubewertung erforderlich" message={value.destabilizationSummary || 'Relevantes Ereignis vorhanden.'} /> : null}
      {locked ? <InfoBanner variant="info" title="Unveränderbare Version" message="Änderungen erfolgen ausschließlich über eine neue Fortschreibung." /> : null}
      {message ? <InfoBanner variant={message.includes('gespeichert') || message.includes('freigegeben') ? 'success' : 'warning'} title="Status" message={message} /> : null}

      <View style={styles.focusHero}>
        <View style={styles.focusHeroCopy}>
          <Text style={styles.eyebrow}>{resident ? 'STATIONÄRE SIS®' : 'AMBULANTE SIS®'}</Text>
          <Text style={styles.focusTitle}>{value.subjectName}</Text>
          <Text style={styles.focusMeta}>
            Version {value.version} · {value.assessorName || 'Pflegefachperson offen'} · {completeness.percent} % fachlich vorbereitet
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${completeness.percent}%` }]} />
        </View>
        <View style={styles.focusMetrics}>
          <View style={styles.metric}><Text style={styles.metricValue}>{value.risks.filter((risk) => risk.state === 'present').length}</Text><Text style={styles.metricLabel}>aktive Risiken</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{value.measures.filter((measure) => ['planned', 'active'].includes(measure.status)).length}</Text><Text style={styles.metricLabel}>Maßnahmen</Text></View>
          <View style={styles.metric}><Text style={styles.metricValue}>{completeness.blocking.length}</Text><Text style={styles.metricLabel}>Freigabesperren</Text></View>
        </View>
      </View>

      <View style={[styles.workspaceGrid, compact && styles.workspaceGridCompact]}>
        <ScrollView
          horizontal={compact}
          showsHorizontalScrollIndicator={false}
          style={[styles.sectionRail, compact && styles.sectionRailCompact]}
          contentContainerStyle={compact ? styles.sectionRailContentCompact : undefined}
        >
          {sections.map((item) => (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected: section === item.key }}
              onPress={() => setSection(item.key)}
              style={[styles.navItem, section === item.key && styles.navItemActive]}
            >
              <Text style={[styles.navNumber, section === item.key && styles.navNumberActive]}>{item.short}</Text>
              <Text style={[styles.navLabel, section === item.key && styles.navLabelActive]}>{item.label}</Text>
            </Pressable>
          ))}
          {!compact ? (
            <View style={styles.legalNote}>
              <Text style={styles.legalNoteTitle}>Fachbereich Pflege</Text>
              <Text style={styles.legalNoteText}>Eigenständiger Pflegefall · keine Assist-Übernahme · Pflegefachfreigabe erforderlich.</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.documentCanvas}>

      {section === 'person' ? (
        <SectionPanel title="Was bewegt Sie im Augenblick?" subtitle="Originalton getrennt von der Fachperspektive">
          <FilterChipGroup
            wrap
            options={[
              { key: 'person', label: 'Person selbst' }, { key: 'relative', label: 'An-/Zugehörige' },
              { key: 'representative', label: 'Vertretung' }, { key: 'professional', label: 'Fachperson' },
              { key: 'not_possible', label: 'Aussage nicht möglich' },
            ]}
            value={value.statementSource}
            onChange={(next) => { if (!locked) patch({ statementSource: next }); }}
          />
          <PremiumInput label="Originalton / geäußerte Sichtweise" value={value.personStatement} onChangeText={(next) => patch({ personStatement: next })} multiline editable={!locked} />
          <PremiumInput label="Quelle beziehungsweise Name" value={value.statementSourceName} onChangeText={(next) => patch({ statementSourceName: next })} editable={!locked} />
          <PremiumInput label="Gesprächsbeteiligte" value={value.conversationParticipants.join(', ')} onChangeText={(next) => patch({ conversationParticipants: next.split(',').map((item) => item.trim()).filter(Boolean) })} editable={!locked} />
          <PremiumInput label="Kommunikationsunterstützung" value={value.communicationSupport} onChangeText={(next) => patch({ communicationSupport: next })} multiline editable={!locked} />
          <PremiumInput label="Informationsquellen und offene Rückfragen" value={value.informationSourceSummary} onChangeText={(next) => patch({ informationSourceSummary: next })} multiline editable={!locked} />
        </SectionPanel>
      ) : null}

      {section === 'topics' ? value.topics.map((item, index) => (
        <SectionPanel key={item.topicKey} title={`${index + 1}. ${topicLabel(item.topicKey)}`}>
          <PremiumInput label="Perspektive der Person" value={item.personPerspective} onChangeText={(next) => patchTopic(item.topicKey, 'personPerspective', next)} multiline editable={!locked} />
          <PremiumInput label="Ressourcen und Fähigkeiten" value={item.resources} onChangeText={(next) => patchTopic(item.topicKey, 'resources', next)} multiline editable={!locked} />
          <PremiumInput label="Beeinträchtigungen und Belastungen" value={item.impairments} onChangeText={(next) => patchTopic(item.topicKey, 'impairments', next)} multiline editable={!locked} />
          <PremiumInput label="Wünsche, Ziele und Prioritäten" value={item.wishes} onChangeText={(next) => patchTopic(item.topicKey, 'wishes', next)} multiline editable={!locked} />
          <PremiumInput label="Gewohnheiten und Biografie" value={item.habitsBiography} onChangeText={(next) => patchTopic(item.topicKey, 'habitsBiography', next)} multiline editable={!locked} />
          <PremiumInput label="Pflegefachliche Einschätzung" value={item.professionalAssessment} onChangeText={(next) => patchTopic(item.topicKey, 'professionalAssessment', next)} multiline editable={!locked} />
          <PremiumInput label="Handlungs- oder Assessmentbedarf" value={item.actionNeeded} onChangeText={(next) => patchTopic(item.topicKey, 'actionNeeded', next)} multiline editable={!locked} />
        </SectionPanel>
      )) : null}

      {section === 'risks' ? (
        <SectionPanel title="Dynamische Risikomatrix">
          <View style={styles.actions}>
            <PremiumButton title="+ Risiko / Phänomen" disabled={locked} onPress={addRisk} />
            <PremiumButton title="3D-BodyMap öffnen" variant="secondary" onPress={() => router.push(bodyMap as never)} />
          </View>
          {value.risks.map((item, index) => (
            <View key={`${item.riskKey}-${index}`} style={styles.card}>
              <Text style={styles.title}>{getRiskLabel(item.riskKey)}</Text>
              <FilterChipGroup wrap options={[
                { key: 'none', label: 'Kein Risiko' }, { key: 'unclear', label: 'Unklar' },
                { key: 'present', label: 'Vorhanden' }, { key: 'controlled', label: 'Kontrolliert' },
              ]} value={item.state} onChange={(next) => { if (!locked) patchRisk(index, { state: next }); }} />
              <Text style={styles.fieldCaption}>Dringlichkeit</Text>
              <FilterChipGroup wrap options={[
                { key: 'routine', label: 'Regulär' }, { key: 'timely', label: 'Zeitnah' },
                { key: 'urgent', label: 'Dringend' }, { key: 'immediate', label: 'Sofort' },
              ]} value={item.urgency} onChange={(next) => { if (!locked) patchRisk(index, { urgency: next }); }} />
              <PremiumInput label="Beobachtungen / Hinweise" value={item.evidence} onChangeText={(next) => patchRisk(index, { evidence: next })} multiline editable={!locked} />
              <PremiumInput label="Schutzfaktoren und Ressourcen" value={item.protectiveFactors} onChangeText={(next) => patchRisk(index, { protectiveFactors: next })} multiline editable={!locked} />
              <PremiumInput label="Pflegefachliche Begründung" value={item.professionalRationale} onChangeText={(next) => patchRisk(index, { professionalRationale: next })} multiline editable={!locked} />
              <PremiumInput label="Aufklärung und Beratung" value={item.counselingProvided} onChangeText={(next) => patchRisk(index, { counselingProvided: next })} multiline editable={!locked} />
              <PremiumInput label="Entscheidung der Person" value={item.personDecision} onChangeText={(next) => patchRisk(index, { personDecision: next })} multiline editable={!locked} />
              <PremiumInput label="Nächste fachliche Prüfung (ISO-Datum)" value={item.nextReviewAt ?? ''} onChangeText={(next) => patchRisk(index, { nextReviewAt: next || null })} editable={!locked} />
              {!locked ? <PremiumButton title="Risiko entfernen" variant="ghost" onPress={() => patch({ risks: value.risks.filter((_, i) => i !== index) })} /> : null}
            </View>
          ))}
        </SectionPanel>
      ) : null}

      {section === 'measures' ? (
        <SectionPanel title="Individuelle Maßnahmenplanung">
          <PremiumButton title="+ Maßnahme" disabled={locked} onPress={addMeasure} />
          {value.measures.map((item, index) => (
            <View key={`${item.title}-${index}`} style={styles.card}>
              <PremiumInput label="Bezeichnung" value={item.title} onChangeText={(next) => patchMeasure(index, { title: next })} editable={!locked} />
              <PremiumInput label="Persönliches Ziel" value={item.personalGoal} onChangeText={(next) => patchMeasure(index, { personalGoal: next })} multiline editable={!locked} />
              <PremiumInput label="Konkrete Durchführung" value={item.intervention} onChangeText={(next) => patchMeasure(index, { intervention: next })} multiline editable={!locked} />
              <PremiumInput label="Zeitpunkt / Situation" value={item.timing} onChangeText={(next) => patchMeasure(index, { timing: next })} editable={!locked} />
              <PremiumInput label="Häufigkeit" value={item.frequency} onChangeText={(next) => patchMeasure(index, { frequency: next })} editable={!locked} />
              <PremiumInput label="Verantwortliche Rolle" value={item.responsibleRole} onChangeText={(next) => patchMeasure(index, { responsibleRole: next })} editable={!locked} />
              <PremiumInput label="Mitwirkung der Person" value={item.personContribution} onChangeText={(next) => patchMeasure(index, { personContribution: next })} multiline editable={!locked} />
              <PremiumInput label="Mitwirkung von An- und Zugehörigen" value={item.relativesContribution} onChangeText={(next) => patchMeasure(index, { relativesContribution: next })} multiline editable={!locked} />
              <PremiumInput label="Warn- und Abbruchkriterien" value={item.warningSigns} onChangeText={(next) => patchMeasure(index, { warningSigns: next })} multiline editable={!locked} />
              <PremiumInput label="Eskalationsweg" value={item.escalationPath} onChangeText={(next) => patchMeasure(index, { escalationPath: next })} multiline editable={!locked} />
              <PremiumInput label="Woran erkennen wir Wirkung?" value={item.evaluationCriteria} onChangeText={(next) => patchMeasure(index, { evaluationCriteria: next })} multiline editable={!locked} />
              <PremiumInput label="Nächste Evaluation (ISO-Datum)" value={item.nextEvaluationAt ?? ''} onChangeText={(next) => patchMeasure(index, { nextEvaluationAt: next || null })} editable={!locked} />
              {!locked ? <PremiumButton title="Maßnahme entfernen" variant="ghost" onPress={() => patch({ measures: value.measures.filter((_, i) => i !== index) })} /> : null}
            </View>
          ))}
        </SectionPanel>
      ) : null}

      {section === 'quality' ? (
        <>
          <SectionPanel title="Pflegefachliche Gesamteinschätzung">
            <PremiumInput label="Gesamtsituation, Ressourcen, Risiken und Prioritäten" value={value.professionalSummary} onChangeText={(next) => patch({ professionalSummary: next })} multiline editable={!locked} />
            <PremiumInput label="Veränderung seit der letzten Version" value={value.changeSummary} onChangeText={(next) => patch({ changeSummary: next })} multiline editable={!locked} />
            <PremiumInput label="Nächster Prüftermin (ISO-Datum)" value={value.nextReviewAt ?? ''} onChangeText={(next) => patch({ nextReviewAt: next || null })} editable={!locked} />
          </SectionPanel>
          <SectionPanel title="QPR-2026-Prüflinse" subtitle={`${completeness.percent} % fachlich vorbereitet`}>
            {QPR_2026_CHECKS.map((check) => <Text key={check} style={styles.check}>• {check}</Text>)}
            {completeness.blocking.map((item) => <InfoBanner key={item} variant="danger" title="Freigabesperre" message={item} />)}
            {completeness.warnings.map((item) => <InfoBanner key={item} variant="warning" title="Prüfhinweis" message={item} />)}
          </SectionPanel>
          <View style={styles.actions}>
            <PremiumButton title="Entwurf speichern" disabled={locked || busy} loading={busy} onPress={() => save()} />
            {value.status === 'professional_review' ? (
              <PremiumButton title="Fachlich freigeben" disabled={locked || busy || !completeness.canApprove} onPress={() => save('approved')} />
            ) : (
              <PremiumButton title="Zur fachlichen Prüfung" variant="secondary" disabled={locked || busy || !completeness.canSubmitForReview} onPress={() => save('professional_review')} />
            )}
          </View>
        </>
      ) : null}

      {section === 'evaluation' ? (
        <>
          <SectionPanel title="Individuelle Evaluation" subtitle="Wirkung anhand der Ausgangssituation und der geplanten Maßnahmen bewerten">
            <Text style={styles.fieldCaption}>Ergebnis</Text>
            <FilterChipGroup wrap options={[
              { key: 'effective', label: 'Wirksam' },
              { key: 'partly_effective', label: 'Teilweise wirksam' },
              { key: 'not_effective', label: 'Nicht wirksam' },
              { key: 'deteriorated', label: 'Verschlechtert' },
              { key: 'not_assessable', label: 'Nicht beurteilbar' },
            ]} value={evaluationOutcome} onChange={setEvaluationOutcome} />
            <PremiumInput label="Beobachtete Wirkung" value={observedEffect} onChangeText={setObservedEffect} multiline editable={!evaluationLocked} />
            <PremiumInput label="Rückmeldung der Person" value={personFeedback} onChangeText={setPersonFeedback} multiline editable={!evaluationLocked} />
            <PremiumInput label="Pflegefachliche Schlussfolgerung" value={professionalConclusion} onChangeText={setProfessionalConclusion} multiline editable={!evaluationLocked} />
            <PremiumInput label="Erforderliche Anpassungen" value={changesRequired} onChangeText={setChangesRequired} multiline editable={!evaluationLocked} />
            <PremiumButton title="Evaluation dokumentieren" disabled={evaluationLocked || busy || !professionalConclusion.trim()} loading={busy} onPress={addEvaluation} />
          </SectionPanel>
          <SectionPanel title="Bisherige Evaluationen" subtitle={`${value.evaluations.length} Eintrag/Einträge`}>
            {!value.evaluations.length ? <EmptyState title="Noch keine Evaluation" message="Evaluationen werden individuell und anlassbezogen dokumentiert." /> : value.evaluations.map((entry, index) => (
              <View key={entry.id || `${entry.evaluatedAt}-${index}`} style={styles.card}>
                <Text style={styles.title}>{entry.professionalConclusion}</Text>
                <Text style={styles.historyMeta}>{new Date(entry.evaluatedAt).toLocaleString('de-DE')} · {entry.evaluatorName || 'Pflegefachperson'}</Text>
                {entry.observedEffect ? <Text style={styles.historyText}>{entry.observedEffect}</Text> : null}
                {entry.changesRequired ? <InfoBanner variant="warning" title="Anpassung erforderlich" message={entry.changesRequired} /> : null}
              </View>
            ))}
          </SectionPanel>
        </>
      ) : null}

      {section === 'history' ? (
        <>
          <SectionPanel title="Versionsverlauf" subtitle="Freigaben und Statusübergänge bleiben unveränderbar nachvollziehbar">
            {!value.versionHistory.length ? <EmptyState title="Noch keine freigegebene Version" message="Beim Übergang zur fachlichen Prüfung und bei der Freigabe entsteht ein Snapshot." /> : value.versionHistory.map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyDot} />
                <View style={styles.historyCopy}>
                  <Text style={styles.historyTitle}>Version {entry.version} · {entry.transitionTo}</Text>
                  <Text style={styles.historyMeta}>{new Date(entry.createdAt).toLocaleString('de-DE')} · {entry.actorName || 'System'}</Text>
                </View>
              </View>
            ))}
          </SectionPanel>
          <SectionPanel title="Fachereignisse" subtitle="Anlassbezogene Veränderungen und Verknüpfungen">
            {!value.events.length ? <EmptyState title="Keine offenen Fachereignisse" message="Relevante Ereignisse erscheinen hier und können eine Fortschreibung auslösen." /> : value.events.map((entry, index) => (
              <Text key={String(entry.id ?? index)} style={styles.historyText}>• {String(entry.summary ?? entry.event_type ?? 'Fachereignis')}</Text>
            ))}
          </SectionPanel>
        </>
      ) : null}
      {!locked && section !== 'quality' ? <PremiumButton title="Zwischenstand speichern" loading={busy} onPress={() => save()} /> : null}
        </View>
      </View>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  card: {
    borderWidth: 1, borderColor: colors.borderSoft, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.sm, backgroundColor: 'rgba(255,255,255,0.88)',
  },
  title: { ...typography.h3 },
  check: { ...typography.body, color: colors.textMuted },
  focusHero: {
    borderWidth: 1,
    borderColor: 'rgba(69,160,255,0.38)',
    borderRadius: 26,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.94)',
    shadowColor: '#168BFF',
    shadowOpacity: 0.22,
    shadowRadius: 28,
  },
  focusHeroCopy: { gap: 4 },
  eyebrow: { ...typography.caption, color: colors.cyan, letterSpacing: 1.2 },
  focusTitle: { ...typography.h1, color: colors.textPrimary },
  focusMeta: { ...typography.body, color: colors.textSecondary },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: 'rgba(151,188,235,0.16)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999, backgroundColor: colors.cyan },
  focusMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metric: { minWidth: 132, padding: spacing.sm, borderRadius: 16, backgroundColor: 'rgba(22,131,255,0.08)' },
  metricValue: { ...typography.h2, color: colors.textPrimary },
  metricLabel: { ...typography.caption, color: colors.textMuted },
  workspaceGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  workspaceGridCompact: { flexDirection: 'column' },
  sectionRail: {
    width: 250,
    borderWidth: 1,
    borderColor: colors.borderSoft,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: spacing.sm,
  },
  sectionRailCompact: { width: '100%', padding: spacing.xs },
  sectionRailContentCompact: { flexDirection: 'row', gap: spacing.xs },
  navItem: { minHeight: 58, minWidth: 190, borderRadius: 16, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  navItemActive: { backgroundColor: 'rgba(13,119,255,0.2)', borderWidth: 1, borderColor: 'rgba(68,166,255,0.55)' },
  navNumber: { ...typography.caption, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  navNumberActive: { color: colors.cyan },
  navLabel: { ...typography.label, color: colors.textSecondary, flexShrink: 1 },
  navLabelActive: { color: colors.textPrimary },
  legalNote: { marginTop: spacing.md, padding: spacing.sm, borderRadius: 16, backgroundColor: 'rgba(28,75,118,0.26)' },
  legalNoteTitle: { ...typography.label, color: colors.cyan },
  legalNoteText: { ...typography.caption, color: colors.textSecondary, marginTop: 4 },
  documentCanvas: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(130,177,226,0.22)',
    borderRadius: 26,
    padding: spacing.md,
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  fieldCaption: { ...typography.caption, color: colors.textMuted },
  historyRow: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  historyDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: colors.cyan },
  historyCopy: { flex: 1, gap: 3 },
  historyTitle: { ...typography.label },
  historyMeta: { ...typography.caption, color: colors.textMuted },
  historyText: { ...typography.body, color: colors.textSecondary },
});
