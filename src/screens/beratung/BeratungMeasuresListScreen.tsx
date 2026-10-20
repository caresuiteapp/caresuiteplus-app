import { useRouter } from 'expo-router';
import { EntityListScreen } from '@/components/lists/EntityListScreen';
import { useServiceListQuery } from '@/hooks/useServiceListQuery';
import { fetchBeratungMeasuresCases } from '@/lib/beratung/beratungDedicatedService';

const SEARCH_KEYS = ['subject', 'clientName', 'category'] as const;

/** WP376 — Beratung Maßnahmen (Arbeitsplan 076) */
export function BeratungMeasuresListScreen() {
  const router = useRouter();
  const list = useServiceListQuery(fetchBeratungMeasuresCases, [...SEARCH_KEYS]);

  return (
    <EntityListScreen
      title="Maßnahmen"
      eyebrow="BERATUNG · MASSNAHMEN"
      subtitle="Fallbezogene Maßnahmenpläne"
      emptyTitle="Keine Maßnahmen"
      emptyMessage="Es sind noch keine Beratungsmaßnahmen geplant."
      loading={list.loading}
      error={list.error}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      items={list.items}
      isEmpty={list.isEmpty}
      isFilterEmpty={list.isFilterEmpty}
      search={list.search}
      onSearchChange={list.setSearch}
      showCreate
      onCreatePress={() => router.push('/beratung/faelle/new' as never)}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/beratung/faelle/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.subject,
        secondary: `${item.clientName} · ${item.category}`,
        badge: item.status,
      })}
    />
  );
}

void fetchBeratungMeasuresCases;
