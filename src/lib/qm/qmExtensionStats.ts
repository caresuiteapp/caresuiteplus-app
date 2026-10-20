import { legacyColorsFromPalette, type ColorMode } from '@/design/tokens/themeBridge';

export type QmExtensionKpi = {
  id: string;
  label: string;
  value: string;
  subValue?: string;
  icon?: string;
  accentColor?: string;
};

export function buildQmSettingsKpis(mode: ColorMode = 'dark'): QmExtensionKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'qm-settings-review',
      label: 'Review-Zyklus',
      value: '12 Mon.',
      subValue: 'Verfahrensanweisungen',
      icon: '🔄',
      accentColor: colors.cyan,
    },
    {
      id: 'qm-settings-workflow',
      label: 'Freigabe',
      value: '3 Stufen',
      subValue: 'QMB → PDL → Veröffentlichung',
      icon: '✅',
      accentColor: colors.success,
    },
    {
      id: 'qm-settings-md-token',
      label: 'MD-Token',
      value: '90 Tage',
      subValue: 'Standard-Gültigkeit',
      icon: '🔐',
      accentColor: colors.violet,
    },
  ];
}

export function buildQmAiAssistantKpis(draftCount: number, actionCount: number, mode: ColorMode = 'dark'): QmExtensionKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'qm-ai-drafts',
      label: 'Entwürfe',
      value: String(draftCount),
      subValue: 'Strukturierte Vorschläge',
      icon: '📝',
      accentColor: colors.cyan,
    },
    {
      id: 'qm-ai-actions',
      label: 'Aktionen',
      value: String(actionCount),
      subValue: 'Vordefinierte Prompts',
      icon: '⚡',
      accentColor: colors.amber,
    },
    {
      id: 'qm-ai-mode',
      label: 'Modus',
      value: 'P-READY',
      subValue: 'Kein Live-LLM',
      icon: '🤖',
      accentColor: colors.violet,
    },
  ];
}

export function buildMdAuditCenterKpis(packageCount: number, openCount: number, mode: ColorMode = 'dark'): QmExtensionKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'md-packages',
      label: 'Mappen',
      value: String(packageCount),
      subValue: 'Prüfungsmappen gesamt',
      icon: '📦',
      accentColor: colors.violet,
    },
    {
      id: 'md-open',
      label: 'In Bearbeitung',
      value: String(openCount),
      subValue: 'Noch nicht freigegeben',
      icon: '📋',
      accentColor: colors.orange,
    },
    {
      id: 'md-flow',
      label: 'Workflow',
      value: '5 Schritte',
      subValue: 'Erstellen → Token teilen',
      icon: '🔗',
      accentColor: colors.cyan,
    },
  ];
}

export function buildMdShareViewKpis(documentCount: number, inspectionYear: number, mode: ColorMode = 'dark'): QmExtensionKpi[]  {
  const colors = legacyColorsFromPalette(mode);
  return [
    {
      id: 'md-share-docs',
      label: 'Dokumente',
      value: String(documentCount),
      subValue: 'In dieser Mappe',
      icon: '📄',
      accentColor: colors.cyan,
    },
    {
      id: 'md-share-year',
      label: 'Prüfjahr',
      value: String(inspectionYear),
      subValue: 'MD-Prüfungsmappe',
      icon: '📅',
      accentColor: colors.violet,
    },
    {
      id: 'md-share-access',
      label: 'Zugriff',
      value: 'Token',
      subValue: 'Nur Einsicht — kein Download',
      icon: '👁️',
      accentColor: colors.amber,
    },
  ];
}
