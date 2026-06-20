import type { ActiveExecutionItem, ExecutionPhase } from '@/types/modules/assist';

export type ExecutionListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

function isToday(iso: string): boolean {
  const date = new Date(iso);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

export function buildExecutionListKpis(items: ActiveExecutionItem[]): ExecutionListKpi[] {
  const ready = items.filter((item) => item.phase === 'pending').length;
  const active = items.filter(
    (item) => item.phase === 'checked_in' || item.phase === 'in_progress',
  ).length;
  const today = items.filter((item) => isToday(item.scheduledStart)).length;
  const completed = items.filter((item) => item.phase === 'completed').length;

  return [
    {
      id: 'execution-kpi-ready',
      label: 'Bereit',
      value: ready,
      subValue: ready > 0 ? 'Check-in möglich' : 'Keine wartend',
      icon: '✅',
      accentColor: '#FF9500',
    },
    {
      id: 'execution-kpi-active',
      label: 'Aktiv',
      value: active,
      subValue: `${items.length} gesamt`,
      icon: '🚀',
      accentColor: '#4ADE80',
    },
    {
      id: 'execution-kpi-today',
      label: 'Heute',
      value: today,
      subValue: completed > 0 ? `${completed} abgeschlossen` : 'Zeiterfassung',
      icon: '📅',
      accentColor: '#62F3FF',
    },
  ];
}

export const EXECUTION_PHASE_LABELS: Record<ExecutionPhase, string> = {
  pending: 'Bereit',
  checked_in: 'Eingecheckt',
  in_progress: 'Läuft',
  completed: 'Abgeschlossen',
  cancelled: 'Abgebrochen',
};
