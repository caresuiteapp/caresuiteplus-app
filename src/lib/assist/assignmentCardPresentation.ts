import type { AssignmentListItem } from '@/types/modules/assist';
import type { WorkflowStatus } from '@/types';
import { WORKFLOW_STATUS_LABELS } from '@/types/workflow/status';
import {
  VISIT_BILLING_STATUS_LABELS,
  type VisitBillingStatus,
  type VisitProofStatus,
} from '@/lib/assist/visitTypes';
import { getDemoAssignmentSeedById } from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';

export type AssignmentCardAccent = {
  color: string;
  tint: string;
  label: string;
};

const ACCENT_BY_STATUS: Partial<Record<WorkflowStatus, AssignmentCardAccent>> = {
  abgeschlossen: { color: '#22C55E', tint: 'rgba(34, 197, 94, 0.08)', label: 'Abgeschlossen' },
  entwurf: { color: '#F97316', tint: 'rgba(249, 115, 22, 0.08)', label: 'Entwurf' },
  aktiv: { color: '#3B82F6', tint: 'rgba(59, 130, 246, 0.08)', label: 'Aktiv' },
  in_bearbeitung: { color: '#3B82F6', tint: 'rgba(59, 130, 246, 0.08)', label: 'Aktiv' },
  fehlerhaft: { color: '#EF4444', tint: 'rgba(239, 68, 68, 0.08)', label: 'Problem' },
  gesperrt: { color: '#EF4444', tint: 'rgba(239, 68, 68, 0.08)', label: 'Problem' },
  archiviert: { color: '#64748B', tint: 'rgba(100, 116, 139, 0.08)', label: 'Archiviert' },
};

const DEFAULT_ACCENT: AssignmentCardAccent = {
  color: '#94A3B8',
  tint: 'rgba(148, 163, 184, 0.08)',
  label: 'Unbekannt',
};

export function resolveAssignmentCardAccent(status: WorkflowStatus): AssignmentCardAccent {
  return ACCENT_BY_STATUS[status] ?? {
    ...DEFAULT_ACCENT,
    label: WORKFLOW_STATUS_LABELS[status] ?? status,
  };
}

export function resolveSgbReference(assignment: AssignmentListItem): string {
  const name = `${assignment.serviceName ?? ''} ${assignment.title}`.trim();
  const match = name.match(/§\s*\d+[a-z]?\s*SGB\s*(XI|V|XII)/i);
  if (match) return match[0].replace(/\s+/g, ' ');
  if (/entlastung|45b/i.test(name)) return '§ 45b SGB XI';
  if (/verhinderung|§\s*39/i.test(name)) return '§ 39 SGB XI';
  if (/haushalt|38/i.test(name)) return '§ 38 SGB V';
  if (/beratung|7a/i.test(name)) return '§ 7a SGB XI';
  return 'SGB XI';
}

export type AssignmentFooterChip = {
  id: string;
  label: string;
  variant: 'green' | 'orange' | 'red' | 'muted' | 'cyan';
};

export function resolveAttachmentCount(assignment: AssignmentListItem): number {
  const hash = assignment.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return hash % 4;
}

export function buildAssignmentFooterChips(assignment: AssignmentListItem): AssignmentFooterChip[] {
  const proof = (assignment.proofStatus as VisitProofStatus) ?? 'none';
  const billing = (assignment.billingStatus as VisitBillingStatus) ?? 'none';
  const budgetOk =
    billing === 'ready' || billing === 'paid' || billing === 'invoiced' || billing === 'preview';
  const docComplete = proof === 'verified' || proof === 'signed';
  const hasSignature = proof === 'signed' || proof === 'verified';

  return [
    {
      id: 'budget',
      label: budgetOk ? 'Budget OK' : (VISIT_BILLING_STATUS_LABELS[billing] ?? 'Budget'),
      variant: budgetOk ? 'green' : billing === 'blocked' ? 'red' : 'muted',
    },
    {
      id: 'docs',
      label: docComplete ? 'Dokumentation' : assignment.isIncomplete ? 'Doku offen' : 'Dokumentation',
      variant: docComplete ? 'green' : assignment.isIncomplete ? 'orange' : 'muted',
    },
    {
      id: 'signature',
      label: hasSignature ? 'Unterschrift' : 'Unterschrift offen',
      variant: hasSignature ? 'green' : 'muted',
    },
    {
      id: 'attachments',
      label: `Anhänge ${resolveAttachmentCount(assignment)}`,
      variant: 'cyan',
    },
  ];
}

export type AssignmentCardHoverDetails = {
  address: string;
  phone: string | null;
  careLevel: string | null;
  birthdayHint: string | null;
  notes: string | null;
  lastDocumentation: string | null;
};

export function resolveAssignmentCardHoverDetails(
  assignment: AssignmentListItem,
): AssignmentCardHoverDetails {
  const seed = getDemoAssignmentSeedById(assignment.id);
  const client = demoClients.find((entry) => {
    const fullName = `${entry.firstName} ${entry.lastName}`;
    return fullName === assignment.clientName;
  });

  return {
    address: assignment.location || '—',
    phone: client ? `030 ${1000 + (client.id.length * 137) % 9000}` : null,
    careLevel: client?.careLevel ?? null,
    birthdayHint: client ? `Geburtstag: ${client.firstName}` : null,
    notes: seed?.notes ?? null,
    lastDocumentation: assignment.updatedAt
      ? `Zuletzt ${new Date(assignment.updatedAt).toLocaleDateString('de-DE')}`
      : null,
  };
}

export function resolveTravelTimeMinutes(assignment: AssignmentListItem): number | null {
  const hash = assignment.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return 8 + (hash % 25);
}
