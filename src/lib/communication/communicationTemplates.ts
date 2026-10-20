import type { CommunicationPriority } from '@/features/communication/communication.types';
import type { CareSuiteTemplate } from '@/types/templates';
import type { ComposeTemplateAudience } from '@/lib/templates/composeTemplateAudiences';
import { SEED_TIMESTAMP } from '@/data/demo/templates/helpers';

export type CommunicationTemplateDefinition = {
  template_key: string;
  template_name: string;
  template_category: string;
  recipient_type: ComposeTemplateAudience;
  module_key: 'communication';
  priority_default: CommunicationPriority;
  subject_template: string;
  body_template: string;
  sort_order: number;
};

function def(
  template_key: string,
  template_name: string,
  template_category: string,
  recipient_type: ComposeTemplateAudience,
  priority_default: CommunicationPriority,
  subject_template: string,
  body_template: string,
  sort_order: number,
): CommunicationTemplateDefinition {
  return {
    template_key,
    template_name,
    template_category,
    recipient_type,
    module_key: 'communication',
    priority_default,
    subject_template,
    body_template,
    sort_order,
  };
}

const KLIENT_TEMPLATES: CommunicationTemplateDefinition[] = [
  def('klient_termin_bestaetigung', 'Terminbestätigung', 'Termine', 'klient', 'normal', 'Terminbestätigung am {{date}}', 'Guten Tag {{clientName}},\n\nhiermit bestätigen wir Ihren Termin am {{date}} um {{time}} Uhr. Bei Rückfragen erreichen Sie uns unter {{phone}}.\n\nFreundliche Grüße\nIhr Pflegeteam', 1),
  def('klient_termin_erinnerung', 'Erinnerung Termin', 'Termine', 'klient', 'normal', 'Erinnerung: Termin am {{date}}', 'Liebe:r {{clientName}},\n\nwir möchten Sie freundlich an Ihren Termin am {{date}} um {{time}} Uhr erinnern. Bitte melden Sie sich, falls Sie verhindert sind.\n\nHerzliche Grüße', 2),
  def('klient_termin_absage', 'Terminabsage', 'Termine', 'klient', 'high', 'Terminabsage am {{date}}', 'Guten Tag {{clientName}},\n\nleider müssen wir den Termin am {{date}} absagen. Wir melden uns zeitnah mit einem neuen Vorschlag.\n\nEntschuldigen Sie die Unannehmlichkeiten.', 3),
  def('klient_unterlagen_nachfrage', 'Nachfrage Unterlagen', 'Dokumente', 'klient', 'normal', 'Unterlagen benötigt', 'Guten Tag {{clientName}},\n\nfür die weitere Bearbeitung benötigen wir noch folgende Unterlagen: {{info}}. Sie können diese im Portal hochladen oder uns per Post zukommen lassen.\n\nVielen Dank für Ihre Unterstützung.', 4),
  def('klient_entschuldigung_verzoegerung', 'Entschuldigung Verzögerung', 'Service', 'klient', 'high', 'Entschuldigung — {{topic}}', 'Liebe:r {{clientName}},\n\nwir bitten um Entschuldigung für die Verzögerung bei {{topic}}. Wir arbeiten mit Hochdruck daran und melden uns bis {{date}} bei Ihnen.\n\nMit freundlichen Grüßen', 5),
  def('klient_willkommen', 'Willkommensnachricht', 'Onboarding', 'klient', 'normal', 'Herzlich willkommen', 'Herzlich willkommen, {{clientName}}!\n\nwir freuen uns, Sie in unserer Einrichtung betreuen zu dürfen. Bei Fragen stehen wir Ihnen jederzeit unter {{phone}} zur Verfügung.\n\nIhr Betreuungsteam', 6),
  def('klient_buero_abwesenheit', 'Urlaubsabwesenheit', 'Organisation', 'klient', 'normal', 'Hinweis Bürozeiten', 'Guten Tag {{clientName}},\n\nbitte beachten Sie, dass unser Büro vom {{startDate}} bis {{endDate}} geschlossen ist. In dringenden Fällen wenden Sie sich bitte an {{phone}}.\n\nFreundliche Grüße', 7),
  def('klient_rechnungshinweis', 'Rechnungshinweis', 'Abrechnung', 'klient', 'normal', 'Rechnung {{month}}', 'Guten Tag {{clientName}},\n\nIhre Rechnung für {{month}} steht im Portal bereit. Bei Fragen zur Abrechnung erreichen Sie uns unter {{phone}}.\n\nMit freundlichen Grüßen\nBuchhaltung', 8),
  def('klient_dank_nachricht', 'Dank für Nachricht', 'Service', 'klient', 'low', 'Ihre Nachricht ist eingegangen', 'Liebe:r {{clientName}},\n\nvielen Dank für Ihre Nachricht. Wir haben diese erhalten und bearbeiten Ihr Anliegen. Sie erhalten zeitnah eine Rückmeldung.\n\nHerzliche Grüße', 9),
  def('klient_dokument_bereit', 'Dokument bereit', 'Dokumente', 'klient', 'normal', 'Neues Dokument im Portal', 'Guten Tag {{clientName}},\n\nein neues Dokument steht in Ihrem Portal zur Verfügung. Bitte prüfen Sie die Unterlagen und geben Sie uns bei Bedarf Rückmeldung.\n\nFreundliche Grüße', 10),
  def('klient_info_allgemein', 'Information Allgemein', 'Information', 'klient', 'normal', 'Information von {{companyName}}', 'Guten Tag {{clientName}},\n\nwir möchten Sie über Folgendes informieren: {{info}}\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen', 11),
  def('klient_rueckrufbitte', 'Rückrufbitte', 'Kontakt', 'klient', 'high', 'Bitte um Rückruf', 'Guten Tag {{clientName}},\n\nwir haben versucht, Sie telefonisch zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück — am besten zwischen {{time}} und 16:00 Uhr.\n\nVielen Dank!', 12),
  def('klient_pflegeplan_besprechung', 'Pflegeplan-Besprechung', 'Pflege', 'klient', 'normal', 'Einladung Pflegeplan-Besprechung', 'Guten Tag {{clientName}},\n\nwir laden Sie zur Besprechung Ihres Pflegeplans am {{date}} um {{time}} Uhr ein. Thema: {{topic}}.\n\nBitte bestätigen Sie Ihre Teilnahme.\n\nIhr Pflegeteam', 13),
  def('klient_medikamentenhinweis', 'Medikamentenhinweis', 'Pflege', 'klient', 'high', 'Medikamentenhinweis', 'Guten Tag {{clientName}},\n\nbitte beachten Sie folgende Medikamentenänderung: {{info}}. Bei Unklarheiten wenden Sie sich an Ihre Pflegekraft oder den Hausarzt.\n\nMit freundlichen Grüßen', 14),
  def('klient_hausarzt_termin', 'Hausarzt-Termin', 'Termine', 'klient', 'normal', 'Hausarzt-Termin', 'Guten Tag {{clientName}},\n\nwir haben einen Hausarzt-Termin für Sie am {{date}} um {{time}} Uhr vereinbart. Ort: {{location}}.\n\nBitte bringen Sie Ihre Medikamentenliste mit.\n\nIhr Pflegeteam', 15),
  def('klient_klinik_aufnahme', 'Krankenhaus-Aufnahme', 'Klinik', 'klient', 'high', 'Information Krankenhausaufenthalt', 'Guten Tag {{contactName}},\n\n{{clientName}} wurde am {{date}} in {{hospitalName}} aufgenommen. Wir halten Sie über den weiteren Verlauf informiert.\n\nBei Rückfragen: {{phone}}', 16),
  def('klient_klinik_entlassung', 'Entlassung aus Klinik', 'Klinik', 'klient', 'high', 'Entlassung aus der Klinik', 'Guten Tag {{clientName}},\n\nwir freuen uns, Sie nach Ihrer Entlassung aus {{hospitalName}} am {{date}} wieder betreuen zu dürfen. Besondere Hinweise: {{info}}\n\nIhr Pflegeteam', 17),
  def('klient_angehoerige_info', 'Angehörigen-Information', 'Angehörige', 'klient', 'normal', 'Information für Angehörige', 'Guten Tag {{contactName}},\n\nwir möchten Sie über {{clientName}} informieren: {{info}}\n\nBei Rückfragen erreichen Sie uns unter {{phone}}.\n\nMit freundlichen Grüßen', 18),
  def('klient_leistungsaenderung', 'Leistungsänderung', 'Leistungen', 'klient', 'normal', 'Änderung der Leistungen', 'Guten Tag {{clientName}},\n\nab {{date}} ändern sich Ihre vereinbarten Leistungen: {{info}}. Bei Fragen vereinbaren Sie bitte einen Rücksprachetermin.\n\nFreundliche Grüße', 19),
  def('klient_besuchstermin', 'Besuchstermin', 'Besuche', 'klient', 'normal', 'Besuchstermin', 'Guten Tag {{clientName}},\n\nfür {{date}} um {{time}} Uhr ist ein Besuch geplant. Bitte teilen Sie uns mit, ob der Termin passt.\n\nHerzliche Grüße', 20),
  def('klient_transport', 'Transport organisiert', 'Organisation', 'klient', 'normal', 'Transport am {{date}}', 'Guten Tag {{clientName}},\n\nfür {{date}} um {{time}} Uhr ist ein Transport zu {{location}} organisiert. Bitte seien Sie rechtzeitig bereit.\n\nFreundliche Grüße', 21),
  def('klient_einverstaendnis', 'Einverständnis erforderlich', 'Dokumente', 'klient', 'high', 'Einverständnis erforderlich', 'Guten Tag {{clientName}},\n\nfür {{topic}} benötigen wir Ihr Einverständnis. Bitte prüfen Sie das Dokument im Portal und geben Sie uns bis {{date}} Rückmeldung.\n\nVielen Dank!', 22),
  def('klient_beschwerde', 'Beschwerde eingegangen', 'Service', 'klient', 'high', 'Ihre Rückmeldung', 'Guten Tag {{clientName}},\n\nwir haben Ihre Rückmeldung erhalten und nehmen diese ernst. Wir bearbeiten Ihr Anliegen und melden uns bis {{date}} bei Ihnen.\n\nMit freundlichen Grüßen\nQualitätsmanagement', 23),
  def('klient_pflegegrad', 'Pflegegrad-Information', 'Beratung', 'klient', 'normal', 'Information Pflegegrad', 'Guten Tag {{clientName}},\n\nzur Information: {{info}}. Ihr aktueller Pflegegrad: {{careLevel}}. Bei Fragen unterstützen wir Sie gerne.\n\nFreundliche Grüße', 24),
  def('klient_notfall_info', 'Notfall-Information', 'Notfall', 'klient', 'critical', 'Wichtige Notfallinformation', 'Guten Tag {{contactName}},\n\nwichtige Information zu {{clientName}}: {{info}}\n\nBitte nehmen Sie umgehend Kontakt mit uns auf: {{phone}}.\n\nPflegedienstleitung', 25),
  def('klient_portal_zugang', 'Portal-Zugang', 'Portal', 'klient', 'normal', 'Ihr Portal-Zugang', 'Guten Tag {{clientName}},\n\nIhr Zugang zum Klientenportal ist eingerichtet. Bei Fragen zur Anmeldung erreichen Sie uns unter {{phone}} oder {{email}}.\n\nFreundliche Grüße\n{{companyName}}', 26),
];

