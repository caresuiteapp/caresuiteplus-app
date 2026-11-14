import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import {
  fetchInformationCollections,
  fetchPflegeAssessmentsList,
  fetchPflegeHandoversList,
  fetchPflegeRiskAssessments,
  fetchPflegeVisitsList,
} from '@/lib/pflege/pflegeDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';
export { PflegeEvaluationWorkspace as PflegeEvaluationListScreen } from './PflegeEvaluationWorkspace';

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

export { CareMeasuresWorkspaceScreen as PflegeMeasuresListScreen } from './CareMeasuresWorkspaceScreen';

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
  return (
    <DedicatedListScreen
      title="Übergaben"
      eyebrow="PFLEGE · SCHICHTÜBERGABE"
      subtitle="Dokumentierte Übergaben"
      createRoute="/pflege/uebergaben/new"
      queryFn={fetchPflegeHandoversList}
      searchKeys={['title', 'clientName', 'employeeName']}
      getItemId={(item) => item.id}
      onOpen={() => undefined}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · ${formatDate(item.recordedAt)} · ${item.contentPreview}`,
        badge: item.hasSignature ? 'Empfang vollständig' : item.status,
      })}
    />
  );
}
