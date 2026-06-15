import type { AppointmentDetail } from '@/types/modules/appointmentDetail';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type AppointmentDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function durationMinutes(startsAt: string, endsAt: string): number {
  const ms = new Date(endsAt).getTime() - new Date(startsAt).getTime();
  return Math.max(0, Math.round(ms / 60_000));
}

export function buildAppointmentDetailKpis(appointment: AppointmentDetail, mode: ColorMode = 'dark'): AppointmentDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const duration = durationMinutes(appointment.startsAt, appointment.endsAt);

  return [
    {
      id: 'datetime',
      label: 'Termin',
      value: formatShortDate(appointment.startsAt),
      subValue: `${formatTime(appointment.startsAt)} – ${formatTime(appointment.endsAt)}`,
      icon: '🗓️',
      accentColor: colors.violet,
    },
    {
      id: 'duration',
      label: 'Dauer',
      value: String(duration),
      subValue: duration === 1 ? 'Minute' : 'Minuten',
      icon: '⏱️',
      accentColor: colors.amber,
    },
    {
      id: 'client',
      label: 'Klient:in',
      value: appointment.clientName,
      subValue: appointment.location ?? undefined,
      icon: '👤',
      accentColor: colors.orange,
    },
    {
      id: 'employee',
      label: 'Mitarbeitende:r',
      value: appointment.employeeName ?? '—',
      icon: '🧑‍⚕️',
      accentColor: colors.cyan,
    },
  ];
}
