/** Systemkatalog-Schlüssel (Spec 17.1–17.47) */
export type SystemCatalogKey =
  | 'leistungsart'
  | 'client_status'
  | 'salutation'
  | 'gender'
  | 'marital_status'
  | 'housing_form'
  | 'contact_method'
  | 'contact_relationship'
  | 'contact_role'
  | 'care_level'
  | 'care_level_status'
  | 'billing_type'
  | 'cost_bearer_type'
  | 'module_assignment'
  | 'assist_services'
  | 'care_services'
  | 'consulting_types'
  | 'stationary_areas'
  | 'room_status'
  | 'meal_form'
  | 'document_category'
  | 'document_source'
  | 'document_status'
  | 'consent_type'
  | 'contract_type'
  | 'signature_role'
  | 'home_access'
  | 'key_status'
  | 'pets'
  | 'mobility'
  | 'orientation'
  | 'communication'
  | 'risk_type'
  | 'risk_level'
  | 'vital_type'
  | 'vital_unit'
  | 'medication_form'
  | 'medication_unit'
  | 'intake_time'
  | 'intake_schedule'
  | 'prescription_type'
  | 'support_tasks'
  | 'preferred_visit_times'
  | 'billing_status'
  | 'portal_status'
  | 'communication_channel'
  | 'timeline_event_type';

export type SystemCatalogEntry = {
  key: string;
  label: string;
  description?: string;
  sortOrder?: number;
};

export type SystemCatalog = {
  key: SystemCatalogKey;
  label: string;
  entries: SystemCatalogEntry[];
};

export type SystemCatalogOption = {
  value: string;
  label: string;
};
