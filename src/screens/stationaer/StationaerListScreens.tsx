import { useRouter } from 'expo-router';
import { EntityListScreen } from '@/components/lists/EntityListScreen';
import { useServiceListQuery } from '@/hooks/useServiceListQuery';
import {
  fetchRoomList,
  fetchOccupancyList,
  fetchDailyStructure,
  fetchMealPlans,
} from '@/lib/stationaer/stationaerDedicatedService';
import { formatDate } from '@/lib/formatters/dateTimeFormatters';

/** WP482 — Stationär Zimmer (Arbeitsplan 082) */
export function RoomsListScreen() {
  const router = useRouter();
  const list = useServiceListQuery(fetchRoomList, ['roomNumber', 'wing']);

  return (
    <EntityListScreen
      title="Zimmer"
      eyebrow="STATIONÄR · ZIMMER"
      subtitle="Kapazität und Belegung je Zimmer"
      emptyTitle="Keine Zimmer"
      emptyMessage="Es sind noch keine Zimmer angelegt."
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
      onOpen={(item) => router.push(`/stationaer/wohnbereiche/${item.id}` as never)}
      renderMeta={(item) => ({
        primary: item.roomNumber,
        secondary: `${item.wing} · ${item.occupiedBeds}/${item.capacity} Betten`,
        badge: item.status,
      })}
    />
  );
}

/** WP483 — Stationär Belegung (Arbeitsplan 083) */
export function OccupancyListScreen() {
  const list = useServiceListQuery(fetchOccupancyList, ['wing']);

  return (
    <EntityListScreen
      title="Belegung"
      eyebrow="STATIONÄR · BELEGUNG"
      subtitle="Auslastung nach Hausflügel"
      emptyTitle="Keine Belegungsdaten"
      emptyMessage="Es liegen noch keine Belegungsübersichten vor."
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
        primary: item.wing,
        secondary: `${item.occupiedBeds}/${item.totalBeds} Betten belegt`,
        badge: `${item.occupancyPercent} %`,
      })}
    />
  );
}

/** WP484 — Stationär Tagesstruktur (Arbeitsplan 084) */
export function DailyStructureScreen() {
  const list = useServiceListQuery(fetchDailyStructure, ['activity', 'livingArea', 'timeSlot']);

  return (
    <EntityListScreen
      title="Tagesstruktur"
      eyebrow="STATIONÄR · TAGESSTRUKTUR"
      subtitle="Tagesablauf und Zeitslots"
      emptyTitle="Keine Tagesstruktur"
      emptyMessage="Es sind noch keine Tagesabläufe geplant."
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
        primary: `${item.timeSlot} · ${item.activity}`,
        secondary: `${item.livingArea} · ${item.participantCount} Teilnehmende`,
        badge: item.status,
      })}
    />
  );
}

/** WP485 — Stationär Mahlzeiten (Arbeitsplan 085) */
export function MealsPlanningScreen() {
  const list = useServiceListQuery(fetchMealPlans, ['menu', 'mealType', 'dietaryNotes']);

  return (
    <EntityListScreen
      title="Mahlzeiten"
      eyebrow="STATIONÄR · VERPFLEGUNG"
      subtitle="Speisepläne und Diät-Hinweise"
      emptyTitle="Keine Mahlzeiten"
      emptyMessage="Es sind noch keine Speisepläne hinterlegt."
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
        primary: `${item.mealType}: ${item.menu}`,
        secondary: `${item.dietaryNotes} · ${item.residentCount} Bewohner:innen · ${formatDate(item.servedAt)}`,
        badge: item.status,
      })}
    />
  );
}

void fetchRoomList;
