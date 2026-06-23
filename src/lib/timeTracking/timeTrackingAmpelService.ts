import type {
  AmpelEvaluation,
  TimeActivityEvent,
  TimeEntry,
  TimeInactivityCheck,
  TimeWarning,
  TrafficLight,
} from '@/types/modules/timeTracking';

export function evaluateTrafficLight(input: {
  workdayId: string;
  tenantId: string;
  activityEvents: TimeActivityEvent[];
  inactivityChecks: TimeInactivityCheck[];
  entries: TimeEntry[];
  warnings: TimeWarning[];
}): AmpelEvaluation {
  const activityEventCount = input.activityEvents.filter(
    (e) => e.eventType === 'navigation' || e.eventType === 'module_open' || e.eventType === 'form_save',
  ).length;
  const inactivityCheckCount = input.inactivityChecks.length;
  const unclearBlockCount = input.entries.filter((e) => e.isUnclear).length;
  const warningCount = input.warnings.length;
  const timedOutChecks = input.inactivityChecks.filter((c) => c.status === 'timed_out' || c.status === 'unclear');

  const reasons: string[] = [];
  let trafficLight: TrafficLight = 'green';

  if (unclearBlockCount > 0) {
    trafficLight = 'yellow';
    reasons.push(`${unclearBlockCount} unklare Zeitblöcke`);
  }

  if (warningCount >= 3) {
    trafficLight = 'red';
    reasons.push(`${warningCount} Hinweise am Tag`);
  } else if (warningCount > 0 && trafficLight === 'green') {
    trafficLight = 'yellow';
    reasons.push(`${warningCount} Hinweise`);
  }

  if (timedOutChecks.length > 0) {
    trafficLight = trafficLight === 'red' ? 'red' : 'yellow';
    reasons.push(`${timedOutChecks.length} Inaktivitätsprüfungen ohne klare Antwort`);
  }

  if (activityEventCount === 0 && input.entries.some((e) => (e.netMinutes ?? 0) > 30)) {
    if (trafficLight === 'green') trafficLight = 'yellow';
    reasons.push('Lange erfasste Zeit ohne CareSuite+-Aktivitätssignale');
  }

  if (reasons.length === 0) {
    reasons.push('Nachvollziehbare Aktivitätssignale und klare Zeitblöcke');
  }

  return {
    trafficLight,
    reasons,
    activityEventCount,
    inactivityCheckCount,
    unclearBlockCount,
    warningCount,
  };
}
