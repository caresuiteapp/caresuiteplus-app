import type { PermissionKey, RolePermissionMap } from '@/types/permissions';
import type { RoleKey } from '@/types';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'office.access': 'Office-Modul öffnen',
  'office.clients.view': 'Klient:innen ansehen',
  'office.clients.create': 'Klient:innen anlegen',
  'office.clients.edit': 'Stammdaten bearbeiten',
  'office.clients.status_change': 'Status ändern',
  'office.clients.archive': 'Klient:innen archivieren',
  'office.clients.delete': 'Klient:innen löschen',
  'office.clients.view_sensitive': 'Sensible Gesundheitsdaten einsehen',
  'office.clients.manage_consents': 'Portal-Freigaben verwalten',
  'office.clients.manage_contacts': 'Kontakte & Angehörige verwalten',
  'office.invoices.view': 'Rechnungen ansehen',
  'office.invoices.create': 'Rechnungen anlegen',
  'office.invoices.status_change': 'Rechnungsstatus ändern',
  'office.budgets.view': 'Budgets ansehen',
  'office.documents.view': 'Office-Dokumente ansehen',
  'office.messages.view': 'Office-Nachrichten ansehen',
  'office.employees.view': 'Mitarbeitende ansehen',
  'office.appointments.view': 'Termine ansehen',
  'assist.access': 'Assist-Modul öffnen',
  'assist.assignments.view': 'Einsätze ansehen',
  'assist.assignments.manage': 'Einsätze verwalten',
  'assist.execution.view': 'Einsatzdurchführung ansehen',
  'assist.execution.manage': 'Check-in/Check-out durchführen',
  'assist.records.view': 'Leistungsnachweise ansehen',
  'assist.records.create': 'Nachweise anlegen',
  'assist.records.sign': 'Nachweise unterschreiben',
  'assist.records.export': 'PDF-Nachweise exportieren',
  'assist.trips.view': 'Fahrtenbuch ansehen',
  'assist.trips.manage': 'Fahrten abschließen',
  'assist.tracking.view': 'Live-Tracking ansehen',
  'pflege.access': 'Pflege-Modul öffnen',
  'pflege.plans.view': 'Pflegepläne ansehen',
  'pflege.vitals.view': 'Vitalwerte ansehen',
  'beratung.access': 'Beratung-Modul öffnen',
  'beratung.cases.view': 'Beratungsfälle ansehen',
  'akademie.access': 'Akademie-Modul öffnen',
  'akademie.courses.view': 'Kurse ansehen',
  'stationaer.access': 'Stationär-Modul öffnen',
  'stationaer.residents.view': 'Bewohner:innen ansehen',
  'business.modules.manage': 'Module verwalten',
  'business.tenant.manage': 'Mandant & Organisation verwalten',
  'dashboard.view': 'Dashboard ansehen',
  'portal.employee.appointments.view': 'Eigene Einsätze ansehen',
  'portal.employee.messages.view': 'Portal-Nachrichten ansehen',
  'portal.employee.messages.reply': 'Auf Nachrichten antworten',
  'portal.employee.documents.view': 'Freigegebene Dokumente ansehen',
  'portal.employee.documents.download': 'Dokumente herunterladen',
  'portal.employee.profile.view': 'Eigenes Profil ansehen',
  'portal.employee.timesheet.view': 'Zeiterfassung ansehen',
  'portal.client.appointments.view': 'Eigene Termine ansehen',
  'portal.client.messages.view': 'Portal-Nachrichten ansehen',
  'portal.client.messages.reply': 'Auf Nachrichten antworten',
  'portal.client.documents.view': 'Freigegebene Dokumente ansehen',
  'portal.client.documents.download': 'Dokumente herunterladen',
  'portal.client.profile.view': 'Eigenes Profil ansehen',
  'portal.client.careplan.view': 'Pflegeplan einsehen',
  'portal.client.appointments.request_change': 'Terminänderung anfragen',
  'business.subscription.view': 'Abonnement ansehen',
  'business.subscription.manage': 'Abonnement verwalten',
  'business.reporting.view': 'Reporting & PDL-Cockpit ansehen',
  'business.reporting.create': 'Berichte anlegen',
  'release.view': 'Release & Deployment ansehen',
  'release.manage': 'Release & Deployment verwalten',
  'security.view': 'Security & DSGVO ansehen',
  'security.manage': 'Security & DSGVO verwalten',
  'qa.view': 'QA & Pilotbetrieb ansehen',
  'qa.manage': 'QA & Pilotbetrieb verwalten',
  'roadmap.view': 'Roadmap & Markteintritt ansehen',
  'roadmap.manage': 'Roadmap & Markteintritt verwalten',
  'office.employees.create': 'Mitarbeitende anlegen',
  'office.employees.edit': 'Mitarbeitende bearbeiten',
  'office.employees.delete': 'Mitarbeitende löschen',
  'office.employees.view_sensitive': 'Sensible Mitarbeiter:innen-Daten einsehen',
  'tenant.settings.csv.view': 'CSV Import/Export ansehen',
  'tenant.settings.csv.import.clients': 'Klient:innen per CSV importieren',
  'tenant.settings.csv.export.clients': 'Klient:innen als CSV exportieren',
  'tenant.settings.csv.import.employees': 'Mitarbeiter:innen per CSV importieren',
  'tenant.settings.csv.export.employees': 'Mitarbeiter:innen als CSV exportieren',
  'tenant.settings.csv.logs.view': 'Import-/Exportprotokolle einsehen',
  'tenant.settings.csv.templates.download': 'CSV-Vorlagen herunterladen',
  'office.catalogs.view': 'Kataloge ansehen',
  'office.catalogs.edit': 'Kataloge bearbeiten',
  'office.catalogs.create': 'Kataloge anlegen',
  'office.catalogs.update': 'Kataloge aktualisieren',
  'office.catalogs.deactivate': 'Kataloge deaktivieren',
  'office.catalogs.restore': 'Kataloge wiederherstellen',
  'office.catalogs.copy_system': 'Systemkataloge kopieren',
  'office.templates.view': 'Vorlagen ansehen',
  'office.templates.create': 'Vorlagen anlegen',
  'office.templates.update': 'Vorlagen bearbeiten',
  'office.templates.activate': 'Vorlagen aktivieren',
  'office.templates.archive': 'Vorlagen archivieren',
  'office.templates.version_view': 'Vorlagenversionen ansehen',
  'office.templates.bindings_manage': 'Vorlagen-Bindings verwalten',
  'settings.templates.view': 'Dokumentvorlagen (Settings) ansehen',
  'settings.templates.create': 'Dokumentvorlagen anlegen',
  'settings.templates.update': 'Dokumentvorlagen bearbeiten',
  'settings.templates.delete': 'Dokumentvorlagen löschen',
  'settings.templates.deactivate': 'Dokumentvorlagen deaktivieren',
  'settings.templates.copy': 'Dokumentvorlagen kopieren',
  'settings.templates.publish': 'Dokumentvorlagen veröffentlichen',
  'settings.templates.version': 'Dokumentvorlagen versionieren',
  'settings.templates.mapping': 'Feldmapping verwalten',
  'settings.templates.layout': 'Dokument-Layouts verwalten',
  'settings.templates.send_settings': 'Versandeinstellungen verwalten',
  'settings.templates.audit': 'Vorlagen-Audit einsehen',
  'documents.preview': 'Dokumentvorschau',
  'documents.create': 'Dokumente erstellen',
  'documents.edit_draft': 'Dokumententwürfe bearbeiten',
  'documents.finalize': 'Dokumente finalisieren',
  'documents.pdf_create': 'PDF erzeugen',
  'documents.download': 'Dokumente herunterladen',
  'documents.email_send': 'Dokumente per E-Mail senden',
  'documents.fax_send': 'Dokumente per Fax senden',
  'documents.save_to_file': 'Dokumente in Akte speichern',
  'documents.archive': 'Dokumente archivieren',
  'documents.delete_draft': 'Dokumententwürfe löschen',
  'assist.assignment.use_templates': 'Einsatzvorlagen nutzen',
  'assist.documentation.use_quick_blocks': 'Dokumentationsbausteine nutzen',
  'assist.intake.use_templates': 'Neuaufnahme-Vorlagen nutzen',
  'platform.ocr.view': 'OCR-Jobs ansehen',
  'platform.ocr.manage': 'OCR-Jobs verwalten',
  'platform.ai.view': 'KI-Jobs ansehen',
  'platform.ai.manage': 'KI-Jobs verwalten',
  'integrations.view': 'Integrationen ansehen',
  'integrations.manage': 'Integrationen verwalten',
  'integrations.outbox.view': 'Outbox ansehen',
  'ti.view': 'Telematikinfrastruktur ansehen',
  'ti.admin': 'TI-Administration',
  'ti.kim.view': 'KIM-Postfach ansehen',
  'ti.kim.manage': 'KIM-Nachrichten verwalten',
  'ti.consent.manage': 'TI-Einwilligungen verwalten',
  'ti.audit.view': 'TI-Audit-Log ansehen',
  'ti.provider.manage': 'TI-Provider verwalten',
  'ti.egk.view': 'eGK-Daten ansehen',
  'ti.epa.view': 'ePA-Zugriff ansehen',
  'ti.emp.view': 'eMP-Medikationsplan ansehen',
  'ti.erezept.view': 'E-Rezept ansehen',
  'communication.view_center': 'Kommunikationszentrum ansehen',
  'communication.create_thread': 'Kommunikations-Threads anlegen',
  'communication.send_message': 'Nachrichten senden',
  'communication.send_internal_note': 'Interne Notizen senden',
  'communication.edit_own_message': 'Eigene Nachrichten bearbeiten',
  'communication.edit_any_message': 'Alle Nachrichten bearbeiten',
  'communication.delete_own_message': 'Eigene Nachrichten löschen',
  'communication.delete_any_message': 'Alle Nachrichten löschen',
  'communication.archive_thread': 'Threads archivieren',
  'communication.restore_thread': 'Threads wiederherstellen',
  'communication.assign_thread': 'Nachrichten zuordnen',
  'communication.manage_participants': 'Teilnehmer verwalten',
  'communication.upload_attachment': 'Anhänge hochladen',
  'communication.send_voice_message': 'Sprachnachrichten senden',
  'communication.view_client_threads': 'Klient:innen-Threads ansehen',
  'communication.view_employee_threads': 'Mitarbeitenden-Threads ansehen',
  'communication.view_relative_threads': 'Angehörigen-Threads ansehen',
  'communication.view_internal_threads': 'Interne Threads ansehen',
  'communication.view_deleted_messages': 'Gelöschte Nachrichten ansehen',
  'communication.export_messages': 'Nachrichten exportieren',
  'communication.manage_settings': 'Kommunikationseinstellungen verwalten',
  'qm.view': 'Qualitätsmanagement ansehen',
  'qm.manage_handbook': 'QM-Handbuch verwalten',
  'qm.create_document': 'QM-Dokumente anlegen',
  'qm.edit_document': 'QM-Dokumente bearbeiten',
  'qm.approve_document': 'QM-Dokumente freigeben',
  'qm.archive_document': 'QM-Dokumente archivieren',
  'qm.view_versions': 'QM-Versionen ansehen',
  'qm.manage_legal_references': 'Rechtsgrundlagen verwalten',
  'qm.manage_compliance': 'Compliance-Anforderungen verwalten',
  'qm.create_audit': 'Audits anlegen',
  'qm.close_audit': 'Audits abschließen',
  'qm.create_measure': 'Maßnahmen anlegen',
  'qm.close_measure': 'Maßnahmen abschließen',
  'qm.use_ai_assistant': 'QM-KI-Assistent nutzen',
  'qm.create_md_package': 'MD-Prüfungsmappe erstellen',
  'qm.approve_md_package': 'MD-Mappe freigeben',
  'qm.share_md_package': 'MD-Mappe teilen',
  'qm.revoke_md_package': 'MD-Freigabe widerrufen',
  'qm.view_md_access_logs': 'MD-Zugriffsprotokolle ansehen',
  'qm.export_qm_documents': 'QM-Dokumente exportieren',
  'qm.manage_settings': 'QM-Einstellungen verwalten',
  'connect.view': 'Connect-Integrationen ansehen',
  'connect.configure': 'Connect-Integrationen konfigurieren',
  'inventory.view': 'Inventar ansehen',
  'inventory.manage_items': 'Inventar-Artikel verwalten',
  'inventory.issue': 'Inventar ausgeben',
  'inventory.return_manage': 'Inventar-Rückgaben verwalten',
  'inventory.audit_view': 'Inventar-Audit ansehen',
  'inventory.report_damage': 'Inventar-Schäden melden',
  'inventory.offboarding': 'Inventar-Offboarding',
  'portal.employee.inventory.view': 'Eigenes Inventar ansehen',
  'messages.broadcast.create': 'Broadcast-Nachrichten senden',
  'geo.routes.view': 'Routen & Geocoding ansehen',
  'geo.location.capture': 'Standort erfassen',
  'geo.live_tracking': 'Live-Tracking nutzen',
  'geo.mileage.manage': 'Kilometerstände verwalten',
  'office.recruiting.view': 'Bewerbungen ansehen',
  'office.recruiting.manage': 'Bewerbungen verwalten',
  'office.recruiting.view_sensitive': 'Sensible Bewerbungsdaten ansehen',
  'office.recruiting.convert': 'Bewerber:innen übernehmen',
  'office.recruiting.onboarding.manage': 'Onboarding verwalten',
  'office.employees.compliance.view': 'Compliance-Schulungen ansehen',
  'office.employees.compliance.manage': 'Compliance-Schulungen verwalten',
  'office.employees.absences.view': 'Abwesenheiten ansehen',
  'office.employees.absences.view_sensitive': 'Sensible Abwesenheitsdaten ansehen',
  'office.employees.absences.manage': 'Abwesenheiten verwalten',
  'office.employees.absences.approve': 'Abwesenheiten genehmigen',
  'portal.employee.absences.view': 'Eigene Abwesenheiten ansehen',
  'portal.employee.absences.request': 'Abwesenheit beantragen',
  'office.appointments.edit': 'Termine bearbeiten',
  'office.employees.hr.view': 'HR-Fälle ansehen',
  'office.employees.hr.manage': 'HR-Fälle verwalten',
  'office.employees.hr.finalize': 'HR-Fälle abschließen',
  'portal.employee.hr.view': 'Eigene HR-Unterlagen ansehen',
  'office.employee_time.view': 'Arbeitszeiten ansehen',
  'office.employee_time.manage': 'Arbeitszeiten verwalten',
  'office.employee_time.export': 'Arbeitszeiten exportieren',
  'time.tracking.own.start': 'Eigene Arbeitszeit starten',
  'time.tracking.own.pause': 'Eigene Arbeitszeit pausieren',
  'time.tracking.own.resume': 'Eigene Arbeitszeit fortsetzen',
  'time.tracking.own.switch': 'Tätigkeit / Zuordnung wechseln',
  'time.tracking.own.close': 'Arbeitstag abschließen',
  'time.tracking.own.view': 'Eigene Arbeitszeit einsehen',
  'time.tracking.team.view': 'Team-Arbeitszeiten einsehen',
  'time.tracking.admin.view': 'Arbeitszeit-Administration einsehen',
  'time.tracking.admin.correct': 'Arbeitszeit-Korrekturen bearbeiten',
  'time.tracking.admin.export': 'Arbeitszeit exportieren',
  'time.audit.view': 'Arbeitszeit-Audit einsehen',
  'time.settings.manage': 'Homeoffice-Arbeitszeit konfigurieren',
};

