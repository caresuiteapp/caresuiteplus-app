import type { CareSuiteTemplate, CatalogEntry, TemplateCategory } from '@/types/templates';
import { GLOBAL_STATUS_CATALOGS } from '../catalogs/globalStatuses';
import { EMPLOYEE_OFFICE_CATALOGS } from '../catalogs/employeeOffice';
import { EMPLOYEE_PAYROLL_CATALOGS } from '../catalogs/employeePayroll';
import { DOCUMENT_CATEGORY_CATALOGS } from '../catalogs/documentCategories';
import { UPLOAD_CATEGORY_CATALOGS } from '../catalogs/uploadCategories';
import { OFFICE_TEMPLATES } from '../modules/officeTemplates';
import { ASSIST_TEMPLATES } from '../modules/assistTemplates';
import { PFLEGE_TEMPLATES } from '../modules/pflegeTemplates';
import { STATIONAER_TEMPLATES } from '../modules/stationaerTemplates';
import { BERATUNG_TEMPLATES } from '../modules/beratungTemplates';
import { AKADEMIE_TEMPLATES } from '../modules/akademieTemplates';
import { COMMUNICATION_TEMPLATES } from '../modules/communicationTemplates';
import { BILLING_TEMPLATES } from '../modules/billingTemplates';
import { CARE_RECORD_TEMPLATES } from '../modules/careRecordTemplates';
import { PORTAL_TEMPLATES } from '../modules/portalTemplates';
import { TI_TEMPLATES } from '../modules/tiTemplates';
import { REPORTING_TEMPLATES } from '../modules/reportingTemplates';
import { QM_TEMPLATES } from '../modules/qmTemplates';
import { SEED_TIMESTAMP } from '../helpers';

/** Legacy-Kataloge aus erstem Paket F Seed (SIS, Risiko, Kurs, etc.) */
import { batchCat } from '../helpers';

const LEGACY_CATALOGS = [
  ...batchCat('task_category', 'assist', 'cat-task', [
    { key: 'haushalt', label: 'Haushalt' },
    { key: 'waesche', label: 'Wäsche' },
    { key: 'einkauf', label: 'Einkauf' },
    { key: 'koerperpflege', label: 'Körperpflege' },
    { key: 'begleitung', label: 'Begleitung' },
  ]),
  ...batchCat('sis_topic', 'pflege', 'cat-sis', [
    { key: 'mobilitaet', label: 'Mobilität' },
    { key: 'kognition', label: 'Kognition' },
    { key: 'selbstversorgung', label: 'Selbstversorgung' },
  ]),
  ...batchCat('care_risk_type', 'pflege', 'cat-risk', [
    { key: 'sturz', label: 'Sturzrisiko' },
    { key: 'dekubitus', label: 'Dekubitusrisiko' },
  ]),
  ...batchCat('counseling_topic', 'beratung', 'cat-counsel', [
    { key: 'pflegegrad', label: 'Pflegegrad' },
    { key: 'entlastung', label: 'Entlastungsleistungen' },
  ]),
  ...batchCat('academy_course_type', 'akademie', 'cat-acad', [
    { key: 'mandatory', label: 'Pflichtschulung' },
    { key: 'advanced', label: 'Fortbildung' },
  ]),
  ...batchCat('consent_type', 'office', 'cat-consent', [
    { key: 'datenschutz', label: 'Datenschutz' },
    { key: 'foto', label: 'Foto-Einwilligung' },
  ]),
  ...batchCat('billing_item_type', 'billing', 'cat-bill', [
    { key: 'sgb_xi', label: 'SGB XI Leistung' },
    { key: 'privat', label: 'Privatleistung' },
  ]),
  ...batchCat('message_category', 'communication', 'cat-msg-cat', [
    { key: 'intern', label: 'Intern' },
    { key: 'portal', label: 'Portal' },
    { key: 'angehoerige', label: 'Angehörige' },
  ]),
];

export const SYSTEM_TEMPLATE_CATEGORIES: TemplateCategory[] = [
  { id: 'tcat-office-001', tenantId: null, key: 'office_docs', label: 'Office Dokumente', moduleKey: 'office', sortOrder: 1, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'tcat-pflege-001', tenantId: null, key: 'sis', label: 'SIS', moduleKey: 'pflege', sortOrder: 1, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'tcat-beratung-001', tenantId: null, key: 'protokolle', label: 'Protokolle', moduleKey: 'beratung', sortOrder: 1, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'tcat-assist-001', tenantId: null, key: 'assist_tasks', label: 'Assist Aufgaben', moduleKey: 'assist', sortOrder: 1, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
  { id: 'tcat-billing-001', tenantId: null, key: 'billing', label: 'Abrechnung', moduleKey: 'billing', sortOrder: 1, createdAt: SEED_TIMESTAMP, updatedAt: SEED_TIMESTAMP },
];

export function getAllSystemTemplates(): CareSuiteTemplate[] {
  return [
    ...OFFICE_TEMPLATES,
    ...ASSIST_TEMPLATES,
    ...PFLEGE_TEMPLATES,
    ...STATIONAER_TEMPLATES,
    ...BERATUNG_TEMPLATES,
    ...AKADEMIE_TEMPLATES,
    ...COMMUNICATION_TEMPLATES,
    ...BILLING_TEMPLATES,
    ...CARE_RECORD_TEMPLATES,
    ...PORTAL_TEMPLATES,
    ...TI_TEMPLATES,
    ...REPORTING_TEMPLATES,
    ...QM_TEMPLATES,
  ];
}

export function getAllCatalogEntries(): CatalogEntry[] {
  return [
    ...GLOBAL_STATUS_CATALOGS,
    ...EMPLOYEE_OFFICE_CATALOGS,
    ...EMPLOYEE_PAYROLL_CATALOGS,
    ...DOCUMENT_CATEGORY_CATALOGS,
    ...UPLOAD_CATEGORY_CATALOGS,
    ...LEGACY_CATALOGS,
  ];
}

/** Klont Systemvorlagen/Kataloge für Demo-Mandanten-Initialisierung. */
export function seedDefaultTemplatesForTenant(tenantId: string): {
  templates: CareSuiteTemplate[];
  catalogEntries: CatalogEntry[];
} {
  const now = new Date().toISOString();
  const templates = getAllSystemTemplates().map((t) => ({
    ...t,
    id: `${t.id}-tenant-${tenantId.slice(0, 8)}`,
    tenantId,
    scope: 'tenant' as const,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now,
  }));
  const catalogEntries = getAllCatalogEntries().map((e) => ({
    ...e,
    id: `${e.id}-tenant-${tenantId.slice(0, 8)}`,
    tenantId,
    isSystem: false,
    createdAt: now,
    updatedAt: now,
  }));
  return { templates, catalogEntries };
}

/** @deprecated Use getAllSystemTemplates() */
export const SYSTEM_TEMPLATES = getAllSystemTemplates();

/** @deprecated Use getAllCatalogEntries() */
export const SYSTEM_CATALOG_ENTRIES = getAllCatalogEntries();
