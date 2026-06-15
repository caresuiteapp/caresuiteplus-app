import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import { fetchAssistQualityProofs, fetchAssistTasksList } from '@/lib/assist/assistDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

export function AssistTasksListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Aufgaben"
      eyebrow="ASSIST · AUFGABEN"
      subtitle="Offene und laufende Einsatzaufgaben"
      createRoute="/assist/einsaetze/new"
      queryFn={fetchAssistTasksList}
      searchKeys={['title', 'clientName', 'employeeName', 'location']}
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

export function AssistQualityListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Qualität / Nachweise"
      eyebrow="ASSIST · QUALITÄT"
      subtitle="Leistungsnachweise und Qualitätsindikatoren"
      queryFn={fetchAssistQualityProofs}
      searchKeys={['clientName', 'assignmentTitle']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/assist/nachweise/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.assignmentTitle,
        secondary: `${item.clientName} · ${formatDate(item.recordedAt)}`,
        badge: item.hasSignature ? `Q${item.qualityScore}` : item.status,
      })}
    />
  );
}