/** Compile-time guard: PERMISSION_LABELS keys stay aligned with PermissionKey union. */
type _PermissionLabelsComplete = PermissionKey extends keyof typeof PERMISSION_LABELS
  ? keyof typeof PERMISSION_LABELS extends PermissionKey
    ? true
    : never
  : never;
const _permissionLabelsComplete: _PermissionLabelsComplete = true;
void _permissionLabelsComplete;

export const PERMISSION_DENIED_MESSAGES: Partial<Record<PermissionKey, string>> = {
  'office.clients.create':
    'Das Anlegen von Klient:innen ist für Ihre Rolle nicht freigegeben. Bitte wenden Sie sich an die Geschäftsführung oder das Büro.',
  'office.clients.edit':
    'Stammdaten können von Ihrer Rolle nur eingesehen, nicht bearbeitet werden.',
  'office.clients.status_change':
    'Statusänderungen dürfen nur von Geschäftsführung, Bereichsleitung oder autorisiertem Büropersonal vorgenommen werden.',
  'office.clients.archive':
    'Archivierung ist nur für Geschäftsführung und Bereichsleitung erlaubt.',
  'office.clients.delete':
    'Das Löschen von Klient:innen ist für Ihre Rolle nicht freigegeben. Bitte wenden Sie sich an die Geschäftsführung oder das Büro.',
  'office.clients.view_sensitive':
    'Gesundheits- und Schutzdaten sind für Ihre Rolle nicht sichtbar. Es werden nur pflegerelevante Basisinformationen angezeigt.',
  'office.clients.manage_consents':
    'Portal-Freigaben können nur von Admin oder Bereichsleitung verwaltet werden.',
  'office.clients.manage_contacts':
    'Kontakte und Angehörige können nur von autorisiertem Büropersonal verwaltet werden.',
  'assist.assignments.manage':
    'Einsatzstatus dürfen nur von Geschäftsführung, Bereichsleitung oder Einsatzplanung geändert werden.',
  'business.modules.manage':
    'Modulverwaltung ist nur für Geschäftsführung und Bereichsleitung verfügbar.',
  'business.tenant.manage':
    'Mandanten-Stammdaten dürfen nur von Geschäftsführung / Admin bearbeitet werden.',
};

