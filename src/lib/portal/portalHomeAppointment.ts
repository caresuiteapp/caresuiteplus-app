import type { PortalAppointmentItem } from './appointmentService';

const ACTIVE_STATUSES = new Set([
  'unterwegs',
  'angekommen',
  'gestartet',
  'pausiert',
  'beendet',
  'dokumentation_offen',
  'unterschrift_offen',
]);

const TERMINAL_STATUSES = new Set(['abgeschlossen', 'storniert', 'nicht_erschienen']);

function timestamp(value: string): number | null {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Selects the one appointment that deserves the portal-home focus card.
 * Historical, completed visits must never shadow an active or upcoming visit.
 */
export function selectPortalHomeAppointment(
  appointments: PortalAppointmentItem[],
  now = new Date(),
): PortalAppointmentItem | null {
  const nowMs = now.getTime();
  const activeGraceStart = nowMs - 12 * 60 * 60 * 1_000;

  const candidates = appointments
    .map((appointment) => {
      const startMs = timestamp(appointment.startsAt);
      const endMs = timestamp(appointment.endsAt);
      if (startMs == null || endMs == null) return null;

      const status = appointment.assignmentStatus ?? appointment.status;
      const incomplete = appointment.assignmentIncomplete === true;
      const active = ACTIVE_STATUSES.has(status);
      const terminal = TERMINAL_STATUSES.has(status);

      if (terminal && !incomplete) return null;
      if (!incomplete && !active && endMs < nowMs) return null;
      if (!incomplete && active && endMs < activeGraceStart) return null;

      return {
        appointment,
        priority: incomplete ? 0 : active ? 1 : 2,
        distance: startMs >= nowMs ? startMs - nowMs : nowMs - startMs,
      };
    })
    .filter(
      (
        candidate,
      ): candidate is {
        appointment: PortalAppointmentItem;
        priority: number;
        distance: number;
      } => candidate != null,
    )
    .sort((a, b) => a.priority - b.priority || a.distance - b.distance);

  return candidates[0]?.appointment ?? null;
}

type EmployeePortalAppointmentTitleSource = {
  clientName?: string | null;
};

/** Employee cards show operational context, never billing/budget terminology. */
export function employeePortalHomeAppointmentTitle(
  appointment: EmployeePortalAppointmentTitleSource,
): string {
  const clientName = appointment.clientName?.trim();
  return clientName ? `Einsatz bei ${clientName}` : 'Nächster Einsatz';
}
