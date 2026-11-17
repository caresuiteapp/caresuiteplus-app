import type { CentralDocumentDefinition } from '@/types/documents/centralCatalog';
import { CENTRAL_CATALOG_PURPOSE_SCHEMAS } from './centralCatalogPurposeSchemas';

type CatalogContentRevision = Partial<Pick<CentralDocumentDefinition,
  'title' | 'sourceMode' | 'layout' | 'columns' | 'modules' | 'target' | 'sections' | 'instructions' | 'legalReviewRequired'
>> & { fieldLabels?: string[]; preserveEdition?: false };

const careHistory = 'Datum, Anlass und Informationsquellen dokumentieren. Eigene Angaben, Angaben Dritter und Beobachtungen getrennt zuordnen. Offene oder unklare Angaben sichtbar kennzeichnen.';
const proofInstructions = 'Die erbrachten Leistungen je Einsatz nachvollziehbar erfassen. Eine Bestätigung nur aus dem zugehörigen Nachweis übernehmen. Leistungsart und zuständigen Kostenträger für den konkreten Abrechnungsweg prüfen.';
const invoiceInstructions = 'Interner Prüfentwurf für eine zugeordnete Rechnung. Erzeugung, Rechnungsnummer, Freigabe und gegebenenfalls strukturierte E-Rechnung im Office-Rechnungsablauf bearbeiten.';
const invoiceFields = ['Leistungszeitraum und Abrechnungsgrundlage', 'Ausgestellte oder vorbereitete Rechnungsnummer und Datum', 'Empfänger, leistungsberechtigte Person und gegebenenfalls abweichende Zahlstelle', 'Positionsbezug, Steuerangaben und Summen der Rechnung', 'Nachweise, Freigabestand und Prüfergebnis'];
const invoiceColumns = ['Leistungsdatum', 'Leistungsposition', 'Menge / Einheit und Bruttobetrag', 'Rechnungsbezug', 'Prüfhinweis'];
const originalForm = (title: string, fieldLabels: string[], instructions: string): CatalogContentRevision => ({
  title, fieldLabels, instructions, sourceMode: 'original', layout: 'form', columns: [], preserveEdition: false,
  sections: [{ key: 'original', heading: 'Zuordnung der Originalunterlage', text: instructions }],
});

