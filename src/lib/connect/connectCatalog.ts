import type { ConnectCategory, ConnectIntegration } from '@/types/modules/connect';

function integration(
  key: string,
  label: string,
  description: string,
  readiness: ConnectIntegration['readiness'],
  requiresProvider = false,
  moduleHref?: string,
): ConnectIntegration {
  return {
    key,
    label,
    description,
    readiness,
    requiresProvider,
    auditPrepared: true,
    ...(moduleHref ? { moduleHref } : {}),
  };
}

export const CONNECT_CATALOG: ConnectCategory[] = [
  {
    key: 'billing',
    label: 'Abrechnung',
    description: 'GKV, SGB XI/V, Pflege- und Krankenkassen, Kostenträger',
    icon: '🧾',
    readiness: 'coming_soon',
    integrations: [
      integration('gkv', 'GKV-Abrechnung', 'Gesetzliche Krankenversicherung — Abrechnungsdatenaustausch', 'coming_soon'),
      integration('sgb_xi', 'SGB XI', 'Pflegeversicherung nach SGB XI', 'coming_soon'),
      integration('sgb_v', 'SGB V', 'Krankenversicherung nach SGB V', 'coming_soon'),
      integration('pflegekassen', 'Pflegekassen', 'Abstimmung mit Pflegekassen und Kostenträgern', 'coming_soon'),
      integration('krankenkassen', 'Krankenkassen', 'Kostenträger-Kommunikation Krankenkassen', 'coming_soon'),
      integration('kostentraegerdateien', 'Kostenträgerdateien', 'Import und Prüfung von Kostenträger-Stammdaten', 'coming_soon'),
      integration('ik_pruefung', 'IK-Prüfung', 'Institutionskennzeichen-Validierung', 'disabled'),
      integration('abrechnungszentren', 'Abrechnungszentren', 'Anbindung an Abrechnungsdienstleister', 'coming_soon'),
    ],
  },
  {
    key: 'accounting',
    label: 'Buchhaltung',
    description: 'DATEV, Lexware, sevDesk und Steuerexport',
    icon: '📒',
    readiness: 'prepared',
    integrations: [
      integration('datev', 'DATEV', 'Export und Schnittstelle zu DATEV', 'prepared', true, '/business/connect/accounting/prepare'),
      integration('lexware_office', 'Lexware Office', 'Buchhaltungs-Connector Lexware Office', 'prepared', true, '/business/connect/accounting/prepare'),
      integration('sevdesk', 'sevDesk', 'Cloud-Buchhaltung sevDesk', 'prepared', true, '/business/connect/accounting/prepare'),
      integration('fastbill', 'FastBill', 'Rechnungs- und Buchhaltungs-Export FastBill', 'coming_soon', true, '/business/connect/accounting/prepare'),
      integration('agenda', 'Agenda', 'Agenda Buchhaltungs-Schnittstelle', 'coming_soon', true, '/business/connect/accounting/prepare'),
      integration('gobd_archiv', 'GoBD-Archiv', 'Revisionssichere Archivierung nach GoBD', 'prepared', false, '/business/connect/accounting/prepare'),
      integration('steuerberater_export', 'Steuerberater-Export', 'Exportpakete für Steuerberater:innen', 'prepared', false, '/business/connect/accounting/prepare'),
    ],
  },
  {
    key: 'ti_kim',
    label: 'TI & KIM',
    description: 'Telematikinfrastruktur — Verknüpfung mit TI-Modul',
    icon: '🏥',
    readiness: 'prepared',
    integrations: [
      integration('kim', 'KIM', 'Kommunikation im Medizinwesen — Postfach & Nachrichten', 'prepared', true, '/business/ti/kim'),
      integration('egk', 'eGK', 'Elektronische Gesundheitskarte — Vorbereitung', 'prepared', true, '/business/ti'),
      integration('epa', 'ePA', 'Elektronische Patientenakte — Vorbereitung', 'prepared', true, '/business/ti/epa'),
      integration('emp', 'eMP', 'Elektronischer Medikationsplan', 'prepared', true, '/business/ti'),
      integration('erezept', 'E-Rezept', 'Elektronisches Rezept — Vorbereitung', 'prepared', true, '/business/ti/erezept'),
      integration('ti_konnektor', 'TI-Konnektor', 'Konnektor-Anbindung und Zertifikatsverwaltung', 'coming_soon', true, '/business/ti/providers'),
      integration('smcb', 'SMC-B', 'Praxisausweis und SMC-B-Kartenmanagement', 'coming_soon', true, '/business/ti/providers'),
    ],
  },
  {
    key: 'payments',
    label: 'Zahlungen',
    description: 'Stripe, Mollie, SEPA und Zahlungsabgleich',
    icon: '💳',
    readiness: 'coming_soon',
    integrations: [
      integration('stripe', 'Stripe', 'Kartenzahlungen und Abonnements', 'coming_soon', true),
      integration('mollie', 'Mollie', 'EU-Zahlungsdienstleister Mollie', 'coming_soon', true),
      integration('gocardless', 'GoCardless', 'SEPA-Lastschrift und wiederkehrende Zahlungen', 'coming_soon', true),
      integration('paypal', 'PayPal', 'PayPal Checkout und Abgleich', 'coming_soon', true),
      integration('sepa', 'SEPA', 'SEPA-Überweisung und Mandatsverwaltung', 'coming_soon', true),
      integration('zahlungsabgleich', 'Zahlungsabgleich', 'Automatischer Abgleich offener Posten', 'coming_soon'),
    ],
  },
  {
    key: 'communication_channels',
    label: 'Kommunikationskanäle',
    description: 'E-Mail, SMS, WhatsApp, Push, Telefonie',
    icon: '📨',
    readiness: 'coming_soon',
    integrations: [
      integration('email', 'E-Mail', 'SMTP- und Provider-Anbindung für transaktionale E-Mails', 'coming_soon', true),
      integration('sms', 'SMS', 'SMS-Gateway für Erinnerungen und Benachrichtigungen', 'coming_soon', true),
      integration('whatsapp', 'WhatsApp', 'WhatsApp Business API — in Prüfung', 'coming_soon', true),
      integration('push', 'Push', 'Mobile Push-Benachrichtigungen', 'coming_soon', true),
      integration('telefonie', 'Telefonie', 'Telefonie-Integration und Anrufprotokoll', 'coming_soon', true),
      integration('sip', 'SIP', 'SIP-Trunk und VoIP-Anbindung', 'coming_soon', true),
    ],
  },
  {
    key: 'routes_gps',
    label: 'Routen & GPS',
    description: 'Karten, Geofencing und Fahrtenbuch — Schema vorbereitet (0046)',
    icon: '🗺️',
    readiness: 'prepared',
    integrations: [
      integration('maps_google', 'Google Maps', 'Routing und Adressvalidierung — Provider vorbereitet', 'prepared', true),
      integration('maps_osm', 'OpenStreetMap / Nominatim', 'Open-Data-Geocoding — ohne API-Key', 'prepared'),
      integration('maps_here', 'HERE Maps', 'Fleet-Routing HERE — Provider vorbereitet', 'prepared', true),
      integration('maps_mapbox', 'Mapbox', 'Karten und Routing Mapbox — Provider vorbereitet', 'prepared', true),
      integration('maps_tomtom', 'TomTom', 'Routing TomTom — Provider vorbereitet', 'prepared', true),
      integration('maps_generic_geocoder', 'Generischer Geocoder', 'Mandanten-eigener Geocoding-Endpunkt', 'prepared', true),
      integration('geofencing', 'Geofencing', 'Geo-Zonen — kein Nachweis ohne Validierung', 'prepared'),
      integration('fahrtenbuch_gps', 'Fahrtenbuch GPS', 'Fahrtenbuch-Entwürfe — GPS-Erfassung blockiert', 'disabled'),
      integration('live_tracking', 'Live-Tracking', 'Nur 30 min vor/nach Einsatz — noch blockiert', 'disabled'),
    ],
  },
  {
    key: 'documents_signatures',
    label: 'Dokumente & Signaturen',
    description: 'DocuSign, Adobe Sign, OCR und Archiv',
    icon: '✍️',
    readiness: 'prepared',
    integrations: [
      integration('docusign', 'DocuSign', 'Qualifizierte elektronische Signaturen DocuSign — vorbereitet', 'prepared', true),
      integration('adobe_sign', 'Adobe Sign', 'Adobe Sign Workflow-Integration — vorbereitet', 'prepared', true),
      integration('skribble', 'Skribble', 'Schweizer/eIDAS-Signaturen Skribble — vorbereitet', 'prepared', true),
      integration('fp_sign', 'FP Sign', 'FP Sign Signaturplattform — vorbereitet', 'prepared', true),
      integration('ocr', 'OCR', 'Texterkennung für Belege und Formulare — vorbereitet', 'prepared'),
      integration('pdf_a', 'PDF/A', 'Langzeitarchivierung PDF/A — vorbereitet', 'prepared'),
      integration('archiv', 'Archiv', 'Dokumentenarchiv mit Versionierung — vorbereitet', 'prepared'),
    ],
  },
  {
    key: 'medical_data',
    label: 'Medizinische Daten',
    description: 'ICD-10-GM und klinische Kataloge',
    icon: '🩺',
    readiness: 'prepared',
    integrations: [
      integration('icd10_gm', 'ICD-10-GM', 'Diagnoseschlüssel ICD-10-GM — Katalog vorbereitet', 'prepared'),
      integration('ops', 'OPS', 'Operationen- und Prozedurenschlüssel OPS', 'coming_soon'),
      integration('medikationsdb', 'Medikationsdatenbank', 'Arzneimittel- und Interaktionsdaten', 'coming_soon'),
      integration('heilmittel', 'Heilmittel', 'Heilmittelverordnung und Kataloge', 'coming_soon'),
    ],
  },
  {
    key: 'hr_payroll',
    label: 'Personal & Lohn',
    description: 'Lohn, Dienstplanung und Zeiterfassung',
    icon: '👥',
    readiness: 'coming_soon',
    integrations: [
      integration('datev_lohn', 'DATEV Lohn', 'Lohnabrechnung DATEV', 'coming_soon', true),
      integration('lexware_lohn', 'Lexware Lohn', 'Personalwirtschaft Lexware', 'coming_soon', true),
      integration('agenda_lohn', 'Agenda Lohn', 'Lohn und Personal Agenda', 'coming_soon', true),
      integration('personio', 'Personio', 'HR-Cloud Personio', 'coming_soon', true),
      integration('factorial', 'Factorial', 'HR-Plattform Factorial', 'coming_soon', true),
      integration('dienstplanung', 'Dienstplanung', 'Externe Dienstplanungs-Connectors', 'coming_soon'),
      integration('zeiterfassung', 'Zeiterfassung', 'Zeiterfassungs-Schnittstellen', 'coming_soon', true),
    ],
  },
  {
    key: 'academy_integrations',
    label: 'Akademie-Integrationen',
    description: 'SCORM, LMS und Zertifikate',
    icon: '🎓',
    readiness: 'coming_soon',
    integrations: [
      integration('scorm', 'SCORM', 'SCORM-Pakete importieren und tracken', 'coming_soon'),
      integration('xapi', 'xAPI', 'Experience API für Lernaktivitäten', 'coming_soon'),
      integration('moodle', 'Moodle', 'Moodle LMS-Anbindung', 'coming_soon', true),
      integration('ilias', 'ILIAS', 'ILIAS Lernplattform', 'coming_soon', true),
      integration('zertifikate', 'Zertifikate', 'Externe Zertifikats-Provider', 'coming_soon'),
      integration('unterweisungen', 'Unterweisungen', 'Pflichtunterweisungen und Nachweise', 'coming_soon'),
    ],
  },
  {
    key: 'marketplace',
    label: 'Marktplatz',
    description: 'Partner-Ökosystem und Erweiterungen',
    icon: '🏪',
    readiness: 'coming_soon',
    integrations: [
      integration('partner_marketplace', 'Partner-Marktplatz', 'Pflegedienst-Partner: Hilfsmittel, Dienste, Beratung', 'coming_soon', false, '/business/connect/marketplace'),
      integration('software_partner', 'Software-Partner', 'Zertifizierte Software-Erweiterungen', 'coming_soon'),
      integration('hardware_partner', 'Hardware-Partner', 'Geräte und Peripherie-Partner', 'coming_soon'),
      integration('dienstleister', 'Dienstleister', 'Implementierungs- und Beratungspartner', 'coming_soon'),
      integration('schnittstellen_partner', 'Schnittstellen-Partner', 'Individuelle API- und FHIR-Connectors', 'coming_soon'),
      integration('schulungs_partner', 'Schulungs-Partner', 'Akademie- und Schulungspartner', 'coming_soon'),
    ],
  },
];

export function getConnectCategories(): ConnectCategory[] {
  return CONNECT_CATALOG;
}

export function getConnectCategory(categoryKey: string): ConnectCategory | undefined {
  return CONNECT_CATALOG.find((category) => category.key === categoryKey);
}

export function getConnectIntegration(
  categoryKey: string,
  integrationKey: string,
): ConnectIntegration | undefined {
  return getConnectCategory(categoryKey)?.integrations.find((item) => item.key === integrationKey);
}

export function getVisibleConnectIntegrations(category: ConnectCategory): ConnectIntegration[] {
  return category.integrations.filter((item) => item.readiness !== 'disabled');
}

export function getAllConnectIntegrations(): ConnectIntegration[] {
  return CONNECT_CATALOG.flatMap((category) => category.integrations);
}
