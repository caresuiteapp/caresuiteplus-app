import { useRouter } from 'expo-router';
import { EntityListScreen } from '@/components/lists/EntityListScreen';
import { useServiceListQuery } from '@/hooks/useServiceListQuery';
import { fetchExamList, fetchLessonList } from '@/lib/akademie/akademieDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

/** WP432 — Akademie Lektionen (Arbeitsplan 091) */
export function LessonsListScreen() {
  const router = useRouter();
  const list = useServiceListQuery(fetchLessonList, ['title', 'courseTitle']);

  return (
    <EntityListScreen
      title="Lektionen"
      eyebrow="AKADEMIE · LERNINHALTE"
      subtitle="Reihenfolge und Dauer je Kurs"
      emptyTitle="Keine Lektionen"
      emptyMessage="Es sind noch keine Lerninhalte angelegt."
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
      onCreatePress={() => router.push('/akademie/kurse/new' as never)}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/akademie/kurse/${item.courseId}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.courseTitle} · ${item.durationMinutes} Min.`,
        badge: `${item.sortOrder}. Lektion`,
      })}
    />
  );
}

/** WP434 — Akademie Prüfungen (Arbeitsplan 093) */
export function ExamsListScreen() {
  const list = useServiceListQuery(fetchExamList, ['title', 'courseTitle']);

  return (
    <EntityListScreen
      title="Prüfungen"
      eyebrow="AKADEMIE · PRÜFUNGEN"
      subtitle="Termine und Bestehensgrenzen"
      emptyTitle="Keine Prüfungen"
      emptyMessage="Es sind noch keine Prüfungstermine geplant."
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
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${formatDate(item.scheduledAt)} · ${item.enrolledCount} Teilnehmende · Bestehen ${item.passingScore}%`,
        badge: item.status,
      })}
    />
  );
}

void fetchLessonList;