export const CENTRAL_CATALOG_CONTENT_REVISIONS: Readonly<Record<string, CatalogContentRevision>> = {
  ...CENTRAL_CATALOG_PURPOSE_SCHEMAS,
  csdc_pflegeplanung_001: {
    instructions: careHistory,
    fieldLabels: ['Erhebungsdatum, Anlass und beteiligte Personen', 'Angaben der pflegebedürftigen Person und ergänzende Quellen', 'Krankheits- und Versorgungsvorgeschichte mit Pflegebezug', 'Aktueller Versorgungsstand, Beschwerden und vorhandene Hilfsmittel', 'Mobilität, Selbstversorgung, Kommunikation und Alltagsgestaltung', 'Ressourcen, Wohnumfeld und verfügbare Unterstützung', 'Relevante Risiken, bekannte Unverträglichkeiten und offene Angaben', 'Pflegerische Einschätzung und weiterer Abklärungsbedarf'],
  },
  csdc_pflegeplanung_007: {
    layout: 'table',
    fieldLabels: ['Planungsdatum, verantwortliche Pflegefachperson und zugrunde liegende Einschätzung', 'Abstimmung mit der Person und beteiligten Stellen', 'Gültigkeit und Anlass der nächsten Evaluation'],
    columns: ['Pflegebedarf / Ressource', 'Individuelles Ziel', 'Vereinbarte Maßnahme', 'Zeitpunkt / Häufigkeit', 'Zuständigkeit', 'Prüftermin / Kriterium'],
  },
  csdc_pflegeplanung_010: {
    layout: 'table',
    fieldLabels: ['Berichtszeitraum und verantwortlicher Arbeitsbereich', 'Vorgangs- und Quellenbezug'],
    columns: ['Datum / Uhrzeit', 'Beobachtung / Anlass', 'Tatsächlich erfolgte Handlung', 'Reaktion / Ergebnis', 'Rückmeldung / Folgeschritt', 'Dokumentiert durch'],
  },
  csdc_medikamente_004: {
    instructions: 'Auslösenden Stoff, Reaktion und Herkunft dokumentieren. Fachlich bestätigte Allergie, berichtete Unverträglichkeit und unklaren Verdacht unterscheiden. Fehlende Angaben bedeuten keinen Ausschluss.',
    fieldLabels: ['Erhebungsdatum und Informationsquellen', 'Abgleich mit vorhandenen Unterlagen', 'Offene Angaben und zuständige Rückfrage'],
    columns: ['Auslösender Stoff / Produkt', 'Berichtete oder beobachtete Reaktion', 'Zeitpunkt / Umstände', 'Quelle / Abklärungsstand', 'Zuletzt geprüft am / durch'],
  },
  csdc_medikamente_005: {
    instructions: 'Vorbereitung anhand der konkret zugeordneten gültigen Anordnung dokumentieren. Zeitpunkt und Person, die gerichtet hat, erfassen.',
    fieldLabels: ['Zuordnung und Stand der ärztlichen Anordnung', 'Zeitraum und Zweck der Vorbereitung', 'Abweichungen und dokumentierte Rücksprache'],
    columns: ['Gerichtet am / um', 'Arzneimittel / Stärke laut Quelle', 'Tatsächlich vorbereitete Menge / Einheit', 'Vorgesehener Bezug zur Gabe', 'Abweichung', 'Gerichtet / geprüft durch'],
  },
  csdc_medikamente_006: {
    instructions: 'Die tatsächlich erfolgte, abgelehnte, ausgelassene oder unklare Gabe dokumentieren. Geplante oder vorbereitete Medikation erhält dadurch keine Bestätigung.',
    fieldLabels: ['Zuordnung und Stand der gültigen Anordnung', 'Dokumentationszeitraum und Zuordnung zum Einsatz', 'Offene Rückfragen und dokumentierte Übergabe'],
    columns: ['Tatsächlicher Zeitpunkt / vorgesehener Termin', 'Arzneimittel / Stärke', 'Tatsächliche Dosis / Einheit', 'Applikationsweg', 'Status / Abweichungsgrund', 'Durchgeführt / dokumentiert durch'],
  },
  csdc_antraege_009: originalForm('Beratungsnachweis nach § 37 Absatz 3 SGB XI – Begleitblatt', [
    'Beratungstermin und durchführende Beratungsstelle', 'Verwendetes GKV-/PKV-Nachweisformular und Fassungsstand', 'Zuordnung des ausgefüllten und unterzeichneten Formulars', 'Vermerk zur Weitergabe laut Originalformular und Übermittlungsstand',
  ], 'Das ausgefüllte Nachweisformular von GKV/PKV zum Beratungsbesuch als Original hinterlegen. Angaben zur Weitergabe von Erkenntnissen aus dem dafür vorgesehenen Feld des verwendeten Formulars übernehmen.'),
  csdc_einsatz_006: {
    instructions: proofInstructions,
    fieldLabels: ['Leistungszeitraum', 'Leistungsart und Abrechnungsgrundlage', 'Empfänger und Bezug zur Vereinbarung oder zum Leistungsbescheid', 'Abweichungen, offene Bestätigung und Nachtragsbezug'],
  },
  csdc_alltag_016: {
    instructions: proofInstructions,
    fieldLabels: ['Leistungszeitraum', 'Bezeichnung des anerkannten Angebots und konkrete Leistungsart', 'Vereinbarter Abrechnungsweg und Kostenträger', 'Abweichungen, offene Bestätigung und Nachtragsbezug'],
  },
  csdc_abrechnung_001: {
    instructions: proofInstructions,
    fieldLabels: ['Leistungszeitraum', 'Konkrete Leistungsart und zugehöriger Abrechnungsvorgang', 'Zuordnung zur bestätigten Fassung und zu berechtigten Unterzeichnenden', 'Abweichungen und offene Bestätigungen'],
  },
  csdc_abrechnung_004: { title: 'Rechnung an Kostenträger – interner Prüfentwurf', fieldLabels: invoiceFields, columns: invoiceColumns, instructions: invoiceInstructions, legalReviewRequired: true },
  csdc_abrechnung_005: { title: 'Privat- und Eigenanteilsrechnung – interner Prüfentwurf', fieldLabels: invoiceFields, columns: invoiceColumns, instructions: invoiceInstructions, legalReviewRequired: true },
  csdc_vertraege_011: {
    preserveEdition: false,
    fieldLabels: ['Gültig ab und Anwendungsbereich', 'Vereinbarte Leistungsarten und Abrechnungseinheiten', 'Verweis auf Vereinbarung, Vergütungsstand und Anlagen'],
    columns: ['Leistung / Kennung', 'Abrechnungseinheit', 'Preis je Einheit', 'Steuerangabe', 'Zuschlag / Bedingung', 'Gilt ab'],
    sections: [],
  },
  csdc_stationaer_001: {
    preserveEdition: false, layout: 'form', columns: [],
    fieldLabels: ['Vor Vertragsschluss informierte Person und Zeitpunkt der Aushändigung', 'Wohnraum, Ausstattung und Leistungsangebot der Einrichtung', 'Entgelte für Wohnraum, Pflege oder Betreuung, Verpflegung und weitere Bestandteile', 'Gesamtentgelt, maßgebliche Vergütungsgrundlagen und einbezogene Informationen', 'Anwendbare Bedingungen zu Leistungsänderungen und vorhandene Anlagen'],
    sections: [{ key: 'information', heading: 'Information vor Vertragsschluss', text: 'Die vorvertraglichen Angaben beziehen sich auf das konkrete Angebot. Zeitpunkt, Umfang und Fassung der ausgehändigten Informationen dokumentieren.' }],
  },
  csdc_stationaer_007: {
    fieldLabels: ['Einrichtung, Wohnbereich und Stichtag', 'Verantwortlich für Datenstand und Zugriffsbereich'],
    columns: ['Wohnbereich', 'Zimmer / Platz', 'Belegungsstatus', 'Belegt seit / vorgesehen bis', 'Interner Zuordnungsbezug', 'Klärungsbedarf'],
  },
  csdc_teilstationaer_013: originalForm('Kostenzusage und Abrechnungsunterlagen – Begleitblatt', [
    'Ausstellender Kostenträger, Datum und Aktenzeichen', 'Bewilligter Leistungsumfang, Zeitraum und Bedingungen laut Bescheid', 'Zugeordnete Abrechnungsunterlagen und offene Rückfragen',
  ], 'Kostenzusage oder Bescheid des ausstellenden Kostenträgers im Original hinterlegen. Umfang und Gültigkeit aus dem Original übernehmen.'),
  csdc_teilstationaer_015: {
    fieldLabels: ['Rückgabeanlass, Ort, Datum und Zeitraum', 'Übergebende und empfangende Person', 'Ausstehende Rückgaben und Folgeschritte'],
    columns: ['Gegenstand / Kennzeichnung', 'Menge / Einheit', 'Zustand / Abweichung', 'Übergeben am / um', 'Übergeben an', 'Empfangsbestätigung'],
  },
  csdc_personal_012: { modules: ['office', 'stationaer'], instructions: 'Nachweis der Qualifikation für zusätzliche Betreuung in stationären Pflegeeinrichtungen. Für ambulante Unterstützungsangebote gelten die Anforderungen des jeweiligen Angebots und des anwendbaren Landesrechts.' },
};
