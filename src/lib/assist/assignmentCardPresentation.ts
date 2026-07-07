import type { AssignmentListItem } from '@/types/modules/assist';
import {
  ASSIGNMENT_STATUS_LABELS,
  type AssignmentStatus,
} from '@/types/modules/assignmentStatus';
import { remoteStatusToAssignment } from '@/lib/assist/assignmentStatusBridge';
import { assignmentStatusToDimensions, isVisitIncomplete } from '@/lib/assist/visitWorkflow';
import {
  VISIT_BILLING_STATUS_LABELS,
  type VisitBillingStatus,
  type VisitDocumentationStatus,
  type VisitExecutionStatus,
  type VisitProofStatus,
} from '@/lib/assist/visitTypes';
import { getDemoAssignmentSeedById } from '@/data/demo/assistAssignments';
import { demoClients } from '@/data/demo/clients';

export type AssignmentCardAccent = {
  color: string;
  tint: string;
  label: string;
};

const BADGE_VARIANT_BY_ASSIGNMENT_STATUS: Record<
  AssignmentStatus,
  AssignmentCardBadge['variant']
> = {
  geplant: 'muted',
  bestaetigt: 'cyan',
  unterwegs: 'orange',
  angekommen: 'orange',
  gestartet: 'green',
  pausiert: 'orange',
  beendet: 'muted',
  dokumentation_offen: 'orange',
  unterschrift_offen: 'orange',
  abgeschlossen: 'green',
  storniert: 'red',
  nicht_erschienen: 'red',
};

const ACCENT_BY_ASSIGNMENT_STATUS: Partial<Record<AssignmentStatus, AssignmentCardAccent>> = {
  geplant: { color: '#F97316', tint: 'rgba(249, 115, 22, 0.08)', label: 'Geplant' },
  bestaetigt: { color: '#3B82F6', tint: 'rgba(59, 130, 246, 0.08)', label: 'Bestätigt' },
  unterwegs: { color: '#3B82F6', tint: 'rgba(59, 130, 246, 0.08)', label: 'Unterwegs' },
  angekommen: { color: '#3B82F6', tint: 'rgba(59, 130, 246, 0.08)', label: 'Angekommen' },
  gestartet: { color: '#3B82F6', tint: 'rgba(59, 130, 246, 0.08)', label: 'Gestartet' },
  pausiert: { color: '#F97316', tint: 'rgba(249, 115, 22, 0.08)', label: 'Pausiert' },
  beendet: { color: '#F97316', tint: 'rgba(249, 115, 22, 0.08)', label: 'Beendet' },
  dokumentation_offen: {
    color: '#F97316',
    tint: 'rgba(249, 115, 22, 0.08)',
    label: 'Dokumentation offen',
  },
  unterschrift_offen: {
    color: '#F97316',
    tint: 'rgba(249, 115, 22, 0.08)',
    label: 'Unterschrift offen',
  },
  abgeschlossen: { color: '#22C55E', tint: 'rgba(34, 197, 94, 0.08)', label: 'Abgeschlossen' },
  storniert: { color: '#EF4444', tint: 'rgba(239, 68, 68, 0.08)', label: 'Storniert' },
  nicht_erschienen: { color: '#EF4444', tint: 'rgba(239, 68, 68, 0.08)', label: 'Nicht erschienen' },
};

const DEFAULT_ACCENT: AssignmentCardAccent = {
  color: '#94A3B8',
  tint: 'rgba(148, 163, 184, 0.08)',
  label: 'Unbekannt',
};

export function resolveAssignmentListItemStatus(assignment: AssignmentListItem): AssignmentStatus {
  if (assignment.assignmentStatus) return assignment.assignmentStatus;
  return remoteStatusToAssignment(assignment.status);
}

export type AssignmentCardBadge = {
  assignmentStatus: AssignmentStatus;
  label: string;
  variant: 'green' | 'orange' | 'red' | 'cyan' | 'muted' | 'purple';
};

export function resolveAssignmentCardBadge(assignment: AssignmentListItem): AssignmentCardBadge {
  const assignmentStatus = resolveAssignmentListItemStatus(assignment);
  return {
    assignmentStatus,
    label: ASSIGNMENT_STATUS_LABELS[assignmentStatus],
    variant: BADGE_VARIANT_BY_ASSIGNMENT_STATUS[assignmentStatus],
  };
}

