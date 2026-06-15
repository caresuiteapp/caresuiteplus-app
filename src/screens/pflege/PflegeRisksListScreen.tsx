import { useRouter } from 'expo-router';
import { EntityListScreen } from '@/components/lists/EntityListScreen';
import { useServiceListQuery } from '@/hooks/useServiceListQuery';
import { fetchPflegeRiskAssessments } from '@/lib/pflege/pflegeDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

const SEARCH_KEYS = ['clientName', 'assessorName'] as const;

/** WP352 — Pflege Risiken (Arbeitsplan 064) */
export function PflegeRisksListScreen() {
  const router = useRouter();
  const list = useServiceListQuery(fetchPflegeRiskAssessments, [...SEARCH_KEYS]);

  return (
    <EntityListScreen
      title="Risiken"
      eyebrow="PFLEGE · RISIKOMATRIX"
      subtitle="Erhöhte Risiken und fällige Reviews"
      emptyTitle="Keine Risiken"
      emptyMessage="Es sind noch keine Risikobewertungen dokumentiert."
      loading={list.loading}
      error={list.error}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      items={list.items}
      isEmpty={list.isEmpty}
      isFilterEmpty={list.isFilterEmpty}
      search={list.search}
      onSearchChange={list.setSearch}
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

void fetchPflegeRiskAssessments;