const OFFICE_VIEW: PermissionKey[] = [
  'office.access',
  'office.clients.view',
  'office.employees.view',
  'office.invoices.view',
  'office.budgets.view',
  'office.documents.view',
  'office.messages.view',
  'office.appointments.view',
  'dashboard.view',
];

const COMMUNICATION_FULL: PermissionKey[] = [
  'communication.view_center',
  'communication.create_thread',
  'communication.send_message',
  'communication.send_internal_note',
  'communication.edit_own_message',
  'communication.edit_any_message',
  'communication.delete_own_message',
  'communication.delete_any_message',
  'communication.archive_thread',
  'communication.restore_thread',
  'communication.assign_thread',
  'communication.manage_participants',
  'communication.upload_attachment',
  'communication.send_voice_message',
  'communication.view_client_threads',
  'communication.view_employee_threads',
  'communication.view_relative_threads',
  'communication.view_internal_threads',
  'communication.view_deleted_messages',
  'communication.export_messages',
  'communication.manage_settings',
];

const COMMUNICATION_OFFICE: PermissionKey[] = [
  'communication.view_center',
  'communication.create_thread',
  'communication.send_message',
  'communication.send_internal_note',
  'communication.edit_own_message',
  'communication.archive_thread',
  'communication.restore_thread',
  'communication.assign_thread',
  'communication.upload_attachment',
  'communication.view_client_threads',
  'communication.view_employee_threads',
  'communication.view_relative_threads',
  'communication.view_internal_threads',
];

