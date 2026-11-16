export const WOUND_RECORD_TABS = [
  { key: 'overview', label: 'Verlauf', icon: 'activity' },
  { key: 'findings', label: 'Befunde und Versorgung', icon: 'clipboard' },
  { key: 'measurement', label: 'Wundfotos und Vermessung', icon: 'camera' },
  { key: 'bodymap', label: 'Körperkarte', icon: 'crosshair' },
  { key: 'risk', label: 'Dekubitusprophylaxe', icon: 'shield' },
  { key: 'anamnesis', label: 'Stammdaten', icon: 'user' },
  { key: 'diabetic_foot', label: 'Diabetischer Fuß', icon: 'heart' },
  { key: 'tracheostomy', label: 'Tracheostomie', icon: 'list' },
  { key: 'coordination', label: 'Abstimmung', icon: 'message-square' },
  { key: 'material', label: 'Material und Kosten', icon: 'package' },
  { key: 'export', label: 'Dokumentation und Ausgabe', icon: 'download' },
] as const;

export type WoundRecordTab = typeof WOUND_RECORD_TABS[number]['key'];

export function initialWoundTab(value: unknown): WoundRecordTab {
  return WOUND_RECORD_TABS.find(tab => tab.key === value)?.key ?? 'overview';
}

export function woundCaseRoute(id: string, area: WoundRecordTab = 'overview') {
  const path = `/pflege/wunden/${id}`;
  return area === 'overview' ? path : `${path}?bereich=${area}`;
}