const MITARBEITER_TEMPLATES: CommunicationTemplateDefinition[] = [
  def('ma_schichtplan', 'Schichtplan Info', 'Dienstplan', 'mitarbeiter', 'normal', 'Schichtplan {{month}}', 'Hallo {{employeeName}},\n\nder aktualisierte Schichtplan für {{month}} ist verfügbar. Bitte prüfen Sie Ihre Einsätze und melden Sie Konflikte bis {{date}}.\n\nVielen Dank!', 1),
  def('ma_einsatzaenderung', 'Einsatzänderung', 'Einsatz', 'mitarbeiter', 'high', 'Einsatzänderung am {{date}}', 'Hallo {{employeeName}},\n\nfür den {{date}} hat sich Ihr Einsatz geändert: {{info}}. Bitte bestätigen Sie den Erhalt dieser Nachricht.\n\nDienstplanung', 2),
  def('ma_doku_fehlt', 'Dokumentation fehlt', 'Dokumentation', 'mitarbeiter', 'high', 'Dokumentation fehlt', 'Hallo {{employeeName}},\n\nfür den Einsatz bei {{clientName}} am {{date}} fehlt noch die Dokumentation. Bitte ergänzen Sie diese bis {{endDate}}.\n\nVielen Dank!', 3),
  def('ma_willkommen', 'Willkommen im Team', 'Onboarding', 'mitarbeiter', 'normal', 'Willkommen im Team', 'Herzlich willkommen im Team, {{employeeName}}!\n\nwir freuen uns, Sie bei uns begrüßen zu dürfen. Bei Fragen wenden Sie sich an Ihre Teamleitung oder das Büro.\n\nIhr Pflegeteam', 4),
  def('ma_urlaub_freigabe', 'Urlaubsfreigabe', 'Personal', 'mitarbeiter', 'normal', 'Urlaub genehmigt', 'Hallo {{employeeName}},\n\nIhr Urlaubsantrag vom {{date}} bis {{endDate}} wurde genehmigt. Bitte hinterlegen Sie die Vertretung im Dienstplan.\n\nFreundliche Grüße\nPersonalbüro', 5),
  def('ma_schulung_einladung', 'Schulungseinladung', 'Fortbildung', 'mitarbeiter', 'normal', 'Pflichtschulung: {{topic}}', 'Hallo {{employeeName}},\n\nSie sind zur Pflichtschulung „{{topic}}“ am {{date}} um {{time}} Uhr eingeladen. Ort: {{info}}. Bitte bestätigen Sie Ihre Teilnahme.\n\nFortbildungsteam', 6),
  def('ma_fortbildung_erinnerung', 'Fortbildung Erinnerung', 'Fortbildung', 'mitarbeiter', 'normal', 'Erinnerung Fortbildung', 'Hallo {{employeeName}},\n\nErinnerung: Ihre Fortbildung „{{topic}}“ findet am {{date}} statt. Bitte bringen Sie Ihren Nachweis mit.\n\nAkademie', 7),
  def('ma_dienstuebergabe', 'Dienstübergabe', 'Schicht', 'mitarbeiter', 'normal', 'Dienstübergabe {{date}}', 'Hallo {{employeeName}},\n\nÜbergabe vom {{date}}: {{summary}}\n\nBitte beachten Sie die besonderen Hinweise im Dienstbuch.\n\nSchichtleitung', 8),
  def('ma_toureninfo', 'Fahrzeug-/Toureninfo', 'Disposition', 'mitarbeiter', 'normal', 'Tour am {{date}}', 'Hallo {{employeeName}},\n\nfür Ihre Tour am {{date}}: {{info}}. Bitte prüfen Sie Fahrzeug und Material vor Tourbeginn.\n\nDisposition', 9),
  def('ma_zeiterfassung', 'Zeiterfassung Hinweis', 'Personal', 'mitarbeiter', 'high', 'Zeiterfassung {{month}}', 'Hallo {{employeeName}},\n\nbitte ergänzen Sie Ihre Zeiterfassung für {{month}} bis {{date}}. Offene Einträge können die Abrechnung verzögern.\n\nBüro', 10),
  def('ma_gesundheitszeugnis', 'Gesundheitszeugnis', 'Personal', 'mitarbeiter', 'high', 'Gesundheitszeugnis fällig', 'Hallo {{employeeName}},\n\nbitte reichen Sie Ihr aktuelles Gesundheitszeugnis bis {{date}} im Personalbüro ein.\n\nVielen Dank!', 11),
  def('ma_rueckmeldung', 'Rückmeldung erbeten', 'Allgemein', 'mitarbeiter', 'normal', 'Rückmeldung erbeten', 'Hallo {{employeeName}},\n\nbitte geben Sie uns Rückmeldung zu: {{info}}. Antwort bitte bis {{date}}.\n\nDanke!', 12),
  def('ma_arbeitszeit_aenderung', 'Arbeitszeitänderung', 'Dienstplan', 'mitarbeiter', 'high', 'Arbeitszeitänderung', 'Hallo {{employeeName}},\n\nab {{date}} ändert sich Ihre Arbeitszeit: {{info}}. Bitte bestätigen Sie den Erhalt.\n\nPersonalbüro', 13),
  def('ma_krankmeldung', 'Krankmeldung bestätigt', 'Personal', 'mitarbeiter', 'normal', 'Krankmeldung erhalten', 'Hallo {{employeeName}},\n\nwir haben Ihre Krankmeldung für den {{date}} erhalten. Gute Besserung! Bei längerer Abwesenheit melden Sie sich bitte im Personalbüro.\n\nFreundliche Grüße', 14),
  def('ma_probezeit', 'Probezeit-Gespräch', 'Personal', 'mitarbeiter', 'normal', 'Einladung Probezeitgespräch', 'Hallo {{employeeName}},\n\nwir laden Sie zum Probezeitgespräch am {{date}} um {{time}} Uhr ein. Ort: {{location}}.\n\nPersonalbüro', 15),
  def('ma_leistungsbeurteilung', 'Leistungsbeurteilung', 'Personal', 'mitarbeiter', 'normal', 'Leistungsbeurteilung', 'Hallo {{employeeName}},\n\nIhre Leistungsbeurteilung für {{period}} steht zur Besprechung bereit. Termin: {{date}} um {{time}} Uhr.\n\nTeamleitung', 16),
  def('ma_arbeitskleidung', 'Arbeitskleidung', 'Organisation', 'mitarbeiter', 'normal', 'Arbeitskleidung', 'Hallo {{employeeName}},\n\nIhre Arbeitskleidung kann ab {{date}} im Personalbüro abgeholt werden. Bitte bringen Sie Ihren Ausweis mit.\n\nBüro', 17),
  def('ma_impfung', 'Impfung/Erstimpfung', 'Gesundheit', 'mitarbeiter', 'high', 'Impfstatus', 'Hallo {{employeeName}},\n\nbitte reichen Sie Ihren aktuellen Impfnachweis bis {{date}} ein oder vereinbaren Sie einen Termin.\n\nPersonalbüro', 18),
  def('ma_erste_hilfe', 'Erste-Hilfe-Kurs', 'Fortbildung', 'mitarbeiter', 'normal', 'Erste-Hilfe-Kurs', 'Hallo {{employeeName}},\n\nIhr Erste-Hilfe-Kurs findet am {{date}} um {{time}} Uhr statt. Ort: {{location}}. Teilnahme ist verpflichtend.\n\nAkademie', 19),
  def('ma_fuehrungszeugnis', 'Führungszeugnis', 'Personal', 'mitarbeiter', 'high', 'Führungszeugnis', 'Hallo {{employeeName}},\n\nbitte reichen Sie ein aktuelles erweitertes Führungszeugnis bis {{date}} ein.\n\nPersonalbüro', 20),
  def('ma_einsatz_abbruch', 'Einsatz Abbruch', 'Einsatz', 'mitarbeiter', 'critical', 'Einsatz abgebrochen', 'Hallo {{employeeName}},\n\nder Einsatz bei {{clientName}} am {{date}} wurde abgebrochen. Grund: {{info}}. Bitte melden Sie sich in der Disposition.\n\nDisposition', 21),
  def('ma_fahrzeug_hinweis', 'Fahrzeug Hinweis', 'Disposition', 'mitarbeiter', 'normal', 'Fahrzeug {{date}}', 'Hallo {{employeeName}},\n\nfür {{date}} ist Fahrzeug {{info}} zugewiesen. Bitte prüfen Sie Tankstand und Pflegeutensilien.\n\nDisposition', 22),
  def('ma_personalgespraech', 'Personalgespräch', 'Personal', 'mitarbeiter', 'normal', 'Personalgespräch', 'Hallo {{employeeName}},\n\nwir laden Sie zum Personalgespräch am {{date}} um {{time}} Uhr ein. Thema: {{topic}}.\n\nTeamleitung', 23),
  def('ma_arbeitsunfall', 'Arbeitsunfall Meldung', 'Gesundheit', 'mitarbeiter', 'critical', 'Arbeitsunfall — Rückmeldung', 'Hallo {{employeeName}},\n\nbitte dokumentieren Sie den Vorfall vom {{date}} vollständig und reichen Sie alle Unterlagen bis {{endDate}} ein.\n\nArbeitsschutz', 24),
  def('ma_quartals_feedback', 'Quartals-Feedback', 'Team', 'mitarbeiter', 'normal', 'Quartals-Feedback', 'Hallo {{employeeName}},\n\nbitte geben Sie bis {{date}} Ihr Feedback zum vergangenen Quartal ab: {{info}}\n\nTeamleitung', 25),
  def('ma_vertretung', 'Vertretung gesucht', 'Dienstplan', 'mitarbeiter', 'urgent', 'Vertretung am {{date}}', 'Hallo {{employeeName}},\n\nfür den {{date}} wird dringend eine Vertretung gesucht: {{info}}. Bitte melden Sie sich, falls Sie einspringen können.\n\nDienstplanung', 26),
];

