import type {
  WfmDeviationAmpel,
  WfmDeviationDirection,
  WfmDeviationEvaluation,
  WfmDeviationPhase,
} from '@/types/modules/wfmOfficeTimekeeping';

export const WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH = 10;

const AMPEL_SEVERITY: Record<WfmDeviationAmpel, number> = {
  green: 0,
  yellow: 1,
  red: 2,
  blue: 3,
};

function absMinutesBetween(a: Date, b: Date): number {
  return Math.round(Math.abs(a.getTime() - b.getTime()) / 60_000);
}

function resolveDirection(planned: Date, actual: Date): WfmDeviationDirection {
  const diffMs = actual.getTime() - planned.getTime();
  if (Math.abs(diffMs) <= 60_000) return 'on_time';
  return diffMs < 0 ? 'too_early' : 'too_late';
}

export function resolveAmpelFromDeviationMinutes(minutes: number): WfmDeviationAmpel {
  if (minutes <= 5) return 'green';
  if (minutes <= 10) return 'yellow';
  if (minutes <= 20) return 'red';
  return 'blue';
}

export function evaluateVisitTimeDeviation(
  plannedAt: string | null | undefined,
  actualAt: string | null | undefined,
  phase: WfmDeviationPhase,
): WfmDeviationEvaluation {
  if (!plannedAt || !actualAt) {
    return {
      ampel: 'green',
      deviationMinutes: 0,
      direction: 'unknown',
      plannedAt: plannedAt ?? null,
      actualAt: actualAt ?? null,
      requiresJustification: false,
      blocksUntilJustification: false,
      noPlannedTime: !plannedAt,
    };
  }

  const planned = new Date(plannedAt);
  const actual = new Date(actualAt);
  if (Number.isNaN(planned.getTime()) || Number.isNaN(actual.getTime())) {
    return {
      ampel: 'green',
      deviationMinutes: 0,
      direction: 'unknown',
      plannedAt,
      actualAt,
      requiresJustification: false,
      blocksUntilJustification: false,
      noPlannedTime: false,
    };
  }

  const deviationMinutes = absMinutesBetween(planned, actual);
  const ampel = resolveAmpelFromDeviationMinutes(deviationMinutes);
  const direction = resolveDirection(planned, actual);
  const requiresJustification = ampel === 'red' || ampel === 'blue';
  const blocksUntilJustification = requiresJustification;

  return {
    ampel,
    deviationMinutes,
    direction,
    plannedAt,
    actualAt,
    requiresJustification,
    blocksUntilJustification,
    noPlannedTime: false,
  };
}

export function combineDeviationAmpel(
  startAmpel: WfmDeviationAmpel | null | undefined,
  endAmpel: WfmDeviationAmpel | null | undefined,
): WfmDeviationAmpel | null {
  if (!startAmpel && !endAmpel) return null;
  const start = startAmpel ?? 'green';
  const end = endAmpel ?? 'green';
  return AMPEL_SEVERITY[start] >= AMPEL_SEVERITY[end] ? start : end;
}

export function validateDeviationJustification(text: string | null | undefined): string | null {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) return 'Bitte geben Sie eine Begründung an.';
  if (trimmed.length < WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH) {
    return `Die Begründung muss mindestens ${WFM_DEVIATION_JUSTIFICATION_MIN_LENGTH} Zeichen haben.`;
  }
  return null;
}

export function formatDeviationDirectionLabel(
  direction: WfmDeviationDirection,
  phase: WfmDeviationPhase,
): string {
  if (direction === 'on_time') return 'Im Toleranzbereich';
  if (direction === 'unknown') return '—';
  if (phase === 'start') {
    return direction === 'too_early' ? 'Zu früh gestartet' : 'Zu spät gestartet';
  }
  return direction === 'too_early' ? 'Zu früh beendet' : 'Zu spät beendet';
}

export function shouldAutoPendingReview(
  startAmpel: WfmDeviationAmpel | null,
  endAmpel: WfmDeviationAmpel | null,
): boolean {
  const overall = combineDeviationAmpel(startAmpel, endAmpel);
  return overall === 'red' || overall === 'blue';
}
