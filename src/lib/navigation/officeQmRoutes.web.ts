import type { BreadcrumbTrail } from '@/types/navigation/breadcrumbs';

const QM_ROOT = '/business/office/qm';
const titles: Readonly<Record<string, string>> = {
  handbook: 'QM-Handbuch', manual: 'QM-Handbuch', documents: 'QM-Dokumente',
  compliance: 'Compliance', policies: 'Compliance', audits: 'Audits',
  'audit-packages': 'Audits', measures: 'Maßnahmen', changes: 'Änderungen',
  'legal-references': 'Rechtsgrundlagen', 'md-audit': 'MD-Prüfungsmappen',
  'md-check': 'MD-Prüfcheck', templates: 'QM-Vorlagen', exports: 'QM-Export',
  'ai-assistant': 'QM-Assistent', settings: 'QM-Einstellungen',
};

function qmLocation(location: string) {
  const path = location.split(/[?#]/, 1)[0].replace(/\/+$/, '');
  if (path === '/business/qm') return { path, parts: [] as string[] };
  const match = path.match(/^\/(?:business\/)?office\/qm(?:\/(.*))?$/);
  return match ? { path, parts: match[1]?.split('/') ?? [] } : null;
}

export function officeQmRouteTitle(location: string): string | null {
  const resolved = qmLocation(location);
  if (!resolved) return null;
  const { parts } = resolved;
  if (parts.length === 0) return 'Qualitätsmanagement';
  if (parts.length === 1) return Object.hasOwn(titles, parts[0]) ? titles[parts[0]] : null;
  if (parts.length === 2 && parts[1]) {
    if (parts[0] === 'handbook' || parts[0] === 'manual') return 'Handbuchkapitel';
    if (parts[0] === 'documents') return 'QM-Dokument';
    if (parts[0] === 'md-audit') return 'MD-Prüfungsmappe';
  }
  return null;
}

export function officeQmBreadcrumbs(location: string): BreadcrumbTrail | null {
  const resolved = qmLocation(location), title = officeQmRouteTitle(location);
  if (!resolved || !title) return null;
  const isRoot = resolved.parts.length === 0;
  return [
    { path: '/Desktop', label: 'Desktop' },
    { path: '/office', label: 'Office' },
    { path: QM_ROOT, label: 'Qualitätsmanagement', isCurrent: isRoot },
    ...(resolved.parts.length === 2
      ? [{ path: `${QM_ROOT}/${resolved.parts[0]}`, label: titles[resolved.parts[0]] }] : []),
    ...(!isRoot ? [{ path: resolved.path, label: title, isCurrent: true }] : []),
  ];
}