const TEAM_TEMPLATES: CommunicationTemplateDefinition[] = [
  def('team_meeting', 'Team-Meeting', 'Meeting', 'team', 'normal', 'Team-Meeting am {{date}}', 'Liebes Team,\n\nwir laden zum Team-Meeting am {{date}} um {{time}} Uhr ein. Tagesordnung: {{info}}\n\nBitte nehmen Sie teil.\n\nTeamleitung', 1),
  def('team_wichtige_info', 'Wichtige Info', 'Information', 'team', 'high', 'Wichtige Information', 'Liebes Team,\n\nwichtige Information: {{info}}\n\nBitte lesen und bei Fragen melden.\n\nSchichtleitung', 2),
  def('team_prozess', 'Prozessänderung', 'Prozesse', 'team', 'high', 'Prozessänderung ab {{date}}', 'Liebes Team,\n\nab {{date}} gilt eine geänderte Vorgehensweise: {{info}}. Die Details finden Sie im QM-Handbuch.\n\nBitte um Beachtung.', 3),
  def('team_qm_hinweis', 'QM-Hinweis', 'Qualität', 'team', 'normal', 'QM-Hinweis', 'Liebes Team,\n\nQM-Hinweis: {{info}}. Bitte dokumentieren Sie entsprechend und melden Sie Auffälligkeiten.\n\nQualitätsmanagement', 4),
  def('team_schicht_uebergabe', 'Übergabe Schicht', 'Schicht', 'team', 'normal', 'Schichtübergabe {{shift}}', 'Übergabe {{shift}} am {{date}}:\n\n{{summary}}\n\nBitte alle Punkte im Dienstbuch prüfen.\n\nSchichtleitung', 5),
  def('team_personalengpass', 'Personalengpass', 'Personal', 'team', 'urgent', 'Personalengpass am {{date}}', 'Liebes Team,\n\nam {{date}} besteht ein Personalengpass. Wer kurzfristig einspringen kann, melde sich bitte im Büro.\n\nVielen Dank!', 6),
  def('team_hygiene', 'Hygienehinweis', 'Qualität', 'team', 'high', 'Hygienehinweis', 'Liebes Team,\n\nbitte beachten Sie den aktualisierten Hygienehinweis: {{info}}. Einhaltung ist für alle Bereiche verbindlich.\n\nQM', 7),
  def('team_besuch', 'Besuch/Angehörige', 'Klient', 'team', 'normal', 'Besuch bei {{clientName}}', 'Liebes Team,\n\nam {{date}} ist ein Besuch bei {{clientName}} geplant. Bitte koordinieren Sie Zeiten und dokumentieren Sie den Verlauf.\n\nPflegedienst', 8),
  def('team_notfalluebung', 'Notfallübung', 'Sicherheit', 'team', 'high', 'Notfallübung am {{date}}', 'Liebes Team,\n\nam {{date}} um {{time}} Uhr findet eine Notfallübung statt. Bitte nehmen Sie teil und beachten Sie die Ablaufpläne.\n\nEinrichtungsleitung', 9),
  def('team_feedback', 'Feedback Runde', 'Team', 'team', 'normal', 'Feedback-Runde', 'Liebes Team,\n\nwir laden zur Feedback-Runde am {{date}} ein. Thema: {{topic}}. Ihre Rückmeldungen sind uns wichtig.\n\nTeamleitung', 10),
  def('team_einarbeitung', 'Einarbeitung neuer MA', 'Personal', 'team', 'normal', 'Einarbeitung', 'Liebes Team,\n\nab {{date}} beginnt die Einarbeitung von {{employeeName}}. Bitte unterstützen Sie {{toPerson}} in der ersten Woche.\n\nTeamleitung', 11),
  def('team_audit', 'Audit-Vorbereitung', 'Qualität', 'team', 'high', 'Audit-Vorbereitung', 'Liebes Team,\n\nam {{date}} findet ein Audit statt. Bitte bereiten Sie folgende Bereiche vor: {{info}}\n\nQM', 12),
  def('team_wundmanagement', 'Wundmanagement Schulung', 'Fortbildung', 'team', 'normal', 'Wundmanagement', 'Liebes Team,\n\nSchulung Wundmanagement am {{date}} um {{time}} Uhr. Teilnahme verpflichtend für alle Pflegekräfte.\n\nPDL', 13),
  def('team_sturzprotokoll', 'Sturzprotokoll Hinweis', 'Sicherheit', 'team', 'high', 'Sturz bei {{clientName}}', 'Liebes Team,\n\nes liegt ein Sturzereignis bei {{clientName}} vor. Bitte prüfen Sie Maßnahmen und dokumentieren Sie gemäß Protokoll.\n\nSchichtleitung', 14),
  def('team_dienstplan', 'Dienstplan Veröffentlichung', 'Dienstplan', 'team', 'normal', 'Neuer Dienstplan', 'Liebes Team,\n\nder Dienstplan für {{month}} ist veröffentlicht. Bitte prüfen Sie Ihre Einsätze bis {{date}}.\n\nDienstplanung', 15),
  def('team_inventur', 'Inventur', 'Organisation', 'team', 'normal', 'Inventur am {{date}}', 'Liebes Team,\n\nam {{date}} findet eine Inventur statt. Bitte stellen Sie Material und Dokumentation bereit.\n\nVerwaltung', 16),
  def('team_angehoerige', 'Koordination Angehörige', 'Klient', 'team', 'normal', 'Angehörigenkontakt', 'Liebes Team,\n\nfür {{clientName}} ist Abstimmung mit Angehörigen erforderlich: {{info}}\n\nBitte koordinieren Sie Termine.\n\nPflegedienst', 17),
  def('team_wetter', 'Wetter-/Unwetter Hinweis', 'Sicherheit', 'team', 'urgent', 'Wetterwarnung', 'Liebes Team,\n\nWetterwarnung für {{date}}: {{info}}. Bitte beachten Sie erhöhte Vorsicht bei Touren und Besuchen.\n\nEinrichtungsleitung', 18),
];

