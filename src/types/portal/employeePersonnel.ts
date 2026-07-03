import type { PersonnelUiTabKey } from '@/lib/office/employeePersonnelLabels';

export type { PersonnelUiTabKey as PortalEmployeeProfileTabKey };

export type PortalProfileField = {
  label: string;
  value: string;
};

export type PortalProfileQualificationItem = {
  id: string;
  title: string;
  statusLabel: string;
  validUntil: string | null;
  typeLabel: string | null;
};

export type PortalProfileDocumentItem = {
  id: string;
  title: string;
  fileName: string;
  validUntil: string | null;
  categoryLabel: string;
};

export type PortalProfileWorkMaterialItem = {
  id: string;
  itemName: string;
  statusLabel: string;
  issuedAt: string | null;
  returnDueAt: string | null;
  categoryLabel: string;
};

export type PortalProfileHistoryItem = {
  id: string;
  summary: string;
  occurredAt: string;
};

export type PortalEmployeePersonnelView = {
  overview: PortalProfileField[];
  masterData: PortalProfileField[];
  contact: PortalProfileField[];
  employment: PortalProfileField[];
  compensation: PortalProfileField[];
  taxSocial: PortalProfileField[];
  secondaryEmployment: PortalProfileField[];
  roles: PortalProfileField[];
  qualifications: PortalProfileQualificationItem[];
  documents: PortalProfileDocumentItem[];
  portal: PortalProfileField[];
  deployability: PortalProfileField[];
  workMaterials: PortalProfileWorkMaterialItem[];
  history: PortalProfileHistoryItem[];
};
