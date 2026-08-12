import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import {
  fetchInformationCollections,
  fetchPflegeAssessmentsList,
  fetchPflegeEvaluationList,
  fetchPflegeHandoversList,
  fetchPflegeMeasuresList,
  fetchPflegeRiskAssessments,
  fetchPflegeVisitsList,
} from '@/lib/pflege/pflegeDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

export function InformationCollectionListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Informationssammlung"
      eyebrow="PFLEGE · DATENERHEBUNG"
      subtitle="Vollständigkeit und offene Punkte"
      createRoute="/pflege/informationssammlung/new"
      queryFn={fetchInformationCollections}
      searchKeys={['clientName', 'collectionType', 'assessorName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/informationssammlung/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.clientName,
        secondary: `${item.collectionType} · ${item.completenessPercent}% vollständig · ${item.openItemsCount} offen`,
        badge: item.status,
      })}
    />
  );
}

export function PflegeRisksListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Risiken"
      eyebrow="PFLEGE · RISIKOMATRIX"
      subtitle="Erhöhte Risiken und fällige Reviews"
      queryFn={fetchPflegeRiskAssessments}
      searchKeys={['clientName', 'riskKey', 'assessorName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/risiko-review?id=${item.id}` as never)}
      renderMeta={(item) => ({
        primary: `${item.clientName} · ${item.riskKey}`,
        secondary: `${item.state} · ${item.urgency} · ${item.assessorName}`,
        badge: item.nextReviewAt ? `Review ${formatDate(item.nextReviewAt)}` : 'Review fehlt',
      })}
    />
  );
}

export function PflegeAssessmentsListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Assessments"
      eyebrow="PFLEGE · SIS"
      subtitle="Strukturierte Pflegeassessments"
      createRoute="/pflege/sis/create"
      queryFn={fetchPflegeAssessmentsList}
      searchKeys={['clientName', 'assessorName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/sis/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.clientName,
        secondary: `Score ${item.overallScore} · ${formatDate(item.assessedAt)}`,
        badge: item.status,
      })}
    />
  );
}

export function PflegeMeasuresListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Maßnahmen"
      eyebrow="PFLEGE · MASSNAHMENPLAN"
      subtitle="Aktive Pflegeplan-Maßnahmen"
      createRoute="/pflege/plans/create"
      queryFn={fetchPflegeMeasuresList}
      searchKeys={['title', 'clientName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/massnahme-review?id=${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · ${item.frequency || 'individuell'} · ${item.responsibleRole || 'Pflegefachteam'}`,
        badge: item.overdue ? 'Evaluation fällig' : item.status,
      })}
    />
  );
}

export function PflegeEvaluationListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Evaluation"
      eyebrow="PFLEGE · EVALUATION"
      subtitle="Pläne mit anstehender Evaluation"
      createRoute="/pflege/evaluation/new"
      queryFn={fetchPflegeEvaluationList}
      searchKeys={['planTitle', 'clientName', 'evaluatorName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/plans/${item.carePlanId}` as never)}
      renderMeta={(item) => ({
        primary: item.planTitle,
        secondary: `${item.clientName} · ${item.evaluatorName} · ${formatDate(item.evaluatedAt)}`,
        badge: item.requiresPlanUpdate ? 'Fortschreibung nötig' : item.outcome,
      })}
    />
  );
}

export function PflegeVisitsListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Visiten"
      eyebrow="PFLEGE · VISITEN"
      subtitle="PDL- und Fachvisiten"
      createRoute="/pflege/visiten/new"
      queryFn={fetchPflegeVisitsList}
      searchKeys={['scope', 'clientName', 'visitorName']}
      getItemId={(item) => item.id}
      onOpen={(item) => item.carePlanId ? router.push(`/pflege/plans/${item.carePlanId}` as never) : undefined}
      renderMeta={(item) => ({
        primary: item.scope,
        secondary: `${item.clientName} · ${item.visitorName} · ${formatDate(item.conductedAt ?? item.scheduledAt ?? '')}`,
        badge: item.status,
      })}
    />
  );
}

export function PflegeHandoversListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Übergaben"
      eyebrow="PFLEGE · SCHICHTÜBERGABE"
      subtitle="Dokumentierte Übergaben"
      createRoute="/pflege/uebergaben/new"
      queryFn={fetchPflegeHandoversList}
      searchKeys={['title', 'clientName', 'employeeName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/dokumentation/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · ${formatDate(item.recordedAt)}`,
        badge: item.hasSignature ? 'Signiert' : item.status,
      })}
    />
  );
}