const COMMUNICATION_DISPATCH: PermissionKey[] = [
  'communication.view_center',
  'communication.send_message',
  'communication.view_employee_threads',
  'communication.view_client_threads',
  'communication.assign_thread',
  'communication.archive_thread',
];

const COMMUNICATION_BILLING: PermissionKey[] = [
  'communication.view_center',
  'communication.send_message',
  'communication.view_client_threads',
  'communication.assign_thread',
];

const QM_FULL: PermissionKey[] = [
  'qm.view',
  'qm.manage_handbook',
  'qm.create_document',
  'qm.edit_document',
  'qm.approve_document',
  'qm.archive_document',
  'qm.view_versions',
  'qm.manage_legal_references',
  'qm.manage_compliance',
  'qm.create_audit',
  'qm.close_audit',
  'qm.create_measure',
  'qm.close_measure',
  'qm.use_ai_assistant',
  'qm.create_md_package',
  'qm.approve_md_package',
  'qm.share_md_package',
  'qm.revoke_md_package',
  'qm.view_md_access_logs',
  'qm.export_qm_documents',
  'qm.manage_settings',
];

const QM_VIEW_ONLY: PermissionKey[] = ['qm.view', 'qm.view_versions'];

const QM_PDL: PermissionKey[] = [
  ...QM_VIEW_ONLY,
  'qm.create_document',
  'qm.edit_document',
  'qm.manage_compliance',
  'qm.create_audit',
  'qm.create_measure',
  'qm.close_measure',
  'qm.use_ai_assistant',
  'qm.create_md_package',
  'qm.approve_md_package',
  'qm.export_qm_documents',
];

