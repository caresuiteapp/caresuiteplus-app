import type { TrackingDashboard } from '@/types/modules/assist';

export type TrackingListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildTrackingKpis(data: TrackingDashboard): TrackingListKpi[] {
  const insideGeofence = data.positions.filter((p) => p.insideGeofence).length;
  const outsideGeofence = data.positions.length - insideGeofence;

  return [
    {
      id: 'tracking-kpi-active',
      label: 'Aktive Fahrten',
      value: data.activeTrips,
      subValue: data.activeTrips > 0 ? 'Unterwegs' : 'Keine aktiv',
      icon: '🚗',
      accentColor: '#FF9500',
    },
    {
      id: 'tracking-kpi-on-route',
      label: 'Unterwegs',
      value: data.employeesOnRoute,
      subValue: `${insideGeofence} im Gebiet`,
      icon: '📍',
      accentColor: '#62F3FF',
    },
    {
      id: 'tracking-kpi-geofence',
      label: 'Geofence heute',
      value: data.geofenceAlertsToday,
      subValue: outsideGeofence > 0 ? `${outsideGeofence} außerhalb` : 'Alles im Gebiet',
      icon: '🔔',
      accentColor: '#F87171',
    },
  ];
}
