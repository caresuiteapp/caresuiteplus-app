import { useRouter } from 'expo-router';
import { EntityListScreen } from '@/components/lists/EntityListScreen';
import { useServiceListQuery } from '@/hooks/useServiceListQuery';
import { fetchAssistTasksList } from '@/lib/assist/assistDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

const SEARCH_KEYS = ['title', 'clientName', 'employeeName', 'location'] as const;

/** WP242 — Assist Aufgabenliste (Arbeitsplan 042) */
export function AssistTasksListScreen() {
  const router = useRouter();
  const list = useServiceListQuery(fetchAssistTasksList, [...SEARCH_KEYS]);

  return (
    <EntityListScreen
      title="Aufgaben"
      eyebrow="ASSIST · AUFGABEN"
      subtitle="Offene und laufende Einsatzaufgaben"
      emptyTitle="Keine Aufgaben"
      emptyMessage="Es sind noch keine Einsatzaufgaben geplant."
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
      createLabel="+ Einsatz"
      onCreatePress={() => router.push('/assist/einsaetze/new' as never)}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/assist/einsaetze/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.clientName} · ${formatDate(item.scheduledStart)} · ${item.location}`,
        badge: item.status,
      })}
    />
  );
}

void fetchAssistTasksList;