const BUSINESS_PLATFORM: PermissionKey[] = [
  'business.subscription.view',
  'business.subscription.manage',
  'business.reporting.view',
  'business.reporting.create',
  'release.view',
  'release.manage',
  'security.view',
  'security.manage',
  'qa.view',
  'qa.manage',
  'roadmap.view',
  'roadmap.manage',
  'platform.ocr.view',
  'platform.ocr.manage',
  'platform.ai.view',
  'platform.ai.manage',
  'integrations.view',
  'integrations.manage',
  'integrations.outbox.view',
  'ti.view',
  'ti.admin',
  'ti.kim.view',
  'ti.kim.manage',
  'ti.consent.manage',
  'ti.audit.view',
  'ti.provider.manage',
  'ti.egk.view',
  'ti.epa.view',
  'ti.emp.view',
  'ti.erezept.view',
];

const CSV_SETTINGS: PermissionKey[] = [
  'tenant.settings.csv.view',
  'tenant.settings.csv.import.clients',
  'tenant.settings.csv.export.clients',
  'tenant.settings.csv.import.employees',
  'tenant.settings.csv.export.employees',
  'tenant.settings.csv.logs.view',
  'tenant.settings.csv.templates.download',
  'office.employees.view_sensitive',
];

const CONNECT_VIEW: PermissionKey[] = ['connect.view'];

