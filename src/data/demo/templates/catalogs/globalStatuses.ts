import { batchCat } from '../helpers';

const CLIENT_STATUSES = [
  { key: 'aktiv', label: 'Aktiv', desc: 'Reguläre Betreuung läuft' },
  { key: 'aufnahme', label: 'Aufnahme', desc: 'Aufnahmeprozess / Intake' },
  { key: 'warteliste', label: 'Warteliste', desc: 'Wartet auf Kapazität' },
  { key: 'neu', label: 'Neu angelegt', desc: 'Stammdaten erfasst, noch nicht aktiv' },
  { key: 'entwurf', label: 'Entwurf', desc: 'Unvollständige Anlage' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', desc: 'Unter Klärung / Bearbeitung' },
  { key: 'wartet_auf_vertrag', label: 'Wartet auf Vertrag', desc: 'Vertragsunterzeichnung ausstehend' },
  { key: 'pausiert', label: 'Pausiert', desc: 'Leistungen vorübergehend ausgesetzt' },
  { key: 'beurlaubt', label: 'Beurlaubt', desc: 'Temporäre Beurlaubung' },
  { key: 'urlaub_abwesend', label: 'Abwesend', desc: 'Klient:in vorübergehend nicht erreichbar' },
  { key: 'kurzzeitpflege', label: 'Kurzzeitpflege', desc: 'Kurzzeitpflege / Übergang' },
  { key: 'nachsorge', label: 'Nachsorge', desc: 'Nachsorgephase nach Entlassung' },
  { key: 'entlassung_geplant', label: 'Entlassung geplant', desc: 'Entlassung vorbereitet' },
  { key: 'gesperrt', label: 'Gesperrt', desc: 'Datensatz gesperrt' },
  { key: 'archiviert', label: 'Archiviert', desc: 'Inaktiv / archiviert' },
  { key: 'verstorben', label: 'Verstorben', desc: 'Trauerfall — Dokumentation abgeschlossen' },
] as const;

const EMPLOYEE_STATUSES = [
  { key: 'aktiv', label: 'Aktiv', desc: 'Im Einsatz' },
  { key: 'probezeit', label: 'Probezeit', desc: 'Probezeit läuft' },
  { key: 'einarbeitung', label: 'Einarbeitung', desc: 'Einarbeitungsphase' },
  { key: 'urlaub', label: 'Im Urlaub', desc: 'Genehmigter Urlaub' },
  { key: 'krank', label: 'Krankgemeldet', desc: 'AU / Krankmeldung' },
  { key: 'elternzeit', label: 'Elternzeit', desc: 'Elternzeit / Mutterschutz' },
  { key: 'fortbildung', label: 'Fortbildung', desc: 'Schulung / Fortbildung' },
  { key: 'teilzeit', label: 'Teilzeit', desc: 'Reduzierte Arbeitszeit' },
  { key: 'freigestellt', label: 'Freigestellt', desc: 'Vorübergehend freigestellt' },
  { key: 'kuendigung_laeuft', label: 'Kündigung läuft', desc: 'Kündigungsfrist' },
  { key: 'ausgeschieden', label: 'Ausgeschieden', desc: 'Nicht mehr im Unternehmen' },
  { key: 'gesperrt', label: 'Gesperrt', desc: 'Zugang gesperrt' },
  { key: 'archiviert', label: 'Archiviert', desc: 'Archivierter Datensatz' },
] as const;

const ASSIGNMENT_STATUSES = [
  { key: 'geplant', label: 'Geplant', desc: 'Einsatz geplant' },
  { key: 'bestaetigt', label: 'Bestätigt', desc: 'Vom Team bestätigt' },
  { key: 'zugewiesen', label: 'Zugewiesen', desc: 'Mitarbeiter:in zugewiesen' },
  { key: 'unterwegs', label: 'Unterwegs', desc: 'Anfahrt zum Einsatz' },
  { key: 'eingetroffen', label: 'Eingetroffen', desc: 'Vor Ort eingetroffen' },
  { key: 'in_ausfuehrung', label: 'In Ausführung', desc: 'Leistung wird erbracht' },
  { key: 'unterbrochen', label: 'Unterbrochen', desc: 'Einsatz unterbrochen' },
  { key: 'abgeschlossen', label: 'Abgeschlossen', desc: 'Leistung abgeschlossen' },
  { key: 'dokumentiert', label: 'Dokumentiert', desc: 'Dokumentation erfasst' },
  { key: 'abgerechnet', label: 'Abgerechnet', desc: 'Abrechnung erfolgt' },
  { key: 'nicht_erledigt', label: 'Nicht erledigt', desc: 'Einsatz nicht durchgeführt' },
  { key: 'abgesagt_klient', label: 'Abgesagt (Klient:in)', desc: 'Absage durch Klient:in' },
  { key: 'abgesagt_team', label: 'Abgesagt (Team)', desc: 'Absage durch Team' },
  { key: 'verschoben', label: 'Verschoben', desc: 'Termin verschoben' },
  { key: 'ersatz_einsatz', label: 'Ersatzeinsatz', desc: 'Ersatz durch andere Person' },
  { key: 'qualitaetspruefung', label: 'Qualitätsprüfung', desc: 'In Qualitätsprüfung' },
  { key: 'reklamation', label: 'Reklamation', desc: 'Reklamation offen' },
  { key: 'storniert', label: 'Storniert', desc: 'Storniert' },
  { key: 'archiviert', label: 'Archiviert', desc: 'Archiviert' },
] as const;

const DOCUMENT_STATUSES = [
  { key: 'entwurf', label: 'Entwurf', desc: 'Noch nicht finalisiert' },
  { key: 'hochgeladen', label: 'Hochgeladen', desc: 'Datei hochgeladen' },
  { key: 'in_pruefung', label: 'In Prüfung', desc: 'Wird geprüft' },
  { key: 'freigegeben', label: 'Freigegeben', desc: 'Freigegeben zur Nutzung' },
  { key: 'signiert', label: 'Signiert', desc: 'Unterschrieben / signiert' },
  { key: 'versendet', label: 'Versendet', desc: 'An Empfänger versendet' },
  { key: 'abgelaufen', label: 'Abgelaufen', desc: 'Gültigkeit abgelaufen' },
  { key: 'ersetzt', label: 'Ersetzt', desc: 'Durch neuere Version ersetzt' },
  { key: 'gesperrt', label: 'Gesperrt', desc: 'Zugriff gesperrt' },
  { key: 'archiviert', label: 'Archiviert', desc: 'Archiviert' },
] as const;

const INVOICE_STATUSES = [
  { key: 'entwurf', label: 'Entwurf', desc: 'Rechnungsentwurf' },
  { key: 'geprueft', label: 'Geprüft', desc: 'Intern geprüft' },
  { key: 'freigegeben', label: 'Freigegeben', desc: 'Zur Versendung freigegeben' },
  { key: 'versendet', label: 'Versendet', desc: 'An Kostenträger versendet' },
  { key: 'teilbezahlt', label: 'Teilbezahlt', desc: 'Teilzahlung eingegangen' },
  { key: 'bezahlt', label: 'Bezahlt', desc: 'Vollständig bezahlt' },
  { key: 'ueberfaellig', label: 'Überfällig', desc: 'Zahlungsziel überschritten' },
  { key: 'gemahnt', label: 'Gemahnt', desc: 'Mahnverfahren läuft' },
  { key: 'storniert', label: 'Storniert', desc: 'Storniert' },
  { key: 'gutschrift', label: 'Gutschrift', desc: 'Gutschrift erstellt' },
  { key: 'abgelehnt', label: 'Abgelehnt', desc: 'Von Kostenträger abgelehnt' },
  { key: 'archiviert', label: 'Archiviert', desc: 'Archiviert' },
] as const;

const MESSAGE_STATUSES = [
  { key: 'entwurf', label: 'Entwurf', desc: 'Nachricht als Entwurf' },
  { key: 'geplant', label: 'Geplant', desc: 'Versand geplant' },
  { key: 'in_warteschlange', label: 'In Warteschlange', desc: 'Wartet auf Versand' },
  { key: 'gesendet', label: 'Gesendet', desc: 'Erfolgreich gesendet' },
  { key: 'zugestellt', label: 'Zugestellt', desc: 'Beim Empfänger angekommen' },
  { key: 'gelesen', label: 'Gelesen', desc: 'Vom Empfänger gelesen' },
  { key: 'beantwortet', label: 'Beantwortet', desc: 'Antwort erhalten' },
  { key: 'fehlgeschlagen', label: 'Fehlgeschlagen', desc: 'Versand fehlgeschlagen' },
  { key: 'zurueckgezogen', label: 'Zurückgezogen', desc: 'Nachricht zurückgezogen' },
  { key: 'archiviert', label: 'Archiviert', desc: 'Archiviert' },
] as const;

export const GLOBAL_STATUS_CATALOGS = [
  ...batchCat('client_status', 'office', 'cat-client-st', CLIENT_STATUSES),
  ...batchCat('employee_status', 'office', 'cat-emp-st', EMPLOYEE_STATUSES),
  ...batchCat('assignment_status', 'assist', 'cat-asg-st', ASSIGNMENT_STATUSES),
  ...batchCat('document_status', 'documents', 'cat-doc-st', DOCUMENT_STATUSES),
  ...batchCat('invoice_status', 'billing', 'cat-inv-st', INVOICE_STATUSES),
  ...batchCat('message_status', 'communication', 'cat-msg-st', MESSAGE_STATUSES),
];
