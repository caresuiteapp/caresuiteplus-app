import { useRouter } from 'expo-router';
import { DedicatedListScreen } from '@/components/einzelseiten/DedicatedListScreen';
import {
  fetchActivityPlans,
  fetchDailyStructure,
  fetchMealPlans,
  fetchOccupancyList,
  fetchResidentPlanning,
  fetchRoomList,
  fetchStationaerRisksList,
} from '@/lib/stationaer/stationaerDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

export function RoomsListScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Zimmer"
      eyebrow="STATIONÄR · ZIMMER"
      subtitle="Kapazität und Belegung je Zimmer"
      queryFn={fetchRoomList}
      searchKeys={['roomNumber', 'wing']}
      getItemId={(item) => item.id}
      onOpen={(item) => router.push(`/stationaer/wohnbereiche/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.roomNumber,
        secondary: `${item.wing} · ${item.occupiedBeds}/${item.capacity} Betten`,
        badge: item.status,
      })}
    />
  );
}

export function OccupancyListScreen() {
  return (
    <DedicatedListScreen
      title="Belegung"
      eyebrow="STATIONÄR · BELEGUNG"
      subtitle="Auslastung nach Hausflügel"
      queryFn={fetchOccupancyList}
      searchKeys={['wing']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: item.wing,
        secondary: `${item.occupiedBeds}/${item.totalBeds} Betten belegt`,
        badge: `${item.occupancyPercent} %`,
      })}
    />
  );
}

export function DailyStructureScreen() {
  return (
    <DedicatedListScreen
      title="Tagesstruktur"
      eyebrow="STATIONÄR · TAGESSTRUKTUR"
      subtitle="Tagesablauf und Zeitslots"
      queryFn={fetchDailyStructure}
      searchKeys={['activity', 'livingArea', 'timeSlot']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: `${item.timeSlot} · ${item.activity}`,
        secondary: `${item.livingArea} · ${item.participantCount} Teilnehmende`,
        badge: item.status,
      })}
    />
  );
}

export function MealsPlanningScreen() {
  return (
    <DedicatedListScreen
      title="Mahlzeiten"
      eyebrow="STATIONÄR · VERPFLEGUNG"
      subtitle="Speisepläne und Diät-Hinweise"
      queryFn={fetchMealPlans}
      searchKeys={['menu', 'mealType', 'dietaryNotes']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: `${item.mealType}: ${item.menu}`,
        secondary: `${item.dietaryNotes} · ${item.residentCount} Bewohner:innen · ${formatDate(item.servedAt)}`,
        badge: item.status,
      })}
    />
  );
}

export function ActivitiesPlanningScreen() {
  return (
    <DedicatedListScreen
      title="Aktivitäten"
      eyebrow="STATIONÄR · AKTIVITÄTEN"
      subtitle="Gruppenangebote und Termine"
      queryFn={fetchActivityPlans}
      searchKeys={['title', 'facilitator', 'location']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: item.title,
        secondary: `${item.facilitator} · ${item.location} · ${formatDate(item.scheduledAt)}`,
        badge: `${item.participantCount} TN`,
      })}
    />
  );
}

export function ResidentPlanningScreen() {
  const router = useRouter();
  return (
    <DedicatedListScreen
      title="Bewohnerplanung"
      eyebrow="STATIONÄR · INDIVIDUELLE PLANUNG"
      subtitle="Pflegeschwerpunkte und Reviews"
      queryFn={fetchResidentPlanning}
      searchKeys={['residentName', 'roomNumber', 'careFocus']}
      getItemId={(item) => item.id}
      onOpen={() => router.push('/stationaer/(tabs)/bewohner' as never)}
      renderMeta={(item) => ({
        primary: item.residentName,
        secondary: `Zimmer ${item.roomNumber} · Fokus ${item.careFocus}`,
        badge: `Review ${formatDate(item.nextReviewAt)}`,
      })}
    />
  );
}

export function StationaerRisksListScreen() {
  return (
    <DedicatedListScreen
      title="Risiken"
      eyebrow="STATIONÄR · RISIKODOKUMENTATION"
      subtitle="Sturz, Dekubitus und Verhalten"
      queryFn={fetchStationaerRisksList}
      searchKeys={['residentName', 'riskType', 'severity']}
      getItemId={(item) => item.id}
      renderMeta={(item) => ({
        primary: item.residentName,
        secondary: `${item.riskType} · zuletzt ${formatDate(item.lastReviewAt)}`,
        badge: item.severity,
      })}
    />
  );
}