const CONNECT_CONFIGURE: PermissionKey[] = ['connect.view', 'connect.configure'];

const INVENTORY_FULL: PermissionKey[] = [
  'inventory.view',
  'inventory.manage_items',
  'inventory.issue',
  'inventory.return_manage',
  'inventory.audit_view',
  'inventory.report_damage',
  'inventory.offboarding',
];

const INVENTORY_DISPATCH: PermissionKey[] = [
  'inventory.view',
  'inventory.issue',
  'inventory.return_manage',
  'inventory.audit_view',
];

const GEO_FIELD: PermissionKey[] = ['geo.routes.view', 'geo.location.capture'];

const GEO_DISPATCH: PermissionKey[] = [
  ...GEO_FIELD,
  'geo.live_tracking',
  'geo.mileage.manage',
];

const BROADCAST_CREATE: PermissionKey[] = ['messages.broadcast.create'];

const RECRUITING_VIEW: PermissionKey[] = ['office.recruiting.view'];

const RECRUITING_FULL: PermissionKey[] = [
  'office.recruiting.view',
  'office.recruiting.manage',
  'office.recruiting.view_sensitive',
  'office.recruiting.convert',
  'office.recruiting.onboarding.manage',
];

const COMPLIANCE_VIEW: PermissionKey[] = ['office.employees.compliance.view'];

const COMPLIANCE_FULL: PermissionKey[] = [
  'office.employees.compliance.view',
  'office.employees.compliance.manage',
];

const ABSENCES_OFFICE_FULL: PermissionKey[] = [
  'office.employees.absences.view',
  'office.employees.absences.view_sensitive',
  'office.employees.absences.manage',
  'office.employees.absences.approve',
];

const ABSENCES_DISPATCH: PermissionKey[] = [
  'office.employees.absences.view',
  'office.employees.absences.manage',
  'office.employees.absences.approve',
];

const ABSENCES_VIEW: PermissionKey[] = ['office.employees.absences.view'];

const PORTAL_EMPLOYEE_EXTENDED: PermissionKey[] = [
  'portal.employee.inventory.view',
  'portal.employee.absences.view',
  'portal.employee.absences.request',
  'portal.employee.hr.view',
];

const HR_OFFICE_FULL: PermissionKey[] = [
  'office.employees.hr.view',
  'office.employees.hr.manage',
  'office.employees.hr.finalize',
];

const HR_VIEW: PermissionKey[] = ['office.employees.hr.view'];

const EMPLOYEE_TIME_FULL: PermissionKey[] = [
  'office.employee_time.view',
  'office.employee_time.manage',
  'office.employee_time.export',
];

const EMPLOYEE_TIME_BILLING: PermissionKey[] = [
  'office.employee_time.view',
  'office.employee_time.export',
];

const TIME_TRACKING_OWN: PermissionKey[] = [
  'time.tracking.own.start',
  'time.tracking.own.pause',
  'time.tracking.own.resume',
  'time.tracking.own.switch',
  'time.tracking.own.close',
  'time.tracking.own.view',
];

const TIME_TRACKING_TEAM: PermissionKey[] = [
  ...TIME_TRACKING_OWN,
  'time.tracking.team.view',
];

const TIME_TRACKING_ADMIN: PermissionKey[] = [
  ...TIME_TRACKING_TEAM,
  'time.tracking.admin.view',
  'time.tracking.admin.correct',
  'time.tracking.admin.export',
  'time.audit.view',
  'time.settings.manage',
];

const APPOINTMENTS_EDIT: PermissionKey[] = ['office.appointments.edit'];

