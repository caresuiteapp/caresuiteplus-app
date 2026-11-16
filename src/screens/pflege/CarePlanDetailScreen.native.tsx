// Generated native presentation from src/screens/pflege/CarePlanDetailScreen.web.tsx. Update through scripts/port-native-workspaces.mjs.
import {CareSuiteNativeText as Text} from '@/components/ui/CareSuiteNativeText';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useFlowRouter as useRouter } from "../../hooks/useFlowRouter.ts";
import { CarePlanDetailHero, VitalReadingListCard } from '@/components/pflege';
import { PflegeCrossModuleLinksPanel } from '@/components/pflege/PflegeCrossModuleLinksPanel';
import { DetailInfoRow } from '@/components/detail';
import { LockedActionBanner } from '@/components/permissions';
import { ScreenShell } from '@/components/layout';
import { EmptyState, ErrorState, LoadingState, PremiumBadge, PremiumButton, PremiumCard, SectionPanel } from '@/components/ui';
import { NativeCarePlanSourcePanel } from "../../components/pflege/NativeCarePlanSourcePanel.native.tsx";
import { useCarePlanDetail } from "../../hooks/useCarePlanDetail.native.ts";
import { useCareRuntimePermissions } from "../../hooks/pflege/useCareRuntimePermissions.native.ts";
import { useServiceTenantId } from '@/hooks/useTenantId';
import { useAuth } from '@/lib/auth/context';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import { formatCareLevel } from '@/lib/formatters/unitFormatters';
import { buildCarePlanDocument } from '@/lib/pflege/carePlanDocument';
import { printCarePlan } from "../../lib/pflege/printCarePlan.native.ts";
import { colors, spacing, typography } from '@/theme';
function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}
function statusVariant(status: string) {
    switch (status) {
        case 'aktiv':
            return 'green' as const;
        case 'fehlerhaft':
        case 'gesperrt':
            return 'red' as const;
        case 'in_bearbeitung':
        case 'entwurf':
            return 'orange' as const;
        default:
            return 'muted' as const;
    }
}
export function CarePlanDetailScreen() {
    const { id } = useLocalSearchParams<{
        id: string;
    }>();
    const router = useRouter();
    const { profile } = useAuth();
    const { can, loading: permissionsLoading, roleLabel } = useCareRuntimePermissions();
    const tenantId = useServiceTenantId();
    const isReadOnly = !can('pflege.plans.manage');
    const roleKey = profile?.roleKey ?? 'nurse';
    const [printError, setPrintError] = useState('');
    const { data: plan, vitals, loading, error, refresh, notFound, isCurrent, } = useCarePlanDetail(id);
    if (loading || permissionsLoading) {
        return (<ScreenShell title="Pflegeplan" subtitle="Wird geladen…">
        <LoadingState message="Pflegeplandetails werden geladen…"/>
      </ScreenShell>);
    }
    if (!can('pflege.plans.view')) {
        return <ScreenShell title="Pflegeplan"><ErrorState message="Das aktuelle eigene Pflegeplan-Leserecht ist nicht bestätigt."/></ScreenShell>;
    }
    if (notFound || error) {
        return (<ScreenShell title="Pflegeplan" subtitle="Fehler">
        <ErrorState title={notFound ? 'Nicht gefunden' : 'Fehler'} message={error ?? 'Der Pflegeplan existiert nicht.'} onRetry={refresh}/>
        <PremiumButton title="Zur Liste" variant="secondary" onPress={() => router.back()}/>
      </ScreenShell>);
    }
    if (!plan)
        return null;
    if (typeof id !== 'string' || plan.id !== id || !tenantId || plan.tenantId !== tenantId) {
        return <ScreenShell title="Pflegeplan"><ErrorState message="Der geladene Pflegeplan gehört nicht zur aktuellen Auswahl. Bitte neu laden." onRetry={refresh}/></ScreenShell>;
    }
    const savedPlan = plan;
    async function printDocument() {
        if (!isCurrent() || !can('pflege.plans.view'))
            return;
        setPrintError('');
        try {
            await printCarePlan(buildCarePlanDocument(savedPlan));
        }
        catch (error) {
            setPrintError(error instanceof Error ? error.message : 'Der Dokumentationsbogen konnte nicht geöffnet werden.');
        }
    }
    return (<ScreenShell title={plan.title} subtitle={`${plan.clientName} · ${roleLabel ?? 'Demo'}`} rightSlot={<View style={styles.headerActions}>
          <PremiumButton title="Dokumentationsbogen drucken" size="sm" variant="secondary" onPress={printDocument}/>
          {!isReadOnly ? (<PremiumButton title="Fortschreiben" size="sm" onPress={() => { if (isCurrent() && can('pflege.plans.manage'))
                router.push(`/pflege/planung/${plan.id}/edit` as never); }}/>) : null}
          <PremiumButton title="Zurück" size="sm" variant="ghost" onPress={() => router.back()}/>
        </View>}>
      <CarePlanDetailHero plan={plan} roleKey={roleKey} isReadOnly={isReadOnly}/>
      {printError ? <ErrorState message={printError}/> : null}

      {isReadOnly ? (<LockedActionBanner title="Lesemodus" message="Sie können Pflegepläne einsehen, aber nicht bearbeiten." roleLabel={roleLabel}/>) : null}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <SectionPanel title="Gültigkeit">
          <DetailInfoRow label="Gültig ab" value={formatDate(plan.validFrom)}/>
          <DetailInfoRow label="Gültig bis" value={plan.validUntil ? formatDate(plan.validUntil) : 'Unbefristet'}/>
          <DetailInfoRow label="Pflegeprobleme und Unterstützungsbedarf" value={plan.summary}/>
          <DetailInfoRow label="Pflegeziele" value={plan.goals || '—'}/>
          <DetailInfoRow label="Ressourcen" value={plan.resources || '—'}/>
          <DetailInfoRow label="Risiken" value={plan.risks || '—'}/>
          <DetailInfoRow label="Version" value={String(plan.version)}/>

        </SectionPanel>

        <NativeCarePlanSourcePanel key={`${id}:${plan.clientId}:${plan.assessmentId ?? 'unlinked'}`} planId={id} clientId={plan.clientId} sourceAssessmentId={plan.assessmentId ?? null}/>

        <SectionPanel title="Klient:in">
          <DetailInfoRow label="Name" value={plan.clientName}/>
          <DetailInfoRow label="Pflegegrad" value={plan.careLevel ? formatCareLevel(plan.careLevel) : '—'}/>
          <DetailInfoRow label="Wohnort" value={plan.city}/>
          <DetailInfoRow label="Zuständige Pflegekraft" value={plan.employeeName}/>
          <DetailInfoRow label="Aktive Diagnosen" value={String(plan.diagnosisCount)}/>
          <DetailInfoRow label="Aktive Verordnungen" value={String(plan.activeOrderCount)}/>
        </SectionPanel>

        <SectionPanel title="Individuelle Maßnahmen" subtitle={`${plan.tasks.length} Maßnahmen`}>
          {plan.tasks.length === 0 ? (<EmptyState title="Keine Aufgaben" message="Diesem Plan sind keine Aufgaben zugeordnet."/>) : (plan.tasks.map((task) => (<PremiumCard key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <Text style={styles.taskLabel}>{task.label}</Text>
                  <PremiumBadge label={WORKFLOW_STATUS_LABELS[task.status]} variant={statusVariant(task.status)} dot/>
                </View>
                <Text style={styles.taskFreq}>{task.frequency}</Text>
                {task.description && task.description !== task.intervention ? <DetailInfoRow label="Pflegeproblem oder Unterstützungsbedarf" value={task.description}/> : null}
                {task.category ? <DetailInfoRow label="Pflegemodell und Bereich" value={task.category}/> : null}
                {task.personContribution ? <DetailInfoRow label="Eigenbeitrag der Person" value={task.personContribution}/> : null}
                {task.goal ? <DetailInfoRow label="Pflegeziel" value={task.goal}/> : null}
                {task.intervention ? <DetailInfoRow label="Durchführung" value={task.intervention}/> : null}
                {task.responsibleRole ? <DetailInfoRow label="Zuständigkeit" value={task.responsibleRole}/> : null}
                {task.relativesContribution ? <DetailInfoRow label="Unterstützung durch Angehörige" value={task.relativesContribution}/> : null}
                {task.evaluationCriteria ? <DetailInfoRow label="Kriterium für die Evaluation" value={task.evaluationCriteria}/> : null}
                {task.nextEvaluationAt ? <DetailInfoRow label="Nächste Evaluation" value={formatDate(task.nextEvaluationAt)}/> : null}
                {task.notes ? <DetailInfoRow label="Individuelle Bemerkungen" value={task.notes}/> : null}
                {task.warningSigns ? <Text style={styles.taskWarning}>Warnkriterien: {task.warningSigns}</Text> : null}
                {task.escalationPath ? <Text style={styles.taskWarning}>Eskalation: {task.escalationPath}</Text> : null}
              </PremiumCard>)))}
        </SectionPanel>

        <SectionPanel title="Vitalwerte" subtitle={(plan.dueVitalsCount ?? 0) > 0
            ? `${plan.dueVitalsCount} fällige Messung(en)`
            : 'In dieser Planansicht nicht geladen'}>
          {vitals.length === 0 ? (<EmptyState title="Vitalwerte separat prüfen" message="Diese Planansicht lädt keine Vitalmessungen. Vorhandene Messungen und fällige Kontrollen prüfen Sie im Bereich Vitalwerte."/>) : (vitals.map((reading) => (<VitalReadingListCard key={reading.id} reading={reading} onPress={() => router.push(`/pflege/vitalwerte/${reading.id}` as never)}/>)))}
        </SectionPanel>

        <PflegeCrossModuleLinksPanel context="care-plan" title="Leistungsübersicht" scope={{ clientId: plan.clientId, carePlanId: plan.id, can: permission => isCurrent() && can(permission) }}/>
      </ScrollView>
    </ScreenShell>);
}
const styles = StyleSheet.create({
    headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
    scroll: { paddingBottom: spacing.xxl, gap: spacing.md },
    taskCard: { marginBottom: spacing.sm },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: spacing.sm,
        marginBottom: 4,
    },
    taskLabel: { ...typography.bodyStrong, flex: 1 },
    taskFreq: { ...typography.caption, color: colors.cyan },
    taskWarning: { ...typography.caption, color: colors.warning, marginTop: 4 },
});
