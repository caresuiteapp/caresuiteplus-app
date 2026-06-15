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
      searchKeys={['clientName', 'assessorName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/sis/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.clientName,
        secondary: `Score ${item.overallScore} · ${item.assessorName}`,
        badge: item.nextReviewAt ? `Review ${formatDate(item.nextReviewAt)}` : 'Ohne Termin',
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
      createRoute="/pflege/plans/new"
      queryFn={fetchPflegeMeasuresList}
      searchKeys={['title', 'clientName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/plans/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · gültig bis ${formatDate(item.validUntil)}`,
        badge: item.alertCount > 0 ? `${item.alertCount} Hinweise` : item.status,
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
      queryFn={fetchPflegeEvaluationList}
      searchKeys={['title', 'clientName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/plans/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · Evaluation bis ${formatDate(item.validUntil)}`,
        badge: item.status,
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
      createRoute="/pflege/dokumentation/new"
      queryFn={fetchPflegeVisitsList}
      searchKeys={['title', 'clientName', 'employeeName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/pflege/dokumentation/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · ${item.employeeName} · ${formatDate(item.recordedAt)}`,
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
      createRoute="/pflege/dokumentation/new"
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
