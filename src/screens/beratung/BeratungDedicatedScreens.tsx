import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import {
  fetchAngehoerigeCases,
  fetchBeratungMeasuresCases,
  fetchKontaktverlaufProtocols,
  fetchLeistungsberatungCases,
} from '@/lib/beratung/beratungDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

export function BeratungMeasuresListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Maßnahmen"
      eyebrow="BERATUNG · MASSNAHMEN"
      subtitle="Fallbezogene Maßnahmenpläne"
      createRoute="/beratung/cases/new"
      queryFn={fetchBeratungMeasuresCases}
      searchKeys={['subject', 'clientName', 'category']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/beratung/cases/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.subject,
        secondary: `${item.clientName} · ${item.category}`,
        badge: item.status,
      })}
    />
  );
}

export function LeistungsberatungListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Leistungsberatung"
      eyebrow="BERATUNG · LEISTUNGEN"
      subtitle="Pflegegrad und Leistungsansprüche"
      createRoute="/beratung/cases/new"
      queryFn={fetchLeistungsberatungCases}
      searchKeys={['subject', 'clientName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/beratung/cases/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.subject,
        secondary: `${item.clientName} · Termin ${item.nextAppointmentAt ? formatDate(item.nextAppointmentAt) : '—'}`,
        badge: item.status,
      })}
    />
  );
}

export function AngehoerigeBeratungListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Angehörige"
      eyebrow="BERATUNG · ANGEHÖRIGE"
      subtitle="Angehörigenberatung und Entlastung"
      createRoute="/beratung/cases/new"
      queryFn={fetchAngehoerigeCases}
      searchKeys={['subject', 'clientName']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/beratung/cases/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.subject,
        secondary: item.clientName,
        badge: item.status,
      })}
    />
  );
}

export function KontaktverlaufListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Kontaktverlauf"
      eyebrow="BERATUNG · KONTAKTE"
      subtitle="Chronologischer Protokollverlauf"
      queryFn={fetchKontaktverlaufProtocols}
      searchKeys={['caseSubject', (item) => item.content]}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/beratung/protokolle/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.caseSubject,
        secondary: `${formatDate(item.recordedAt)} · ${item.content.slice(0, 80)}`,
        badge: item.status,
      })}
    />
  );
}