const INTERN_TEMPLATES: CommunicationTemplateDefinition[] = [
  def('intern_standard', 'Standardantwort Büro', 'Allgemein', 'intern', 'low', 'Ihre Nachricht', 'Guten Tag,\n\nvielen Dank für Ihre Nachricht. Wir bearbeiten Ihr Anliegen und melden uns zeitnah.\n\nFreundliche Grüße\nBüro', 1),
  def('intern_weiterleitung', 'Weiterleitung', 'Workflow', 'intern', 'normal', 'Weiterleitung', 'Hallo,\n\nIhre Anfrage wurde an {{employeeName}} weitergeleitet. Sie erhalten in Kürze eine Rückmeldung.\n\nBüro', 2),
  def('intern_rueckruf', 'Rückrufbitte', 'Kontakt', 'intern', 'high', 'Rückruf erbeten', 'Guten Tag,\n\nwir haben versucht, Sie zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück.\n\nVielen Dank!\nBüro', 3),
  def('intern_unterlagen', 'Unterlagen angefordert', 'Dokumente', 'intern', 'normal', 'Unterlagen angefordert', 'Guten Tag,\n\nbitte reichen Sie folgende Unterlagen ein: {{info}}. Eingang bis {{date}} erbeten.\n\nBüro', 4),
  def('intern_termin', 'Termin intern', 'Termine', 'intern', 'normal', 'Interner Termin', 'Hallo Team,\n\ninterner Termin am {{date}} um {{time}} Uhr: {{topic}}. Bitte vormerken.\n\nBüro', 5),
  def('intern_it', 'IT-Hinweis', 'IT', 'intern', 'normal', 'IT-Hinweis', 'Hallo,\n\nIT-Hinweis: {{info}}. Bei Problemen wenden Sie sich an den Support.\n\nIT', 6),
  def('intern_datenschutz', 'Datenschutz Info', 'Datenschutz', 'intern', 'normal', 'Datenschutz', 'Hallo,\n\nzur Information: {{info}}. Bitte beachten Sie die Datenschutzrichtlinien im Intranet.\n\nDatenschutzbeauftragte:r', 7),
  def('intern_abwesenheit', 'Abwesenheit Kolleg:in', 'Personal', 'intern', 'normal', 'Abwesenheit', 'Hallo,\n\n{{employeeName}} ist vom {{startDate}} bis {{endDate}} abwesend. Anliegen bitte an {{info}} richten.\n\nBüro', 8),
  def('intern_eingang', 'Bestätigung Eingang', 'Workflow', 'intern', 'low', 'Eingang bestätigt', 'Guten Tag,\n\nwir bestätigen den Eingang Ihrer Nachricht vom {{date}}. Bearbeitungsnummer: {{info}}.\n\nBüro', 9),
  def('intern_freigabe', 'Freigabe erforderlich', 'Workflow', 'intern', 'high', 'Freigabe erforderlich', 'Hallo,\n\nfür {{topic}} ist Ihre Freigabe erforderlich. Bitte prüfen Sie die Unterlagen bis {{date}}.\n\nBüro', 10),
  def('intern_protokoll', 'Protokoll verteilt', 'Meeting', 'intern', 'normal', 'Protokoll {{date}}', 'Hallo,\n\ndas Protokoll vom {{date}} wurde verteilt. Rückfragen bitte bis {{endDate}}.\n\nBüro', 11),
  def('intern_kurzinfo', 'Kurzinfo Büro', 'Allgemein', 'intern', 'normal', 'Kurzinfo', 'Kurzinfo: {{info}}\n\nBei Rückfragen melden Sie sich im Büro.\n\n{{date}}', 12),
  def('intern_urlaubsplan', 'Freigabe Urlaubsplanung', 'Personal', 'intern', 'normal', 'Urlaubsplanung', 'Hallo,\n\nbitte geben Sie den Urlaubsplan für {{month}} bis {{date}} frei.\n\nPersonalbüro', 13),
  def('intern_budget', 'Budget-Hinweis', 'Finanzen', 'intern', 'high', 'Budget-Hinweis', 'Hallo,\n\nBudget-Hinweis für {{period}}: {{info}}. Bitte beachten Sie die Vorgaben bei Bestellungen.\n\nGeschäftsführung', 14),
  def('intern_vertrag', 'Vertragsverlängerung', 'Verträge', 'intern', 'normal', 'Vertragsverlängerung', 'Hallo,\n\ndie Vertragsverlängerung für {{topic}} steht zur Prüfung bereit. Rückmeldung bis {{date}}.\n\nVerwaltung', 15),
  def('intern_qm_audit', 'QM-Audit Termin', 'Qualität', 'intern', 'high', 'QM-Audit', 'Hallo,\n\nQM-Audit am {{date}} um {{time}} Uhr. Bitte stellen Sie Unterlagen bereit: {{info}}\n\nQM', 16),
  def('intern_ds_schulung', 'Datenschutz-Schulung', 'Datenschutz', 'intern', 'normal', 'Datenschutz-Schulung', 'Hallo,\n\nPflichtschulung Datenschutz am {{date}} um {{time}} Uhr. Teilnahme ist verpflichtend.\n\nDatenschutzbeauftragte:r', 17),
  def('intern_zeiterfassung', 'Zeiterfassung Deadline', 'Personal', 'intern', 'high', 'Zeiterfassung fällig', 'Hallo,\n\nbitte schließen Sie die Zeiterfassung für {{month}} bis {{date}} ab.\n\nPersonalbüro', 18),
  def('intern_beschaffung', 'Beschaffung genehmigt', 'Organisation', 'intern', 'normal', 'Beschaffung genehmigt', 'Hallo,\n\ndie Beschaffung „{{topic}}“ wurde genehmigt. Umsetzung ab {{date}}.\n\nVerwaltung', 19),
  def('intern_rechnungsfreigabe', 'Rechnungsfreigabe', 'Finanzen', 'intern', 'high', 'Rechnungsfreigabe', 'Hallo,\n\nRechnung {{invoiceNumber}} über {{amount}} EUR zur Freigabe. Fällig bis {{dueDate}}.\n\nAbrechnung', 20),
  def('intern_mandanten_info', 'Mandanten-Info', 'Organisation', 'intern', 'normal', 'Information', 'Hallo,\n\nInformation für alle Bereiche: {{info}}\n\n{{companyName}}', 21),
  def('intern_wartung', 'Systemwartung', 'IT', 'intern', 'high', 'Systemwartung', 'Hallo,\n\nSystemwartung am {{date}} von {{start}} bis {{end}} Uhr. Währenddessen kann es zu Einschränkungen kommen.\n\nIT', 22),
  def('intern_qualifikation', 'Qualifikationsnachweis', 'Personal', 'intern', 'normal', 'Qualifikationsnachweis', 'Hallo {{employeeName}},\n\nbitte reichen Sie Ihren Qualifikationsnachweis für {{topic}} bis {{date}} ein.\n\nPersonalbüro', 23),
  def('intern_korrespondenz', 'Korrespondenz Weiterleitung', 'Workflow', 'intern', 'normal', 'Weiterleitung Korrespondenz', 'Hallo,\n\nKorrespondenz zu {{topic}} wurde weitergeleitet an {{toPerson}}.\n\nBüro', 24),
  def('intern_aktenvernichtung', 'Aktenvernichtung', 'Datenschutz', 'intern', 'normal', 'Aktenvernichtung', 'Hallo,\n\nAktenvernichtung am {{date}}. Bitte kennzeichnen Sie zu vernichtende Akten bis {{endDate}}.\n\nDatenschutzbeauftragte:r', 25),
  def('intern_meeting', 'Meeting Protokoll', 'Meeting', 'intern', 'normal', 'Meeting {{date}}', 'Hallo,\n\nMeeting am {{date}} um {{time}} Uhr: {{topic}}. Protokoll folgt.\n\nBüro', 26),
  def('intern_vertretung', 'Vertretungsregelung', 'Organisation', 'intern', 'normal', 'Vertretungsregelung', 'Hallo,\n\nVertretungsregelung vom {{startDate}} bis {{endDate}}: {{info}}\n\nBüro', 27),
  def('intern_abrechnung', 'Abrechnungs-Deadline', 'Finanzen', 'intern', 'urgent', 'Abrechnungs-Deadline', 'Hallo,\n\nAbrechnungs-Deadline für {{month}}: {{date}}. Offene Posten bitte umgehend abschließen.\n\nAbrechnung', 28),
  def('intern_personalplanung', 'Personalplanung', 'Personal', 'intern', 'normal', 'Personalplanung', 'Hallo,\n\nPersonalplanung für {{month}}: {{info}}. Rückmeldung bis {{date}}.\n\nPersonalbüro', 29),
  def('intern_richtlinie', 'Allgemeine Richtlinie', 'Organisation', 'intern', 'high', 'Neue Richtlinie', 'Hallo,\n\nneue Richtlinie ab {{date}}: {{info}}. Bitte lesen und bestätigen.\n\nGeschäftsführung', 30),
];

