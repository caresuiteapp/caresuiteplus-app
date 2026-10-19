import type { EntityId, ISODateTime } from '@/types/core/base';

export type ClientServiceInterruptionKind = 'hospital' | 'rehabilitation' | 'vacation' | 'other';

export const CLIENT_SERVICE_INTERRUPTION_LABELS: Record<ClientServiceInterruptionKind, string> = {
  hospital: 'Krankenhausaufenthalt',
  rehabilitation: 'Reha / Kurzzeitpflege',
  vacation: 'Urlaub / Abwesenheit',
  other: 'Andere vorübergehende Unterbrechung',
};

export type ClientServiceInterruption = Readonly<{
  id: EntityId;
  requestId: EntityId;
  tenantId: EntityId;
  clientId: EntityId;
  kind: ClientServiceInterruptionKind;
  reason: string;
  plannedStartAt: ISODateTime;
  plannedEndAt: ISODateTime | null;
  actualStartAt: ISODateTime;
  actualEndAt: ISODateTime | null;
  endReason: string | null;
  status: 'active' | 'ended';
  affectedVisitCount: number;
  affectedTourStopCount: number;
  blockedStartedVisitCount: number;
  clientUpdatedAt: ISODateTime;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}>;

export type ClientServiceContinuitySummary = Readonly<{
  clientName: string;
  clientUpdatedAt: ISODateTime;
  active: ClientServiceInterruption | null;
  history: readonly ClientServiceInterruption[];
}>;

