// Generated native presentation from src/screens/careAssessment/PlanReviewOverview.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { colors, spacing, typography } from '@/theme';
import { ErrorState, FilterChipGroup, InfoBanner, PremiumButton, PremiumInput, SectionPanel } from '@/components/ui';
import type { EvaluationRecord } from '@/lib/careAssessment/planEvaluationDomain';
import { captureCurrentPlanReview } from "../../lib/careAssessment/currentPlanReviewDomain.native.ts";
import { selectPlanReviewControls, emptyPlanReviewControlsFilter, type PlanReviewControlsFilter } from '@/lib/careAssessment/planReviewControlsFilter';
import type { ControlRecord } from '@/lib/pflege/clinicalControlGateway';
import type { ControlSource } from '@/lib/pflege/clinicalControlDomain';
import { clinicalControlSourceReadProjection, clinicalControlSourceReadSignature, type ClinicalControlReadPermissions } from "../../lib/pflege/clinicalControlSourceRead.native.ts";
import { sameWoundJson, woundUuid } from '@/lib/pflege/woundCareDomain';
import { planReviewControlSources, selectPlanReviewControlSources, type PlanReviewControlSourceFilter } from '@/lib/careAssessment/planReviewControlSources';
import { PlanReviewControlSources } from "./PlanReviewControlSources.native.tsx";
import { PlanReviewControlList } from "./PlanReviewControlList.native.tsx";
import { planReviewDueLabels, planReviewEvidenceLabels } from '@/lib/careAssessment/planReviewOverview';
import { planReviewControls } from '@/lib/careAssessment/planReviewControls';
import { exportPlanReviewControls } from "../../lib/careAssessment/planReviewControlsExport.native.ts";
import { evaluationNames } from '@/lib/careAssessment/planEvaluationLabels';
import type { CareAssessment } from '@/types/modules/careAssessment';
const body = { ...typography.body, color: colors.textSecondary };
const dueOptions = [{ key: 'all', label: 'Alle Plantermine' }, { key: 'reached', label: 'Erreicht/überschritten' }, { key: 'unscheduled', label: 'Ohne Plantermin' }, { key: 'scheduled', label: 'Zukünftig' }, { key: 'inactive', label: 'Nicht aktiv/geplant' }];
const evidenceOptions = [{ key: 'all', label: 'Alle Befundbezüge' }, { key: 'matched', label: 'Passender Einzelbefund' }, { key: 'needs_comparison', label: 'Abgleich erforderlich' }];
const sourceOptions = [{ key: 'all', label: 'Alle aktuellen Quellenbezüge' }, { key: 'identical', label: 'Ohne festgestellte Quellenabweichung' }, { key: 'changed', label: 'Aktuelle Quellenfassung abweichend' }, { key: 'unavailable', label: 'Originalquelle aktuell nicht enthalten' }, { key: 'needs_comparison', label: 'Aktuellen Quellenbezug abgleichen' }];
const controlOptions = [{ key: 'all', label: 'Alle Auftragsbezüge' }, { key: 'open', label: 'Offener Auftrag' }, { key: 'due', label: 'Auftragsfrist erreicht' }, { key: 'completed', label: 'Prüfauftrag durchgeführt' }, { key: 'needs_comparison', label: 'Auftragsbeleg abgleichen' }, { key: 'follow_up_open', label: 'Bestehender Folgeauftrag aktuell offen' }, { key: 'follow_up_unavailable', label: 'Benannter Folgeauftrag nicht verfügbar' }, { key: 'none', label: 'Ohne zugeordneten Auftrag' }];
export function PlanReviewOverview({ readOwner, readAllowed, sourcePermissions, assessment, records, controls, sources, sourcesBlocked, sourcesError, onRequestSources, onSourcesReload, blocked, evaluationBlocked, onEvaluate, onReload }: {
    readOwner: string;
    readAllowed: boolean;
    sourcePermissions: ClinicalControlReadPermissions;
    assessment: CareAssessment;
    records: EvaluationRecord[] | null;
    controls: ControlRecord[] | null;
    sources: ControlSource[] | null;
    sourcesBlocked: boolean;
    sourcesError: string;
    onRequestSources: () => void;
    onSourcesReload: () => Promise<void>;
    blocked: boolean;
    evaluationBlocked: boolean;
    onEvaluate: (id: string) => void;
    onReload: () => Promise<void>;
}) {
    const [owner] = useState(() => ({ context: readOwner, tenantId: assessment.tenantId, assessmentId: assessment.id, clientId: assessment.subjectId, subjectType: assessment.subjectType })), alive = useRef(true);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const owned = readOwner === owner.context && assessment.tenantId === owner.tenantId && assessment.id === owner.assessmentId && assessment.subjectId === owner.clientId && assessment.subjectType === owner.subjectType && owner.subjectType === 'client' && [owner.tenantId, owner.assessmentId, owner.clientId].every(woundUuid), sourceSignature = clinicalControlSourceReadSignature(sourcePermissions);
    const [exportError, setExportError] = useState('');
    const [exportScope, setExportScope] = useState<'originals' | 'with_sources'>('originals');
    const [sourceRequested, setSourceRequested] = useState(false), [sourceFilter, setSourceFilter] = useState<PlanReviewControlSourceFilter>('all');
    const sourceWanted = sourceRequested || exportScope === 'with_sources';
    const [filter, setFilter] = useState(emptyPlanReviewControlsFilter), [count, setCount] = useState(10), [checkedAt, setCheckedAt] = useState(() => Date.now()), [busy, setBusy] = useState(false), [reloadError, setReloadError] = useState('');
    useEffect(() => { setCheckedAt(Date.now()); }, [records, controls, assessment.updatedAt]);
    const comparisonClock = useMemo(() => Date.now(), [records, controls, sources, assessment.updatedAt, checkedAt, sourceSignature, readOwner]);
    const complete = useMemo(() => { if (!owned || !readAllowed || blocked || busy || !records || !controls)
        return { data: null, error: '' }; try {
        if (!clinicalControlSourceReadProjection({ tenantId: assessment.tenantId, clientId: assessment.subjectId, records: controls, sources: null, permissions: sourcePermissions, now: comparisonClock }).canReadOriginals)
            throw Error('Leserechte für sämtliche Kontrolloriginale und Folgeauftragshistorien erforderlich.');
        const plan = captureCurrentPlanReview(assessment, comparisonClock);
        return { data: planReviewControls(plan, records, controls, assessment.tenantId, assessment.id, assessment.subjectId, comparisonClock), error: '' };
    }
    catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'Aktuellen Maßnahmenstand zuerst vollständig speichern und laden.' };
    } }, [owned, readAllowed, blocked, busy, records, controls, assessment, comparisonClock, sourceSignature]);
    const view = useMemo(() => { if (!complete.data)
        return { data: null, error: complete.error }; try {
        return { data: selectPlanReviewControls(complete.data, filter), error: '' };
    }
    catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'Prüfübersichtsfilter nicht anwendbar.' };
    } }, [complete, filter]);
    const currentComparison = useMemo(() => { if (!sourceWanted || blocked || busy || sourcesBlocked || !sources || !controls || !records || !complete.data)
        return { data: null, error: '' }; try {
        if (!clinicalControlSourceReadProjection({ tenantId: assessment.tenantId, clientId: assessment.subjectId, records: null, sources, permissions: sourcePermissions, now: comparisonClock }).canReadSources)
            throw Error('Leserechte für den vollständigen aktuellen Quellenbestand erforderlich.');
        return { data: planReviewControlSources(complete.data.plan, records, controls, sources, assessment.tenantId, assessment.id, assessment.subjectId, comparisonClock), error: '' };
    }
    catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'Vollständiger aktueller Original- und Quellenbestand nicht bestätigt.' };
    } }, [sourceWanted, blocked, busy, sourcesBlocked, sources, controls, records, complete.data, assessment.tenantId, assessment.id, assessment.subjectId, comparisonClock, sourceSignature]);
    const sourceView = useMemo(() => { if (!currentComparison.data)
        return { data: null, error: '' }; try {
        return { data: selectPlanReviewControlSources(currentComparison.data, filter, sourceFilter), error: '' };
    }
    catch (e) {
        return { data: null, error: e instanceof Error ? e.message : 'Aktueller Quellenfilter nicht anwendbar.' };
    } }, [currentComparison.data, filter, sourceFilter]);
    const displayed = sourceFilter === 'all' ? view.data : sourceView.data ?? view.data;
    const sourceExportBlocked = sourcesBlocked || !!currentComparison.error || !currentComparison.data;
    const exportState = useRef({ context: readOwner, assessment, readAllowed, blocked: blocked || busy || !view.data, complete: complete.data, records, controls, sources, permissions: sourcePermissions, sourceBlocked: sourceExportBlocked, sourceError: currentComparison.error || sourcesError, scope: exportScope, evaluationBlocked, onRequestSources, onSourcesReload, onEvaluate, onReload });
    exportState.current = { context: readOwner, assessment, readAllowed, blocked: blocked || busy || !view.data, complete: complete.data, records, controls, sources, permissions: sourcePermissions, sourceBlocked: sourceExportBlocked, sourceError: currentComparison.error || sourcesError, scope: exportScope, evaluationBlocked, onRequestSources, onSourcesReload, onEvaluate, onReload };
    function currentRead(requireOriginals = false) { const current = exportState.current; if (!alive.current || current.context !== owner.context || !current.readAllowed || current.assessment.subjectType !== owner.subjectType || owner.subjectType !== 'client' || current.assessment.tenantId !== owner.tenantId || current.assessment.id !== owner.assessmentId || current.assessment.subjectId !== owner.clientId || ![owner.tenantId, owner.assessmentId, owner.clientId].every(woundUuid))
        throw Error('Eigenen zugänglichen Pflegefall zuerst bestätigen.'); if (requireOriginals) {
        if (current.blocked || !current.complete || !current.records || !current.controls)
            throw Error('Aktuellen gespeicherten Plan und vollständige Originalbestände vor der Ausgabe bestätigen.');
        const now = Date.now(), plan = captureCurrentPlanReview(current.assessment, now);
        if (!sameWoundJson(plan, current.complete.plan))
            throw Error('Gespeicherter Planstand inzwischen geändert. Vollständige Übersicht neu laden.');
        if (!clinicalControlSourceReadProjection({ tenantId: owner.tenantId, clientId: owner.clientId, records: current.controls, sources: null, permissions: current.permissions, now }).canReadOriginals)
            throw Error('Leserechte für sämtliche unveränderten Originalhistorien erforderlich.');
        planReviewControls(plan, current.records, current.controls, owner.tenantId, owner.assessmentId, owner.clientId, now);
    } return current; }
    const requestComparison = () => { try {
        const current = currentRead();
        current.onRequestSources();
        setSourceRequested(true);
    }
    catch (e) {
        if (alive.current)
            setExportError(e instanceof Error ? e.message : 'Aktuellen Quellenbezug zuerst bestätigen.');
    } };
    async function output(mode: 'print' | 'html' | 'json') { try {
        const current = currentRead(true);
        setExportError('');
        if (current.scope === 'with_sources') {
            if (current.sourceBlocked || !current.sources)
                throw Error(current.sourceError || 'Aktuellen vollständigen Quellenvergleich vor der Ausgabe bestätigen.');
            if (!clinicalControlSourceReadProjection({ tenantId: owner.tenantId, clientId: owner.clientId, records: null, sources: current.sources, permissions: current.permissions, now: Date.now() }).canReadSources)
                throw Error('Leserechte für sämtliche aktuellen Quellen erforderlich.');
        }
        await exportPlanReviewControls(current.complete!.plan, current.records!, current.controls!, owner.tenantId, owner.assessmentId, owner.clientId, mode, current.scope === 'with_sources' ? current.sources : null);
    }
    catch (e) {
        if (alive.current)
            setExportError(e instanceof Error ? e.message : 'Prüfübersicht nicht exportierbar.');
    } }
    async function reloadSources() { try {
        const current = currentRead();
        setExportError('');
        await current.onSourcesReload();
        currentRead();
    }
    catch (e) {
        if (alive.current && exportState.current.context === owner.context)
            setExportError(e instanceof Error ? e.message : 'Aktuellen Quellenbestand erneut laden.');
    } }
    function evaluate(id: string) { try {
        const current = currentRead(true);
        if (current.evaluationBlocked || !current.complete!.plan.measures.some(measure => measure.id === id))
            throw Error('Aktuelle gespeicherte Einzelmaßnahme zuerst bestätigen.');
        current.onEvaluate(id);
    }
    catch (e) {
        if (alive.current)
            setExportError(e instanceof Error ? e.message : 'Aktuelle Einzelmaßnahme prüfen.');
    } }
    const change = (patch: Partial<PlanReviewControlsFilter>) => { setFilter(old => ({ ...old, ...patch })); setCount(10); };
    async function reload() { try {
        const current = currentRead();
        setBusy(true);
        setReloadError('');
        await current.onReload();
        currentRead();
        setCheckedAt(Date.now());
    }
    catch (e) {
        if (alive.current && exportState.current.context === owner.context)
            setReloadError(e instanceof Error ? e.message : 'Plan oder Befunde konnten nicht neu geladen werden.');
    }
    finally {
        if (alive.current && exportState.current.context === owner.context)
            setBusy(false);
    } }
    if (!owned || !readAllowed)
        return <SectionPanel title="Aktuelle Einzelmaßnahmenprüfungen"><ErrorState message="Eigener zugänglicher Pflegefall und Kontroll-Leserechte erforderlich."/></SectionPanel>;
    return <SectionPanel title="Aktuelle Einzelmaßnahmenprüfungen">
  <InfoBanner variant="info" message="Plantermine und dokumentierte Einzelbefunde werden getrennt gezeigt. Ein erreichter Plantermin ist kein Nachweis einer ausgeführten Prüfung. Entwurfsmaßnahmen sind nicht fachlich freigegeben. Historische Prüfvereinbarungen bleiben im Evaluationsverlauf."/>
  {blocked ? <InfoBanner variant="warning" message="Gespeicherter Plan, vollständiger Befund- oder Kontrollbestand wird aktualisiert oder ist nicht verfügbar. Diese gemeinsame Übersicht bleibt gesperrt."/> : null}
  {!blocked && !assessment.measures.length ? <InfoBanner variant="info" message="Keine gespeicherten Einzelmaßnahmen in diesem Planstand."/> : null}
  {view.error ? <ErrorState message={view.error}/> : null}{reloadError ? <ErrorState message={reloadError}/> : null}
  <PremiumInput label="Aktuelle Maßnahme oder passenden Einzelbefund suchen" value={filter.query} editable={!blocked && !busy} onChangeText={query => change({ query })}/>
  <FilterChipGroup wrap options={dueOptions} value={filter.due} onChange={blocked || busy ? undefined : due => change({ due: due as PlanReviewControlsFilter['due'] })}/>
  <FilterChipGroup wrap options={evidenceOptions} value={filter.evidence} onChange={blocked || busy ? undefined : evidence => change({ evidence: evidence as PlanReviewControlsFilter['evidence'] })}/>
  <FilterChipGroup wrap options={controlOptions} value={filter.control} onChange={blocked || busy ? undefined : control => change({ control: control as PlanReviewControlsFilter['control'] })}/>
  <SectionPanel title="Aktuelle Quellen der zugeordneten Kontrolloriginale">
   <Text style={body}>Dieser getrennte Vergleich ordnet ausschließlich dieselbe native Befundart und Kennung zu. Fehlende Verfügbarkeit beweist keine Rücknahme; eine identische Fassung bescheinigt keine klinische Gültigkeit, Durchführung oder Freigabe. Quellenänderungen und eigene Aufgabenzustände bleiben getrennt. Ergebnisereignisse ohne Beleg zählen nicht als fehlende aktuelle Quelle.</Text>
   {!sourceWanted ? <PremiumButton title="Aktuelle Quellenbezüge ausdrücklich vergleichen" variant="secondary" disabled={blocked || busy} onPress={requestComparison}/> : null}
   <Text style={body}>Die Quellenfilter wählen Maßnahmen und entfernte Originalaufträge aus. Bei Maßnahmen muss derselbe native Auftrag auch dem gewählten Aufgabenfilter entsprechen; alle zugehörigen Originalaufträge der passenden Maßnahme bleiben lesbar.</Text>
   <FilterChipGroup wrap options={sourceOptions} value={sourceFilter} onChange={blocked || busy ? undefined : value => { setSourceFilter(value as PlanReviewControlSourceFilter); setCount(10); if (value !== 'all')
        requestComparison(); }}/>
   {sourceWanted && (!currentComparison.data || sourcesBlocked) ? <InfoBanner variant="warning" message="Vollständiger aktueller Quellenvergleich wird geladen oder ist nicht bestätigt. Quellenfilter werden hier nicht angewendet. Die Originalübersicht bleibt mit ihren bisherigen Filtern verfügbar, sobald ihre eigenen Originalbestände bestätigt sind. Eine fehlgeschlagene Poolabfrage wird nicht als fehlender Einzelbeleg gewertet."/> : null}
   {sourceWanted && (sourcesError || currentComparison.error || sourceView.error) ? <ErrorState message={sourceView.error || currentComparison.error || sourcesError}/> : null}
   {currentComparison.data ? <Text style={body}>Zum exakten Vergleichszeitpunkt {currentComparison.data.checkedAt}: {currentComparison.data.counts.taskCount} unterschiedliche native Evaluations-Prüfaufträge dieses Assessments, einschließlich entfernter Originalmaßnahmen. {currentComparison.data.counts.identicalTaskCount} ohne festgestellte Quellenabweichung; {currentComparison.data.counts.changedSourceTaskCount} mit abweichender aktueller Fassung; {currentComparison.data.counts.unavailableSourceTaskCount} mit mindestens einer aktuell nicht enthaltenen Originalquelle; {currentComparison.data.counts.needsSourceComparisonTaskCount} mit Quellenabgleichbedarf. Derselbe Auftrag kann abweichende und nicht verfügbare Belege enthalten und erscheint in beiden Teilzählern. Suchfilter und Anzeigegrenzen ändern diese Auftragszähler nicht; unverbundene Aufträge und Folgeziele erweitern sie nicht.</Text> : null}
   {sourceWanted ? <PremiumButton title="Aktuellen Quellenbestand neu laden" variant="secondary" disabled={busy} onPress={reloadSources}/> : null}
  </SectionPanel>
  {displayed ? <><Text style={body}>{displayed.matching} Treffer aus {displayed.total} aktuellen Maßnahmen. {displayed.reached} aktive/geplante Plantermine erreicht oder überschritten. {displayed.unscheduled} ohne individuellen Plantermin.</Text><Text style={body}>Geprüfter Plan: Version {displayed.plan.version}, Änderungsstand {displayed.plan.draftRevision}, Status {displayed.plan.status}. Terminvergleich: {displayed.checkedAt}.</Text>
   <Text style={body}>{displayed.controlTotal} unterschiedliche Evaluations-Prüfaufträge für dieses Assessment: {displayed.controlOpen} offen, {displayed.controlCompleted} tatsächlich geprüft, {displayed.controlUnfulfilled} begründet nicht erfüllt, {displayed.controlCancelled} storniert. Mehrmaßnahmenaufträge werden einmal gezählt.</Text>
   <Text style={body}>{displayed.followUpTotal} unterschiedliche ausdrücklich benannte Folgeaufträge: {displayed.followUpAvailable} im aktuellen Bestand verfügbar, davon {displayed.followUpOpen} aktuell offen; {displayed.followUpUnavailable} nicht verfügbar. Jede Zielkennung zählt einmal, getrennt von den Evaluations-Prüfaufträgen. Eine Wiedereröffnung des Ursprungsauftrags hebt den historischen Folgebezug nicht auf.</Text>
   {!displayed.matching ? <InfoBanner variant="info" message="Keine aktuelle Maßnahme entspricht diesen Filtern."/> : null}
   {displayed.visible.slice(0, count).map(r => <SectionPanel key={r.measure.id!} title={r.measure.title?.trim() ? r.measure.title : `Maßnahme ${r.measure.id} · Titel nicht angegeben`}><Text style={body}>{planReviewDueLabels[r.dueState]} · {r.measure.nextEvaluationAt ?? 'Kein Plantermin'} · Status {r.measure.status}</Text><Text style={body}>Aktuelles Ziel: {r.measure.personalGoal?.trim() ? r.measure.personalGoal : 'Nicht angegeben'}{'\n'}Aktuelles Prüfkriterium: {r.measure.evaluationCriteria?.trim() ? r.measure.evaluationCriteria : 'Nicht angegeben'}</Text><InfoBanner variant={r.evidenceState === 'matched' ? 'info' : 'warning'} message={planReviewEvidenceLabels[r.evidenceState]}/>{r.latestEvidence ? <View style={{ gap: spacing.xs }}><Text style={body}>Einzelbewertung: {r.latestEvidence.evaluatedAt} · Kopf {r.latestEvidence.headId} · damaliger Änderungsstand {r.latestEvidence.draftRevision}</Text><Text style={body}>{evaluationNames[r.latestEvidence.review.outcome]}: {r.latestEvidence.review.observedEffect}</Text><Text style={body}>Dokumentierte weitere Prüfung: {evaluationNames[r.latestEvidence.review.reviewState]}{r.latestEvidence.review.reviewAt ? ` · ${r.latestEvidence.review.reviewAt}` : ''}. {r.latestEvidence.review.reviewReason}</Text></View> : null}<Text style={body}>{r.historicalCount} Einzelbefunde für andere Inhalte/Planversionen. {r.withdrawnCount} zurückgenommene Quellen. {r.aggregateOnlyCount} Gesamtbefunde ohne Einzelbewertung.</Text><PlanReviewControlList links={r.controls} disabled={blocked || busy}/>{currentComparison.data ? <PlanReviewControlSources links={r.controls} comparisons={currentComparison.data.comparisons}/> : null}<PremiumButton title="Diese aktuelle Maßnahme einzeln bewerten" variant="secondary" disabled={blocked || busy || evaluationBlocked} onPress={() => evaluate(r.measure.id!)}/></SectionPanel>)}
   {count < displayed.matching ? <PremiumButton title="Weitere aktuelle Maßnahmen anzeigen" variant="secondary" onPress={() => setCount(n => n + 10)}/> : null}</> : null}
  {displayed?.unlinkedControls.length ? <SectionPanel title="Aufträge zu entfernten Originalmaßnahmen"><Text style={body}>Diese {displayed.unlinkedControls.length} bestehenden Aufträge haben keine Maßnahme im aktuellen Plan. Aufgabenfilter und ein bestätigter aktueller Quellenfilter gelten hier; Suchbegriff und Plan-/Befundfilter für aktuelle Maßnahmen gelten nicht.</Text>{displayed.visibleUnlinkedControls.length ? <><PlanReviewControlList links={displayed.visibleUnlinkedControls} disabled={blocked || busy}/>{currentComparison.data ? <PlanReviewControlSources links={displayed.visibleUnlinkedControls} comparisons={currentComparison.data.comparisons}/> : null}</> : null}{!displayed.visibleUnlinkedControls.length ? <InfoBanner variant="info" message="Keiner dieser Aufträge entspricht den angewendeten Auftrags- und Quellenfiltern."/> : null}</SectionPanel> : null}
  {exportError ? <ErrorState message={exportError}/> : null}
  <Text style={body}>Der Übersichtsauszug enthält alle aktuellen Maßnahmen, den vollständigen geladenen Evaluationsbestand dieses Assessments und sämtliche zugehörigen Kontrolloriginale. Aufträge zu entfernten Originalmaßnahmen bleiben enthalten. Suchfilter und Anzeigegrenzen gelten nicht für den Auszug. Dateien enthalten vertrauliche Pflegeinformationen.</Text>
  <FilterChipGroup wrap options={[{ key: 'originals', label: 'Originale ohne aktuellen Quellenvergleich' }, { key: 'with_sources', label: 'Originale mit aktuellem Quellenvergleich' }]} value={exportScope} onChange={busy ? undefined : scope => { setExportScope(scope as 'originals' | 'with_sources'); setExportError(''); if (scope === 'with_sources')
        requestComparison(); }}/>
  <Text style={body}>{exportScope === 'originals' ? 'Die gesicherten Originale bleiben vollständig enthalten. Ein aktueller Quellenvergleich wird für diesen Auszug als ungeprüft gekennzeichnet.' : 'Die Ausgabe vergleicht zusätzlich die Quellen der zugehörigen Originalaufträge und ausdrücklich ausgehenden Folgeketten. Der vollständige aktuelle Quellenbestand wird geprüft, aber nicht als ganzer Pool exportiert. Aktuelle Personenlisten und angefangene Formulare werden dafür nicht verwendet. Eine identische, abweichende oder nicht verfügbare Quelle bescheinigt keine klinische Gültigkeit, Durchführung oder Erledigung.'}</Text>
  {exportScope === 'with_sources' ? <>
   {sourceExportBlocked ? <InfoBanner variant="warning" message="Der vollständige aktuelle Quellenvergleich ist nicht bestätigt. Diese Ausgabe bleibt gesperrt. Eine fehlgeschlagene Quellenabfrage wird nicht als fehlender einzelner Originalbeleg gewertet; der Originalauszug ohne aktuellen Vergleich bleibt verfügbar."/> : null}
   {sourcesError || currentComparison.error ? <ErrorState message={currentComparison.error || sourcesError}/> : null}
   {currentComparison.data ? <Text style={body}>Vollständiger Original- und Quellenbestand für den Vergleich geprüft: {currentComparison.data.checkedAt}. Die Ausgabe prüft erneut zum tatsächlichen Auszugszeitpunkt.</Text> : null}
   <Text style={body}>Der aktuelle Quellenbestand lässt sich im Quellenvergleich oberhalb der Maßnahmen unabhängig neu laden.</Text>
  </> : null}
  {(['print', 'html', 'json'] as const).map(mode => <PremiumButton key={mode} title={{ print: 'Prüfübersicht und Kontrolloriginale drucken', html: 'Prüfübersicht mit Aufträgen als HTML herunterladen', json: 'Prüfübersicht mit Befund- und Kontrolloriginalen als JSON herunterladen' }[mode]} variant="secondary" disabled={blocked || busy || !view.data || (exportScope === 'with_sources' && sourceExportBlocked)} onPress={() => output(mode)}/>)}
  <PremiumButton title="Zeitvergleich aktualisieren" variant="secondary" disabled={blocked || busy} onPress={() => setCheckedAt(Date.now())}/>
  <PremiumButton title="Gespeicherten Plan, Befunde und Aufträge neu laden" variant="secondary" disabled={busy} loading={busy} onPress={reload}/>
 </SectionPanel>;
}
