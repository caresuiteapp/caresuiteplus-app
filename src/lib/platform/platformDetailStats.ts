import type { AiJobListItem, OcrJobListItem } from '@/types/modules/platform';
import { AI_JOB_TYPE_LABELS } from '@/types/modules/platform';
import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type PlatformDetailKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

function formatShortDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function buildOcrJobDetailKpis(job: OcrJobListItem, mode: ColorMode = 'dark'): PlatformDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'document',
      label: 'Dokument',
      value: job.sourceDocumentTitle.length > 24 ? `${job.sourceDocumentTitle.slice(0, 24)}…` : job.sourceDocumentTitle,
      subValue: job.sourceDocumentId,
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'confidence',
      label: 'Konfidenz',
      value: job.confidence != null ? `${Math.round(job.confidence * 100)}%` : '—',
      subValue: job.providerKey,
      icon: '🎯',
      accentColor: job.confidence != null && job.confidence >= 0.9 ? colors.success : colors.amber,
    },
    {
      id: 'completed',
      label: 'Abgeschlossen',
      value: formatShortDate(job.completedAt),
      subValue: job.extractedText ? 'Text extrahiert' : 'Kein Text',
      icon: '⏱️',
      accentColor: colors.violet,
    },
  ];
}

export function buildAiJobDetailKpis(job: AiJobListItem, mode: ColorMode = 'dark'): PlatformDetailKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'type',
      label: 'Job-Typ',
      value: AI_JOB_TYPE_LABELS[job.jobType],
      subValue: job.providerKey,
      icon: '🤖',
      accentColor: colors.violet,
    },
    {
      id: 'prompt',
      label: 'Prompt',
      value: job.promptSummary.length > 28 ? `${job.promptSummary.slice(0, 28)}…` : job.promptSummary,
      icon: '💬',
      accentColor: colors.cyan,
    },
    {
      id: 'completed',
      label: 'Abgeschlossen',
      value: formatShortDate(job.completedAt),
      subValue: job.resultSummary ? 'Ergebnis vorhanden' : 'Ausstehend',
      icon: '⏱️',
      accentColor: job.resultSummary ? colors.success : colors.amber,
    },
  ];
}
