import type { SecurityDetail, SecurityHubSnapshot, SecurityListItem } from '@/types/security';
import { DEMO_TENANT_ID } from '@/data/demo/tenant';

export const SECURITY_DEMO_TENANT = DEMO_TENANT_ID;

export const securityDemoList: SecurityListItem[] = [
  {
    id: 'sec-001',
    tenantId: SECURITY_DEMO_TENANT,
    title: 'AV-Vertrag mit Subprozessor prüfen',
    category: 'dsgvo',
    severity: 'warning',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-11T11:00:00.000Z',
  },
  {
    id: 'sec-002',
    tenantId: SECURITY_DEMO_TENANT,
    title: 'RLS-Policy Audit Mandantentrennung',
    category: 'access',
    severity: 'critical',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-10T16:45:00.000Z',
  },
  {
    id: 'sec-003',
    tenantId: SECURITY_DEMO_TENANT,
    title: 'Dashboard-Ladezeit > 2s (P95)',
    category: 'performance',
    severity: 'info',
    status: 'in_bearbeitung',
    updatedAt: '2026-06-09T08:20:00.000Z',
  },
];

const securityDetails: Record<string, SecurityDetail> = {
  'sec-001': {
    ...securityDemoList[0],
    summary: 'Neuer OCR-Subprozessor benötigt aktualisierten AV-Vertrag.',
    remediation: 'Rechtliche Prüfung anstoßen und Dokumentation in DMS ablegen.',
    owner: 'Datenschutz',
    dueDate: '2026-06-20',
  },
  'sec-002': {
    ...securityDemoList[1],
    summary: 'Stichprobe zeigt fehlende tenant_id-Filter in einer Demo-Query.',
    remediation: 'Repository-Layer prüfen, RLS-Migration 0008 anwenden.',
    owner: 'Platform Team',
    dueDate: '2026-06-15',
  },
  'sec-003': {
    ...securityDemoList[2],
    summary: 'Business-Dashboard P95 bei 2.4s — Ziel < 2.0s.',
    remediation: 'KPI-Aggregation cachen, Lazy-Load für Aktivitätsfeed.',
    owner: 'Performance',
    dueDate: '2026-06-25',
    performanceMs: 2400,
  },
};

export function getSecurityHubSnapshot(): SecurityHubSnapshot {
  return {
    tenantId: SECURITY_DEMO_TENANT,
    dsgvoScorePercent: 82,
    openFindings: securityDemoList.filter((s) => s.status !== 'abgeschlossen').length,
    performanceKpis: [
      { id: 'p1', label: 'API P95 (ms)', value: 420, subValue: 'Ziel < 500', icon: '⚡', accentColor: '#62F3FF' },
      { id: 'p2', label: 'Screen TTI (ms)', value: 1800, subValue: 'Ziel < 2000', icon: '📱', accentColor: '#FFB020' },
    ],
    kpis: [
      { id: 'k1', label: 'DSGVO-Score', value: '82%', subValue: '4 offene Tasks', icon: '🛡️', accentColor: '#22C55E' },
      { id: 'k2', label: 'Kritische Findings', value: 1, subValue: 'sofort bearbeiten', icon: '⚠️', accentColor: '#EF4444' },
    ],
    generatedAt: new Date().toISOString(),
  };
}

export function getSecurityDetail(id: string): SecurityDetail | null {
  return securityDetails[id] ?? null;
}

export function createSecurityFinding(
  title: string,
  category: SecurityListItem['category'],
): { id: string } {
  const id = `sec-${Date.now().toString(36)}`;
  const item: SecurityListItem = {
    id,
    tenantId: SECURITY_DEMO_TENANT,
    title: title.trim(),
    category,
    severity: 'warning',
    status: 'entwurf',
    updatedAt: new Date().toISOString(),
  };
  securityDemoList.unshift(item);
  securityDetails[id] = {
    ...item,
    summary: 'Neues Security/DSGVO-Finding — Details ergänzen.',
    remediation: 'Maßnahme definieren und Verantwortliche zuweisen.',
    owner: 'Unzugewiesen',
    dueDate: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
  };
  return { id };
}
