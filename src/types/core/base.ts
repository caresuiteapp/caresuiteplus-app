export type ISODateTime = string;
export type EntityId = string;

export type WorkflowStatus =
  | 'entwurf'
  | 'aktiv'
  | 'in_bearbeitung'
  | 'abgeschlossen'
  | 'archiviert'
  | 'fehlerhaft'
  | 'gesperrt';

export type TenantScopedEntity = {
  id: EntityId;
  tenantId: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