const OFFICE_FULL: PermissionKey[] = [
  ...OFFICE_VIEW,
  ...QM_FULL,
  ...CSV_SETTINGS,
  'office.clients.create',
  'office.clients.edit',
  'office.clients.status_change',
  'office.clients.archive',
  'office.clients.delete',
  'office.clients.view_sensitive',
  'office.clients.manage_consents',
  'office.clients.manage_contacts',
  'office.invoices.create',
  'office.invoices.status_change',
  'office.employees.create',
  'office.employees.edit',
  'office.employees.delete',
  'office.catalogs.view',
  'office.catalogs.edit',
  'office.catalogs.create',
  'office.catalogs.update',
  'office.catalogs.deactivate',
  'office.catalogs.restore',
  'office.catalogs.copy_system',
  'office.templates.view',
  'office.templates.create',
  'office.templates.update',
  'office.templates.activate',
  'office.templates.archive',
  'office.templates.version_view',
  'office.templates.bindings_manage',
  'settings.templates.view',
  'settings.templates.create',
  'settings.templates.update',
  'settings.templates.delete',
  'settings.templates.deactivate',
  'settings.templates.copy',
  'settings.templates.publish',
  'settings.templates.version',
  'settings.templates.mapping',
  'settings.templates.layout',
  'settings.templates.send_settings',
  'settings.templates.audit',
  'documents.preview',
  'documents.create',
  'documents.edit_draft',
  'documents.finalize',
  'documents.pdf_create',
  'documents.download',
  'documents.email_send',
  'documents.fax_send',
  'documents.save_to_file',
  'documents.archive',
  'documents.delete_draft',
  'business.modules.manage',
  ...BUSINESS_PLATFORM,
  ...COMMUNICATION_FULL,
];

const ASSIST_VIEW: PermissionKey[] = [
  'assist.access',
  'assist.assignments.view',
  'assist.execution.view',
  'assist.records.view',
  'assist.trips.view',
  'assist.tracking.view',
  'dashboard.view',
];

const ASSIST_MANAGE: PermissionKey[] = [
  ...ASSIST_VIEW,
  'office.catalogs.view',
  'assist.assignments.manage',
  'assist.execution.manage',
  'assist.records.create',
  'assist.records.sign',
  'assist.records.export',
  'assist.trips.manage',
  'assist.assignment.use_templates',
  'assist.documentation.use_quick_blocks',
  'assist.intake.use_templates',
];

const PFLEGE_VIEW: PermissionKey[] = [
  'pflege.access',
  'pflege.plans.view',
  'pflege.vitals.view',
  'dashboard.view',
];

const BERATUNG_VIEW: PermissionKey[] = [
  'beratung.access',
  'beratung.cases.view',
  'dashboard.view',
];

const AKADEMIE_VIEW: PermissionKey[] = [
  'akademie.access',
  'akademie.courses.view',
  'dashboard.view',
];

const STATIONAER_VIEW: PermissionKey[] = [
  'stationaer.access',
  'stationaer.residents.view',
  'dashboard.view',
];

const PORTAL_CLIENT: PermissionKey[] = [
  'dashboard.view',
  'portal.client.appointments.view',
  'portal.client.messages.view',
  'portal.client.messages.reply',
  'portal.client.documents.view',
  'portal.client.documents.download',
  'portal.client.profile.view',
  'portal.client.careplan.view',
  'portal.client.appointments.request_change',
];

const PORTAL_EMPLOYEE: PermissionKey[] = [
  'dashboard.view',
  'portal.employee.appointments.view',
  'portal.employee.messages.view',
  'portal.employee.messages.reply',
  'portal.employee.documents.view',
  'portal.employee.documents.download',
  'portal.employee.profile.view',
  'portal.employee.timesheet.view',
  ...PORTAL_EMPLOYEE_EXTENDED,
];

const MODULE_VIEW_ALL: PermissionKey[] = [
  ...BERATUNG_VIEW,
  ...AKADEMIE_VIEW,
  ...STATIONAER_VIEW,
];