export function resolveAssignmentCardAccent(assignment: AssignmentListItem): AssignmentCardAccent {
  const assignmentStatus = resolveAssignmentListItemStatus(assignment);
  return (
    ACCENT_BY_ASSIGNMENT_STATUS[assignmentStatus] ?? {
      ...DEFAULT_ACCENT,
      label: ASSIGNMENT_STATUS_LABELS[assignmentStatus] ?? assignmentStatus,
    }
  );
}

/** Enrich list items with canonical status and disposition dimensions for card rendering. */
export function enrichAssignmentListItem(item: AssignmentListItem): AssignmentListItem {
  const assignmentStatus = item.assignmentStatus ?? remoteStatusToAssignment(item.status);
  const dims = assignmentStatusToDimensions(assignmentStatus);
  const executionStatus =
    (item.executionStatus as VisitExecutionStatus | undefined) ?? dims.execution;
  const documentationStatus =
    (item.documentationStatus as VisitDocumentationStatus | undefined) ?? dims.documentation;
  const proofStatus = (item.proofStatus as VisitProofStatus | undefined) ?? dims.proof;
  const billingStatus = (item.billingStatus as VisitBillingStatus | undefined) ?? dims.billing;
  const isIncomplete =
    item.isIncomplete ??
    isVisitIncomplete({
      documentationStatus,
      proofStatus,
      executionStatus,
    });

  return {
    ...item,
    assignmentStatus,
    executionStatus,
    documentationStatus,
    planningStatus: item.planningStatus ?? dims.planning,
    proofStatus,
    billingStatus,
    isIncomplete,
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
  return assignment.internalPhotoReferences?.length ?? 0;
}

function resolveDocumentationState(assignment: AssignmentListItem): {
  status: VisitDocumentationStatus;
  complete: boolean;
  open: boolean;
} {
  const assignmentStatus = resolveAssignmentListItemStatus(assignment);
  const enriched = enrichAssignmentListItem(assignment);
  const status =
    (enriched.documentationStatus as VisitDocumentationStatus | undefined) ??
    assignmentStatusToDimensions(assignmentStatus).documentation;
  const complete = status === 'complete';
  const open =
    assignmentStatus === 'dokumentation_offen' ||
    assignmentStatus === 'beendet' ||
    status === 'open' ||
    (assignment.isIncomplete === true && !complete);
  return { status, complete, open };
}

function resolveSignatureState(assignment: AssignmentListItem): {
  proof: VisitProofStatus;
  satisfied: boolean;
  open: boolean;
} {
  const assignmentStatus = resolveAssignmentListItemStatus(assignment);
  const enriched = enrichAssignmentListItem(assignment);
  const proof =
    (enriched.proofStatus as VisitProofStatus | undefined) ??
    assignmentStatusToDimensions(assignmentStatus).proof;
  const satisfied = proof === 'signed' || proof === 'verified';
  const open =
    assignmentStatus === 'unterschrift_offen' ||
    proof === 'pending' ||
    proof === 'none' ||
    (assignment.isIncomplete === true && !satisfied);
  return { proof, satisfied, open };
}

export function buildAssignmentFooterChips(assignment: AssignmentListItem): AssignmentFooterChip[] {
  const enriched = enrichAssignmentListItem(assignment);
  const billing = (enriched.billingStatus as VisitBillingStatus) ?? 'none';
  const budgetOk =
    billing === 'ready' || billing === 'paid' || billing === 'invoiced' || billing === 'preview';
  const documentation = resolveDocumentationState(enriched);
  const signature = resolveSignatureState(enriched);

  return [
    {
      id: 'budget',
      label: budgetOk ? 'Budget OK' : (VISIT_BILLING_STATUS_LABELS[billing] ?? 'Budget'),
      variant: budgetOk ? 'green' : billing === 'blocked' ? 'red' : 'muted',
    },
    {
      id: 'docs',
      label: documentation.complete
        ? 'Dokumentation'
        : documentation.open
          ? 'Dokumentation offen'
          : 'Dokumentation',
      variant: documentation.complete ? 'green' : documentation.open ? 'orange' : 'muted',
    },
    {
      id: 'signature',
      label: signature.satisfied ? 'Unterschrift' : 'Unterschrift offen',
      variant: signature.satisfied ? 'green' : signature.open ? 'orange' : 'muted',
    },
    {
      id: 'attachments',
      label: `Anhänge ${resolveAttachmentCount(enriched)}`,
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
