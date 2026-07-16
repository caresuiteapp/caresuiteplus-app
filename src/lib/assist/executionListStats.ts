import type { ActiveExecutionItem, ExecutionPhase } from '@/types/modules/assist';

export type ExecutionListKpi = {
  id: string;
  label: string;
  value: number;
  subValue?: string;
  icon: string;
  accentColor: string;
};

export function buildExecutionListKpis(items: ActiveExecutionItem[]): ExecutionListKpi[] {
  const completed = items.filter((item) => item.phase === 'completed').length;
  const followUp = items.filter((item) => item.phase !== 'completed' && item.phase !== 'cancelled').length;
  const signatures = items.filter((item) => item.proofStatus === 'none' || item.proofStatus === 'pending').length;
  const corrections = items.filter((item) => item.requiresTimeCorrection).length;
  const errors = items.filter((item) => item.hasError || item.phase === 'cancelled').length;
  return [
    { id: 'execution-kpi-due', label: 'Fällig gesamt', value: items.length, subValue: `${completed} abgeschlossen`, icon: '✓', accentColor: '#FF9500' },
    { id: 'execution-kpi-follow-up', label: 'Nachbearbeitung offen', value: followUp, subValue: `${signatures} Unterschriften offen`, icon: '!', accentColor: '#4ADE80' },
    { id: 'execution-kpi-corrections', label: 'Zeitkorrekturen', value: corrections, subValue: `${errors} Fehlerfälle`, icon: '⌚', accentColor: '#62F3FF' },
  ];
}

export const EXECUTION_PHASE_LABELS: Record<ExecutionPhase, string> = {
  pending: 'Nachbearbeitung erforderlich',
  checked_in: 'Dokumentation / Unterschrift offen',
  in_progress: 'Zeitkorrektur erforderlich',
  completed: 'Abgeschlossen',
  cancelled: 'Fehlerhaft / storniert',
};
