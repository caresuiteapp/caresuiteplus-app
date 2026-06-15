import type { FollowUp, Protocol } from '@/types/modules/beratung';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type ProtocolDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildProtocolDetailKpis(protocol: Protocol & { caseSubject: string }, mode: ColorMode = 'dark'): ProtocolDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const recordedDate = new Date(protocol.recordedAt).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return [
    {
      id: 'case',
      label: 'Fall',
      value: protocol.caseSubject.length > 22 ? `${protocol.caseSubject.slice(0, 22)}…` : protocol.caseSubject,
      subValue: protocol.caseId,
      icon: '📋',
      accentColor: colors.cyan,
    },
    {
      id: 'recorded',
      label: 'Protokolliert',
      value: recordedDate,
      subValue: protocol.visibility,
      icon: '📄',
      accentColor: colors.violet,
    },
    {
      id: 'sensitivity',
      label: 'Sensibilität',
      value: protocol.sensitivity,
      icon: '🔒',
      accentColor: colors.amber,
    },
  ];
}

export type FollowUpDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildFollowUpDetailKpis(followUp: FollowUp, mode: ColorMode = 'dark'): FollowUpDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  const dueDate = new Date(followUp.dueAt);
  const daysUntil = Math.ceil((dueDate.getTime() - Date.now()) / 86_400_000);

  return [
    {
      id: 'case',
      label: 'Fall',
      value: followUp.caseSubject.length > 22 ? `${followUp.caseSubject.slice(0, 22)}…` : followUp.caseSubject,
      subValue: followUp.caseId,
      icon: '📋',
      accentColor: colors.cyan,
    },
    {
      id: 'due',
      label: 'Fällig',
      value: dueDate.toLocaleDateString('de-DE'),
      subValue: daysUntil <= 0 ? 'Überfällig' : daysUntil === 1 ? 'Morgen' : `In ${daysUntil} Tagen`,
      icon: '🔔',
      accentColor: daysUntil <= 2 ? colors.danger : colors.orange,
    },
    {
      id: 'assignee',
      label: 'Zuständig',
      value: followUp.assigneeName.split(' ')[0] ?? followUp.assigneeName,
      subValue: followUp.assigneeName,
      icon: '👤',
      accentColor: colors.violet,
    },
  ];
}
