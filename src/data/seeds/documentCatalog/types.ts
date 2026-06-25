export type DocumentLayoutKind = 'premium' | 'din5008' | 'table' | 'list' | 'form';

export type DocumentLayoutFamily =
  | 'contract'
  | 'service_proof'
  | 'invoice'
  | 'dunning'
  | 'client_master'
  | 'employee_form'
  | 'shift_plan'
  | 'tour_plan'
  | 'care_clinical'
  | 'consultation'
  | 'academy_certificate'
  | 'vehicle_log'
  | 'assist_visit'
  | 'incident'
  | 'checklist'
  | 'generic_form';

export type DocumentCatalogEntry = {
  templateNumber: number;
  templateKey: string;
  name: string;
  shortName: string;
  category: string;
  subcategory?: string;
  moduleScope: string[];
  layoutKind: DocumentLayoutKind;
  layoutFamily: DocumentLayoutFamily;
  templateType: string;
  isAssistAllowed: boolean;
  isMedicalOrTreatmentRelated: boolean;
  isCareRelated?: boolean;
  targetRecordType: string;
  defaultStorageArea: string;
  builderKey: string;
  requiredFields?: Array<{ fieldKey: string; label: string; dataPath: string }>;
  manualFields?: Array<{ fieldKey: string; label: string; fieldType?: string }>;
};

export type BuiltDocumentCatalogTemplate = DocumentCatalogEntry & {
  htmlTemplate: string;
  cssTemplate: string;
  description: string;
};
