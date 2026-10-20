#!/usr/bin/env node
/**
 * Replaces Einzelseiten bridge Redirect files with dedicated screen imports.
 */
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const appRoot = join(root, 'app');

/** app-relative path (forward slashes) → file body (without export default line if component export) */
const SCREEN_MAP = {
  'business/settings.tsx': `import { QmSettingsScreen } from '@/screens/qm/QmSettingsScreen';\n\nexport default QmSettingsScreen;\n`,
  'business/qm.tsx': `import { QmDashboardScreen } from '@/screens/qm/QmDashboardScreen';\n\nexport default QmDashboardScreen;\n`,
  'business/insight.tsx': `import { InsightIndexScreen } from '@/screens/insight/InsightIndexScreen';\n\nexport default InsightIndexScreen;\n`,
  'business/documents.tsx': `import { OfficeDocumentsListScreen } from '@/screens/office/OfficeDocumentsListScreen';\n\nexport default OfficeDocumentsListScreen;\n`,

  'business/office/clients.tsx': `import { ClientsListScreen } from '@/screens/office/ClientsListScreen';\n\nexport default ClientsListScreen;\n`,
  'business/office/clients/[id]/edit.tsx': `import { ClientEditScreen } from '@/screens/office/ClientEditScreen';\n\nexport default ClientEditScreen;\n`,
  'business/office/clients/[id]/documents.tsx': `import { ClientLegalDocumentsScreen } from '@/screens/business/office/ClientLegalDocumentsScreen';\n\nexport default function ClientDocumentsRoute() {\n  return <ClientLegalDocumentsScreen focus="documents" />;\n}\n`,
  'business/office/clients/[id]/contracts.tsx': `import { ClientLegalDocumentsScreen } from '@/screens/business/office/ClientLegalDocumentsScreen';\n\nexport default function ClientContractsRoute() {\n  return <ClientLegalDocumentsScreen focus="contracts" />;\n}\n`,
  'business/office/clients/[id]/consents.tsx': `import { ClientLegalDocumentsScreen } from '@/screens/business/office/ClientLegalDocumentsScreen';\n\nexport default function ClientConsentsRoute() {\n  return <ClientLegalDocumentsScreen focus="consents" />;\n}\n`,
  'business/office/clients/[id]/stammdaten.tsx': null,
  'business/office/clients/[id]/communication.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="nachrichten" />;\n}\n`,
  'business/office/clients/[id]/service-records.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="nachweise" />;\n}\n`,
  'business/office/clients/[id]/vitals.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="vitalwerte" />;\n}\n`,
  'business/office/clients/[id]/medication.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="medikation" />;\n}\n`,
  'business/office/clients/[id]/medical.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="icd" />;\n}\n`,
  'business/office/clients/[id]/timeline.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="verlauf" />;\n}\n`,
  'business/office/clients/[id]/portal.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="portal" />;\n}\n`,
  'business/office/clients/[id]/modules.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="module" />;\n}\n`,
  'business/office/clients/[id]/billing.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="abrechnung" />;\n}\n`,
  'business/office/clients/[id]/care.tsx': `import { ClientRecordTabScreen } from '@/screens/business/office/ClientRecordTabScreen';\n\nexport default function Route() {\n  return <ClientRecordTabScreen initialTab="pflege" />;\n}\n`,

  'business/office/employees.tsx': `import { EmployeesListScreen } from '@/screens/office/EmployeesListScreen';\n\nexport default EmployeesListScreen;\n`,
  'business/office/employees/new.tsx': `import { EmployeeCreateScreen } from '@/screens/office/EmployeeCreateScreen';\n\nexport default EmployeeCreateScreen;\n`,
  'business/office/employees/[id].tsx': `import { EmployeeDetailScreen } from '@/screens/office/EmployeeDetailScreen';\n\nexport default EmployeeDetailScreen;\n`,
  'business/office/employees/[id]/edit.tsx': `import { EmployeeEditScreen } from '@/screens/office/EmployeeEditScreen';\n\nexport default EmployeeEditScreen;\n`,

  'business/office/documents.tsx': `import { OfficeDocumentsListScreen } from '@/screens/office/OfficeDocumentsListScreen';\n\nexport default OfficeDocumentsListScreen;\n`,
  'business/office/documents/upload.tsx': `import { OfficeDocumentUploadScreen } from '@/screens/office/OfficeDocumentUploadScreen';\n\nexport default OfficeDocumentUploadScreen;\n`,
  'business/office/documents/categories.tsx': `import { CatalogsScreen } from '@/screens/templates/CatalogsScreen';\n\nexport default CatalogsScreen;\n`,
  'business/office/documents/[id].tsx': `import { OfficeDocumentsDetailListScreen } from '@/screens/office/OfficeDocumentsDetailListScreen';\n\nexport default OfficeDocumentsDetailListScreen;\n`,

  'business/office/invoices.tsx': `import { InvoicesListScreen } from '@/screens/office/InvoicesListScreen';\n\nexport default InvoicesListScreen;\n`,
  'business/office/invoices/new.tsx': `import { InvoiceCreateScreen } from '@/screens/office/InvoiceCreateScreen';\n\nexport default InvoiceCreateScreen;\n`,
  'business/office/invoices/[id].tsx': `import { InvoiceDetailScreen } from '@/screens/office/InvoiceDetailScreen';\n\nexport default InvoiceDetailScreen;\n`,
  'business/office/invoices/runs.tsx': `import { OfficeModuleAssignmentListScreen } from '@/screens/business/office/OfficeModuleAssignmentListScreen';\n\nexport default function Route() {\n  return <OfficeModuleAssignmentListScreen section="billing" />;\n}\n`,
  'business/office/invoices/payments.tsx': `import { InvoicesListScreen } from '@/screens/office/InvoicesListScreen';\n\nexport default InvoicesListScreen;\n`,
  'business/office/invoices/dunning.tsx': `import { InvoicesListScreen } from '@/screens/office/InvoicesListScreen';\n\nexport default InvoicesListScreen;\n`,

  'business/office/templates.tsx': `import { TemplateCenterScreen } from '@/screens/templates/TemplateCenterScreen';\n\nexport default TemplateCenterScreen;\n`,
  'business/office/templates/new.tsx': `import { TemplateCreateScreen } from '@/screens/templates/TemplateCreateScreen';\n\nexport default TemplateCreateScreen;\n`,
  'business/office/templates/[id].tsx': `import { TemplateDetailScreen } from '@/screens/templates/TemplateDetailScreen';\n\nexport default TemplateDetailScreen;\n`,
  'business/office/templates/categories.tsx': `import { TemplateCategoriesScreen } from '@/screens/templates/TemplateCategoriesScreen';\n\nexport default TemplateCategoriesScreen;\n`,

  'business/office/qm/manual.tsx': `import { QmHandbookScreen } from '@/screens/qm/QmHandbookScreen';\n\nexport default QmHandbookScreen;\n`,
  'business/office/qm/manual/[id].tsx': `import { QmHandbookChapterScreen } from '@/screens/qm/QmHandbookChapterScreen';\n\nexport default QmHandbookChapterScreen;\n`,
  'business/office/qm/policies.tsx': `import { QmComplianceScreen } from '@/screens/qm/QmComplianceScreen';\n\nexport default QmComplianceScreen;\n`,
  'business/office/qm/audit-packages.tsx': `import { QmAuditsScreen } from '@/screens/qm/QmAuditsScreen';\n\nexport default QmAuditsScreen;\n`,
  'business/office/qm/md-check.tsx': `import { MdAuditCenterScreen } from '@/screens/qm/MdAuditCenterScreen';\n\nexport default MdAuditCenterScreen;\n`,

  'business/office/portals.tsx': `import { AccessManagementDashboardScreen } from '@/screens/office/access/AccessManagementDashboardScreen';\n\nexport default AccessManagementDashboardScreen;\n`,
  'business/office/portals/employees.tsx': `import { EmployeePortalAccountsScreen } from '@/screens/office/access/EmployeePortalAccountsScreen';\n\nexport default EmployeePortalAccountsScreen;\n`,
  'business/office/portals/clients.tsx': `import { ClientPortalCodesScreen } from '@/screens/office/access/ClientPortalCodesScreen';\n\nexport default ClientPortalCodesScreen;\n`,
  'business/office/portals/relatives.tsx': `import { RelativePortalCodesScreen } from '@/screens/office/access/RelativePortalCodesScreen';\n\nexport default RelativePortalCodesScreen;\n`,
  'business/office/portals/access-codes.tsx': `import { CreateEmployeePortalAccountScreen } from '@/screens/office/access/CreateEmployeePortalAccountScreen';\n\nexport default CreateEmployeePortalAccountScreen;\n`,
  'business/office/permissions.tsx': `import { OfficeModulesHubScreen } from '@/screens/business/office/OfficeModulesHubScreen';\n\nexport default OfficeModulesHubScreen;\n`,

  'assist/einsaetze.tsx': `import { AssignmentsListScreen } from '@/screens/assist/AssignmentsListScreen';\n\nexport default AssignmentsListScreen;\n`,
  'assist/einsaetze/new.tsx': `import { AssignmentCreateScreen } from '@/screens/assist/AssignmentCreateScreen';\n\nexport default AssignmentCreateScreen;\n`,
  'assist/einsaetze/[id].tsx': `import { AssignmentDetailScreen } from '@/screens/assist/AssignmentDetailScreen';\n\nexport default AssignmentDetailScreen;\n`,
  'assist/einsaetze/[id]/edit.tsx': `import { AssignmentDetailScreen } from '@/screens/assist/AssignmentDetailScreen';\n\nexport default AssignmentDetailScreen;\n`,
  'assist/durchfuehrung/[id].tsx': `import { AssignmentExecutionScreen } from '@/screens/assist/AssignmentExecutionScreen';\n\nexport default AssignmentExecutionScreen;\n`,
  'assist/aufgaben.tsx': `import { AssignmentsListScreen } from '@/screens/assist/AssignmentsListScreen';\n\nexport default function AssistTasksRoute() {\n  return <AssignmentsListScreen titleOverride="Aufgaben" />;\n}\n`,
  'assist/kalender.tsx': `import { AssistCalendarScreen } from '@/screens/assist/AssistCalendarScreen';\n\nexport default AssistCalendarScreen;\n`,
  'assist/signaturen.tsx': `import { CareRecordsListScreen } from '@/screens/assist/CareRecordsListScreen';\n\nexport default CareRecordsListScreen;\n`,
  'assist/touren.tsx': `import { TripsListScreen } from '@/screens/assist/TripsListScreen';\n\nexport default TripsListScreen;\n`,
  'assist/live-status.tsx': `import { ActiveExecutionsScreen } from '@/screens/assist/ActiveExecutionsScreen';\n\nexport default ActiveExecutionsScreen;\n`,
  'assist/qualitaet.tsx': `import { CareRecordsListScreen } from '@/screens/assist/CareRecordsListScreen';\n\nexport default function AssistQualityRoute() {\n  return <CareRecordsListScreen titleOverride="Qualität / Nachweise" />;\n}\n`,
  'assist/abrechnungsquellen.tsx': `import { OfficeModuleAssignmentListScreen } from '@/screens/business/office/OfficeModuleAssignmentListScreen';\n\nexport default function Route() {\n  return <OfficeModuleAssignmentListScreen section="billing" />;\n}\n`,
  'assist/einstellungen.tsx': `import { AssistIndexScreen } from '@/screens/assist/AssistIndexScreen';\n\nexport default AssistIndexScreen;\n`,

  'pflege/informationssammlung.tsx': `import { SisOverviewScreen } from '@/screens/pflege/SisOverviewScreen';\n\nexport default function InformationssammlungRoute() {\n  return <SisOverviewScreen titleOverride="Informationssammlung" />;\n}\n`,
  'pflege/informationssammlung/new.tsx': `import { SisFormScreen } from '@/screens/pflege/SisFormScreen';\n\nexport default function Route() {\n  return <SisFormScreen mode="create" />;\n}\n`,
  'pflege/informationssammlung/[id].tsx': `import { SisDetailScreen } from '@/screens/pflege/SisDetailScreen';\n\nexport default SisDetailScreen;\n`,
  'pflege/planung.tsx': `import { CarePlansListScreen } from '@/screens/pflege/CarePlansListScreen';\n\nexport default CarePlansListScreen;\n`,
  'pflege/planung/new.tsx': `import { CarePlanCreateScreen } from '@/screens/pflege/CarePlanCreateScreen';\n\nexport default CarePlanCreateScreen;\n`,
  'pflege/planung/[id].tsx': `import { CarePlanDetailScreen } from '@/screens/pflege/CarePlanDetailScreen';\n\nexport default CarePlanDetailScreen;\n`,
  'pflege/planung/[id]/edit.tsx': `import { CarePlanDetailScreen } from '@/screens/pflege/CarePlanDetailScreen';\n\nexport default CarePlanDetailScreen;\n`,
  'pflege/massnahmen.tsx': `import { CarePlansListScreen } from '@/screens/pflege/CarePlansListScreen';\n\nexport default function MassnahmenRoute() {\n  return <CarePlansListScreen titleOverride="Maßnahmen" />;\n}\n`,
  'pflege/berichte.tsx': `import { CareDocumentationListScreen } from '@/screens/pflege/CareDocumentationListScreen';\n\nexport default CareDocumentationListScreen;\n`,
  'pflege/berichte/new.tsx': `import { CareDocumentationListScreen } from '@/screens/pflege/CareDocumentationListScreen';\n\nexport default CareDocumentationListScreen;\n`,
  'pflege/berichte/[id].tsx': `import { CareDocumentationDetailScreen } from '@/screens/pflege/CareDocumentationDetailScreen';\n\nexport default CareDocumentationDetailScreen;\n`,
  'pflege/vitalwerte/new.tsx': `import { VitalReadingCreateScreen } from '@/screens/pflege/VitalReadingCreateScreen';\n\nexport default VitalReadingCreateScreen;\n`,
  'pflege/medikation/new.tsx': `import { MedicationCreateScreen } from '@/screens/pflege/MedicationCreateScreen';\n\nexport default MedicationCreateScreen;\n`,
  'pflege/wunden.tsx': `import { WoundDocumentationListScreen } from '@/screens/pflege/WoundDocumentationListScreen';\n\nexport default WoundDocumentationListScreen;\n`,
  'pflege/wunden/new.tsx': `import { WoundDocumentationListScreen } from '@/screens/pflege/WoundDocumentationListScreen';\n\nexport default WoundDocumentationListScreen;\n`,
  'pflege/wunden/[id].tsx': `import { WoundDocumentationDetailScreen } from '@/screens/pflege/WoundDocumentationDetailScreen';\n\nexport default WoundDocumentationDetailScreen;\n`,
  'pflege/bodymap.tsx': `import { BodyMapScreen } from '@/screens/pflege/BodyMapScreen';\n\nexport default BodyMapScreen;\n`,
  'pflege/risiken.tsx': `import { SisOverviewScreen } from '@/screens/pflege/SisOverviewScreen';\n\nexport default function RisikenRoute() {\n  return <SisOverviewScreen titleOverride="Risiken" />;\n}\n`,
  'pflege/assessments.tsx': `import { SisOverviewScreen } from '@/screens/pflege/SisOverviewScreen';\n\nexport default function AssessmentsRoute() {\n  return <SisOverviewScreen titleOverride="Assessments" />;\n}\n`,
  'pflege/sis/new.tsx': `import { SisFormScreen } from '@/screens/pflege/SisFormScreen';\n\nexport default function Route() {\n  return <SisFormScreen mode="create" />;\n}\n`,
  'pflege/verordnungen.tsx': `import { MedicationListScreen } from '@/screens/pflege/MedicationListScreen';\n\nexport default MedicationListScreen;\n`,
  'pflege/evaluation.tsx': `import { CarePlansListScreen } from '@/screens/pflege/CarePlansListScreen';\n\nexport default function EvaluationRoute() {\n  return <CarePlansListScreen titleOverride="Evaluation" />;\n}\n`,
  'pflege/visiten.tsx': `import { CareDocumentationListScreen } from '@/screens/pflege/CareDocumentationListScreen';\n\nexport default function VisitenRoute() {\n  return <CareDocumentationListScreen titleOverride="Visiten" />;\n}\n`,
  'pflege/uebergaben.tsx': `import { CareDocumentationListScreen } from '@/screens/pflege/CareDocumentationListScreen';\n\nexport default function UebergabenRoute() {\n  return <CareDocumentationListScreen titleOverride="Übergaben" />;\n}\n`,
  'pflege/dienstplaene/new.tsx': `import { ShiftScheduleListScreen } from '@/screens/pflege/ShiftScheduleListScreen';\n\nexport default ShiftScheduleListScreen;\n`,
  'pflege/reports.tsx': `import { PflegeReportsScreen } from '@/screens/pflege/PflegeReportsScreen';\n\nexport default PflegeReportsScreen;\n`,
  'pflege/einstellungen.tsx': `import { PflegeSettingsScreen } from '@/screens/pflege/PflegeSettingsScreen';\n\nexport default PflegeSettingsScreen;\n`,

  'beratung/faelle.tsx': `import { CasesListScreen } from '@/screens/beratung/CasesListScreen';\n\nexport default CasesListScreen;\n`,
  'beratung/faelle/new.tsx': `import { CaseCreateScreen } from '@/screens/beratung/CaseCreateScreen';\n\nexport default CaseCreateScreen;\n`,
  'beratung/faelle/[id].tsx': `import { CaseDetailScreen } from '@/screens/beratung/CaseDetailScreen';\n\nexport default CaseDetailScreen;\n`,
  'beratung/faelle/[id]/edit.tsx': `import { CaseDetailScreen } from '@/screens/beratung/CaseDetailScreen';\n\nexport default CaseDetailScreen;\n`,
  'beratung/erstgespraech.tsx': `import { CaseCreateScreen } from '@/screens/beratung/CaseCreateScreen';\n\nexport default function ErstgespraechRoute() {\n  return <CaseCreateScreen titleOverride="Erstgespräch" />;\n}\n`,
  'beratung/protokolle/new.tsx': `import { CounselingProtocolsScreen } from '@/screens/beratung/CounselingProtocolsScreen';\n\nexport default CounselingProtocolsScreen;\n`,
  'beratung/massnahmen.tsx': `import { CasesListScreen } from '@/screens/beratung/CasesListScreen';\n\nexport default function MassnahmenRoute() {\n  return <CasesListScreen titleOverride="Maßnahmen" />;\n}\n`,
  'beratung/leistungsberatung.tsx': `import { CasesListScreen } from '@/screens/beratung/CasesListScreen';\n\nexport default function LeistungsberatungRoute() {\n  return <CasesListScreen titleOverride="Leistungsberatung" />;\n}\n`,
  'beratung/angehoerige.tsx': `import { CasesListScreen } from '@/screens/beratung/CasesListScreen';\n\nexport default function AngehoerigeRoute() {\n  return <CasesListScreen titleOverride="Angehörige" />;\n}\n`,
  'beratung/kontaktverlauf.tsx': `import { CounselingProtocolsScreen } from '@/screens/beratung/CounselingProtocolsScreen';\n\nexport default function KontaktverlaufRoute() {\n  return <CounselingProtocolsScreen titleOverride="Kontaktverlauf" />;\n}\n`,
  'beratung/berichte.tsx': `import { BeratungReportsScreen } from '@/screens/beratung/BeratungReportsScreen';\n\nexport default BeratungReportsScreen;\n`,
  'beratung/abrechnungsquellen.tsx': `import { OfficeModuleAssignmentListScreen } from '@/screens/business/office/OfficeModuleAssignmentListScreen';\n\nexport default function Route() {\n  return <OfficeModuleAssignmentListScreen section="billing" />;\n}\n`,
  'beratung/einstellungen.tsx': `import { BeratungSettingsScreen } from '@/screens/beratung/BeratungSettingsScreen';\n\nexport default BeratungSettingsScreen;\n`,

  'stationaer/zimmer.tsx': `import { LivingAreasScreen } from '@/screens/stationaer/LivingAreasScreen';\n\nexport default function ZimmerRoute() {\n  return <LivingAreasScreen titleOverride="Zimmer" />;\n}\n`,
  'stationaer/belegung.tsx': `import { LivingAreasScreen } from '@/screens/stationaer/LivingAreasScreen';\n\nexport default function BelegungRoute() {\n  return <LivingAreasScreen titleOverride="Belegung" />;\n}\n`,
  'stationaer/tagesstruktur.tsx': `import { ResidentsListScreen } from '@/screens/stationaer/ResidentsListScreen';\n\nexport default function TagesstrukturRoute() {\n  return <ResidentsListScreen titleOverride="Tagesstruktur" />;\n}\n`,
  'stationaer/mahlzeiten.tsx': `import { ResidentsListScreen } from '@/screens/stationaer/ResidentsListScreen';\n\nexport default function MahlzeitenRoute() {\n  return <ResidentsListScreen titleOverride="Mahlzeiten" />;\n}\n`,
  'stationaer/aktivitaeten.tsx': `import { ResidentsListScreen } from '@/screens/stationaer/ResidentsListScreen';\n\nexport default function AktivitaetenRoute() {\n  return <ResidentsListScreen titleOverride="Aktivitäten" />;\n}\n`,
  'stationaer/uebergabe.tsx': `import { HandoverReportScreen } from '@/screens/stationaer/HandoverReportScreen';\n\nexport default HandoverReportScreen;\n`,
  'stationaer/risiken.tsx': `import { StationaerReportsScreen } from '@/screens/stationaer/StationaerReportsScreen';\n\nexport default function RisikenRoute() {\n  return <StationaerReportsScreen titleOverride="Risiken" />;\n}\n`,
  'stationaer/bewohnerplanung.tsx': `import { ResidentsListScreen } from '@/screens/stationaer/ResidentsListScreen';\n\nexport default function BewohnerplanungRoute() {\n  return <ResidentsListScreen titleOverride="Bewohnerplanung" />;\n}\n`,
  'stationaer/reports.tsx': `import { StationaerReportsScreen } from '@/screens/stationaer/StationaerReportsScreen';\n\nexport default StationaerReportsScreen;\n`,
  'stationaer/einstellungen.tsx': `import { StationaerSettingsScreen } from '@/screens/stationaer/StationaerSettingsScreen';\n\nexport default StationaerSettingsScreen;\n`,

  'akademie/kurse.tsx': `import { CoursesListScreen } from '@/screens/akademie/CoursesListScreen';\n\nexport default CoursesListScreen;\n`,
  'akademie/kurse/new.tsx': `import { CourseCreateScreen } from '@/screens/akademie/CourseCreateScreen';\n\nexport default CourseCreateScreen;\n`,
  'akademie/kurse/[id].tsx': `import { CourseDetailScreen } from '@/screens/akademie/CourseDetailScreen';\n\nexport default CourseDetailScreen;\n`,
  'akademie/lektionen.tsx': `import { CoursesListScreen } from '@/screens/akademie/CoursesListScreen';\n\nexport default function LektionenRoute() {\n  return <CoursesListScreen titleOverride="Lektionen" />;\n}\n`,
  'akademie/teilnehmende.tsx': `import { EnrollmentsScreen } from '@/screens/akademie/EnrollmentsScreen';\n\nexport default EnrollmentsScreen;\n`,
  'akademie/pruefungen.tsx': `import { CoursesListScreen } from '@/screens/akademie/CoursesListScreen';\n\nexport default function PruefungenRoute() {\n  return <CoursesListScreen titleOverride="Prüfungen" />;\n}\n`,
  'akademie/pflichtschulungen.tsx': `import { CoursesListScreen } from '@/screens/akademie/CoursesListScreen';\n\nexport default function PflichtschulungenRoute() {\n  return <CoursesListScreen titleOverride="Pflichtschulungen" />;\n}\n`,
  'akademie/schulungsplan.tsx': `import { CoursesListScreen } from '@/screens/akademie/CoursesListScreen';\n\nexport default function SchulungsplanRoute() {\n  return <CoursesListScreen titleOverride="Schulungsplan" />;\n}\n`,
  'akademie/mediathek.tsx': `import { CoursesListScreen } from '@/screens/akademie/CoursesListScreen';\n\nexport default function MediathekRoute() {\n  return <CoursesListScreen titleOverride="Mediathek" />;\n}\n`,
  'akademie/dozenten.tsx': `import { EnrollmentsScreen } from '@/screens/akademie/EnrollmentsScreen';\n\nexport default function DozentenRoute() {\n  return <EnrollmentsScreen titleOverride="Dozent:innen" />;\n}\n`,
  'akademie/fortschritt.tsx': `import { EnrollmentsScreen } from '@/screens/akademie/EnrollmentsScreen';\n\nexport default function FortschrittRoute() {\n  return <EnrollmentsScreen titleOverride="Fortschritt" />;\n}\n`,
  'akademie/reports.tsx': `import { AkademieReportsScreen } from '@/screens/akademie/AkademieReportsScreen';\n\nexport default AkademieReportsScreen;\n`,
  'akademie/einstellungen.tsx': `import { AkademieSettingsScreen } from '@/screens/akademie/AkademieSettingsScreen';\n\nexport default AkademieSettingsScreen;\n`,
};

function walk(dir, files = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

function toRelative(filePath) {
  return filePath.replace(appRoot + '\\', '').replace(appRoot + '/', '').replace(/\\/g, '/');
}

let replaced = 0;
let skipped = 0;
const missing = [];

for (const file of walk(appRoot)) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes('EinzelseitenBridgeRoute')) continue;
  const rel = toRelative(file);
  const body = SCREEN_MAP[rel];
  if (!body) {
    missing.push(rel);
    continue;
  }
  writeFileSync(file, body, 'utf8');
  replaced += 1;
}

console.log(`Replaced ${replaced} bridge routes`);
if (missing.length) {
  console.log(`Missing mappings (${missing.length}):`);
  for (const m of missing) console.log(`  ${m}`);
  process.exit(1);
}

const remaining = walk(appRoot).filter((f) => readFileSync(f, 'utf8').includes('EinzelseitenBridgeRoute'));
console.log(`Remaining bridges: ${remaining.length}`);
if (remaining.length) {
  for (const f of remaining) console.log(`  ${toRelative(f)}`);
  process.exit(1);
}