export const COMMUNICATION_MESSAGE_TEMPLATES: CommunicationTemplateDefinition[] = [
  ...KLIENT_TEMPLATES,
  ...MITARBEITER_TEMPLATES,
  ...TEAM_TEMPLATES,
  ...INTERN_TEMPLATES,
];

export function getCommunicationTemplateCounts(): Record<ComposeTemplateAudience, number> {
  return {
    klient: KLIENT_TEMPLATES.length,
    mitarbeiter: MITARBEITER_TEMPLATES.length,
    team: TEAM_TEMPLATES.length,
    intern: INTERN_TEMPLATES.length,
  };
}

export function getCommunicationTemplatesForAudience(
  audience: ComposeTemplateAudience,
): CommunicationTemplateDefinition[] {
  switch (audience) {
    case 'klient':
      return KLIENT_TEMPLATES;
    case 'mitarbeiter':
      return MITARBEITER_TEMPLATES;
    case 'team':
      return TEAM_TEMPLATES;
    case 'intern':
      return INTERN_TEMPLATES;
    default:
      return [];
  }
}

function stableTemplateId(templateKey: string): string {
  let hash = 0;
  for (let i = 0; i < templateKey.length; i += 1) {
    hash = (hash * 31 + templateKey.charCodeAt(i)) >>> 0;
  }
  const hex = hash.toString(16).padStart(12, '0').slice(0, 12);
  return `a0000002-0001-4002-8002-${hex}`;
}

export function communicationTemplateToCareSuiteTemplate(
  template: CommunicationTemplateDefinition,
): CareSuiteTemplate {
  const variables = [...template.body_template.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return {
    id: stableTemplateId(template.template_key),
    tenantId: null,
    scope: 'system',
    moduleKey: 'communication',
    templateType: 'message',
    status: 'active',
    title: template.template_name,
    description: template.subject_template,
    categoryKey: template.recipient_type,
    content: template.body_template,
    variables,
    tags: [template.template_key, template.template_category, `priority:${template.priority_default}`],
    sortOrder: template.sort_order,
    isDefault: template.sort_order === 1,
    isRequired: false,
    createdBy: null,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  };
}

export function getCommunicationCareSuiteTemplates(): CareSuiteTemplate[] {
  return COMMUNICATION_MESSAGE_TEMPLATES.map(communicationTemplateToCareSuiteTemplate);
}

export function getCommunicationTemplateByCareSuiteId(
  templateId: string,
): CommunicationTemplateDefinition | undefined {
  return COMMUNICATION_MESSAGE_TEMPLATES.find(
    (template) => stableTemplateId(template.template_key) === templateId,
  );
}
