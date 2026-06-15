import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import {
  fetchExamList,
  fetchInstructorList,
  fetchLearningProgressList,
  fetchLessonList,
  fetchMandatoryCourses,
  fetchMediaLibrary,
  fetchTrainingPlanCourses,
} from '@/lib/akademie/akademieDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

export function LessonsListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Lektionen"
      eyebrow="AKADEMIE · LERNINHALTE"
      subtitle="Reihenfolge und Dauer je Kurs"
      createRoute="/akademie/kurse/new"
      queryFn={fetchLessonList}
      searchKeys={['title', 'courseTitle']}
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

export function ExamsListScreen() {
  return (
    <DedicatedListScreen
      title="Prüfungen"
      eyebrow="AKADEMIE · PRÜFUNGEN"
      subtitle="Termine und Bestehensgrenzen"
      queryFn={fetchExamList}
      searchKeys={['title', 'courseTitle']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${formatDate(item.scheduledAt)} · ${item.enrolledCount} Teilnehmende · Bestehen ${item.passingScore}%`,
        badge: item.status,
      })}
    />
  );
}

export function MandatoryTrainingsScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Pflichtschulungen"
      eyebrow="AKADEMIE · COMPLIANCE"
      subtitle="Verpflichtende Kurse im Mandanten"
      queryFn={fetchMandatoryCourses}
      searchKeys={['title', 'category']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/akademie/kurse/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.category} · ${item.enrollmentCount} Einschreibungen`,
        badge: 'Pflicht',
      })}
    />
  );
}

export function TrainingPlanScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Schulungsplan"
      eyebrow="AKADEMIE · PLANUNG"
      subtitle="Geplante Kursstarts"
      queryFn={fetchTrainingPlanCourses}
      searchKeys={['title']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/akademie/kurse/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: item.startsAt ? `Start: ${formatDate(item.startsAt)}` : 'Ohne Starttermin',
        badge: item.status,
      })}
    />
  );
}

export function MediaLibraryScreen() {
  return (
    <DedicatedListScreen
      title="Mediathek"
      eyebrow="AKADEMIE · MEDIATHEK"
      subtitle="Videos, PDFs und Links"
      queryFn={fetchMediaLibrary}
      searchKeys={['title', 'courseTitle', 'mediaType']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.courseTitle} · ${item.mediaType.toUpperCase()} · ${item.durationMinutes} Min.`,
      })}
    />
  );
}

export function InstructorsScreen() {
  return (
    <DedicatedListScreen
      title="Dozent:innen"
      eyebrow="AKADEMIE · DOZENT:INNEN"
      subtitle="Externe und interne Referent:innen"
      queryFn={fetchInstructorList}
      searchKeys={['name', 'specialty']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: item.name,
        secondary: `${item.specialty} · ${item.courseCount} Kurse`,
      })}
    />
  );
}

export function LearningProgressScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Fortschritt"
      eyebrow="AKADEMIE · LERNFORTSCHRITT"
      subtitle="Teilnahme und Abschlussquoten"
      queryFn={fetchLearningProgressList}
      searchKeys={['participantName', 'courseTitle']}
      getItemId={(item) => item.id}
      onOpen={() => router.push('/akademie/teilnehmer' as never)}
      renderMeta={(item) => ({
        primary: item.participantName,
        secondary: `${item.courseTitle} · zuletzt ${formatDate(item.lastActivityAt)}`,
        badge: `${item.progressPercent}%`,
      })}
    />
  );
}