export const ROLE_PERMISSIONS: RolePermissionMap = {
  business_admin: [
    ...OFFICE_FULL,
    ...ASSIST_MANAGE,
    ...PFLEGE_VIEW,
    ...MODULE_VIEW_ALL,
    ...CONNECT_CONFIGURE,
    ...INVENTORY_FULL,
    ...GEO_DISPATCH,
    ...BROADCAST_CREATE,
    ...RECRUITING_FULL,
    ...COMPLIANCE_FULL,
    ...ABSENCES_OFFICE_FULL,
    ...HR_OFFICE_FULL,
    ...EMPLOYEE_TIME_FULL,
    ...TIME_TRACKING_ADMIN,
    ...APPOINTMENTS_EDIT,
    'business.tenant.manage',
  ],
  business_manager: [
    ...OFFICE_FULL,
    ...ASSIST_MANAGE,
    ...PFLEGE_VIEW,
    ...MODULE_VIEW_ALL,
    ...CONNECT_VIEW,
    ...INVENTORY_FULL,
    ...GEO_DISPATCH,
    ...BROADCAST_CREATE,
    ...RECRUITING_FULL,
    ...COMPLIANCE_FULL,
    ...ABSENCES_OFFICE_FULL,
    ...HR_OFFICE_FULL,
    ...EMPLOYEE_TIME_FULL,
    ...TIME_TRACKING_ADMIN,
    ...APPOINTMENTS_EDIT,
  ],
  billing: [
    ...OFFICE_VIEW,
    'office.clients.view_sensitive',
    'office.catalogs.view',
    'office.invoices.create',
    'business.subscription.view',
    'integrations.view',
    'integrations.outbox.view',
    ...CONNECT_VIEW,
    ...QM_VIEW_ONLY,
    ...COMMUNICATION_BILLING,
    ...BROADCAST_CREATE,
    ...HR_VIEW,
    ...EMPLOYEE_TIME_BILLING,
    'time.tracking.team.view',
    'time.tracking.admin.view',
    'time.audit.view',
    ...ABSENCES_VIEW,
    ...COMPLIANCE_VIEW,
  ],
  dispatch: [
    ...OFFICE_VIEW,
    'office.clients.view_sensitive',
    'office.catalogs.view',
    ...ASSIST_MANAGE,
    ...PFLEGE_VIEW,
    ...BERATUNG_VIEW,
    ...AKADEMIE_VIEW,
    ...STATIONAER_VIEW,
    ...QM_VIEW_ONLY,
    ...COMMUNICATION_DISPATCH,
    ...CONNECT_VIEW,
    ...INVENTORY_DISPATCH,
    ...GEO_DISPATCH,
    ...BROADCAST_CREATE,
    ...ABSENCES_DISPATCH,
    ...APPOINTMENTS_EDIT,
    ...RECRUITING_VIEW,
    ...TIME_TRACKING_TEAM,
  ],
  nurse: [
    ...OFFICE_VIEW,
    'office.clients.view_sensitive',
    'office.catalogs.view',
    ...ASSIST_VIEW,
    'assist.execution.manage',
    ...PFLEGE_VIEW,
    ...STATIONAER_VIEW,
    ...QM_PDL,
    ...GEO_FIELD,
    ...COMPLIANCE_VIEW,
    ...ABSENCES_VIEW,
    'communication.view_center',
    'communication.send_message',
    'communication.view_client_threads',
    ...TIME_TRACKING_OWN,
  ],
  caregiver: [
    ...OFFICE_VIEW,
    'office.catalogs.view',
    ...ASSIST_VIEW,
    'assist.execution.manage',
    ...PFLEGE_VIEW,
    ...GEO_FIELD,
    'communication.view_center',
    'communication.send_message',
    ...TIME_TRACKING_OWN,
  ],
  counselor: [
    ...OFFICE_VIEW,
    'office.clients.view_sensitive',
    ...ASSIST_VIEW,
    ...PFLEGE_VIEW,
    ...BERATUNG_VIEW,
    ...ABSENCES_VIEW,
    'communication.view_center',
    'communication.send_message',
    'communication.view_client_threads',
    ...TIME_TRACKING_OWN,
  ],
  akademie_admin: [...AKADEMIE_VIEW, ...COMMUNICATION_OFFICE],
  employee_portal: [...PORTAL_EMPLOYEE, ...TIME_TRACKING_OWN],
  client_portal: PORTAL_CLIENT,
  family_portal: PORTAL_CLIENT,
};

export function getPermissionsForRole(roleKey: RoleKey | null): readonly PermissionKey[] {
  if (!roleKey) return [];
  return ROLE_PERMISSIONS[roleKey] ?? [];
}
