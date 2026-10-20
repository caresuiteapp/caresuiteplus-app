/**
 * Generates src/lib/communication/communicationTemplates.ts from structured data.
 * Run: node scripts/gen-communication-templates.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const outPath = path.join(root, 'src/lib/communication/communicationTemplates.ts');

const klient = [
  ['klient_termin_bestaetigung', 'Terminbestätigung', 'Termine', 'normal', 'Terminbestätigung am {{date}}', 'Guten Tag {{clientName}},\n\nhiermit bestätigen wir Ihren Termin am {{date}} um {{time}} Uhr. Bei Rückfragen erreichen Sie uns unter {{phone}}.\n\nFreundliche Grüße\nIhr Pflegeteam'],
  ['klient_termin_erinnerung', 'Erinnerung Termin', 'Termine', 'normal', 'Erinnerung: Termin am {{date}}', 'Liebe:r {{clientName}},\n\nwir möchten Sie freundlich an Ihren Termin am {{date}} um {{time}} Uhr erinnern. Bitte melden Sie sich, falls Sie verhindert sind.\n\nHerzliche Grüße'],
  ['klient_termin_absage', 'Terminabsage', 'Termine', 'high', 'Terminabsage am {{date}}', 'Guten Tag {{clientName}},\n\nleider müssen wir den Termin am {{date}} absagen. Wir melden uns zeitnah mit einem neuen Vorschlag.\n\nEntschuldigen Sie die Unannehmlichkeiten.'],
  ['klient_unterlagen_nachfrage', 'Nachfrage Unterlagen', 'Dokumente', 'normal', 'Unterlagen benötigt', 'Guten Tag {{clientName}},\n\nfür die weitere Bearbeitung benötigen wir noch folgende Unterlagen: {{info}}. Sie können diese im Portal hochladen oder uns per Post zukommen lassen.\n\nVielen Dank für Ihre Unterstützung.'],
  ['klient_entschuldigung_verzoegerung', 'Entschuldigung Verzögerung', 'Service', 'high', 'Entschuldigung — {{topic}}', 'Liebe:r {{clientName}},\n\nwir bitten um Entschuldigung für die Verzögerung bei {{topic}}. Wir arbeiten mit Hochdruck daran und melden uns bis {{date}} bei Ihnen.\n\nMit freundlichen Grüßen'],
  ['klient_willkommen', 'Willkommensnachricht', 'Onboarding', 'normal', 'Herzlich willkommen', 'Herzlich willkommen, {{clientName}}!\n\nwir freuen uns, Sie in unserer Einrichtung betreuen zu dürfen. Bei Fragen stehen wir Ihnen jederzeit unter {{phone}} zur Verfügung.\n\nIhr Betreuungsteam'],
  ['klient_buero_abwesenheit', 'Urlaubsabwesenheit', 'Organisation', 'normal', 'Hinweis Bürozeiten', 'Guten Tag {{clientName}},\n\nbitte beachten Sie, dass unser Büro vom {{startDate}} bis {{endDate}} geschlossen ist. In dringenden Fällen wenden Sie sich bitte an {{phone}}.\n\nFreundliche Grüße'],
  ['klient_rechnungshinweis', 'Rechnungshinweis', 'Abrechnung', 'normal', 'Rechnung {{month}}', 'Guten Tag {{clientName}},\n\nIhre Rechnung für {{month}} steht im Portal bereit. Bei Fragen zur Abrechnung erreichen Sie uns unter {{phone}}.\n\nMit freundlichen Grüßen\nBuchhaltung'],
  ['klient_dank_nachricht', 'Dank für Nachricht', 'Service', 'low', 'Ihre Nachricht ist eingegangen', 'Liebe:r {{clientName}},\n\nvielen Dank für Ihre Nachricht. Wir haben diese erhalten und bearbeiten Ihr Anliegen. Sie erhalten zeitnah eine Rückmeldung.\n\nHerzliche Grüße'],
  ['klient_dokument_bereit', 'Dokument bereit', 'Dokumente', 'normal', 'Neues Dokument im Portal', 'Guten Tag {{clientName}},\n\nein neues Dokument steht in Ihrem Portal zur Verfügung. Bitte prüfen Sie die Unterlagen und geben Sie uns bei Bedarf Rückmeldung.\n\nFreundliche Grüße'],
  ['klient_info_allgemein', 'Information Allgemein', 'Information', 'normal', 'Information von {{companyName}}', 'Guten Tag {{clientName}},\n\nwir möchten Sie über Folgendes informieren: {{info}}\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen'],
  ['klient_rueckrufbitte', 'Rückrufbitte', 'Kontakt', 'high', 'Bitte um Rückruf', 'Guten Tag {{clientName}},\n\nwir haben versucht, Sie telefonisch zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück — am besten zwischen {{time}} und 16:00 Uhr.\n\nVielen Dank!'],
  ['klient_pflegeplan_besprechung', 'Pflegeplan-Besprechung', 'Pflege', 'normal', 'Einladung Pflegeplan-Besprechung', 'Guten Tag {{clientName}},\n\nwir laden Sie zur Besprechung Ihres Pflegeplans am {{date}} um {{time}} Uhr ein. Thema: {{topic}}.\n\nBitte bestätigen Sie Ihre Teilnahme.\n\nIhr Pflegeteam'],
  ['klient_medikamentenhinweis', 'Medikamentenhinweis', 'Pflege', 'high', 'Medikamentenhinweis', 'Guten Tag {{clientName}},\n\nbitte beachten Sie folgende Medikamentenänderung: {{info}}. Bei Unklarheiten wenden Sie sich an Ihre Pflegekraft oder den Hausarzt.\n\nMit freundlichen Grüßen'],
  ['klient_hausarzt_termin', 'Hausarzt-Termin', 'Termine', 'normal', 'Hausarzt-Termin', 'Guten Tag {{clientName}},\n\nwir haben einen Hausarzt-Termin für Sie am {{date}} um {{time}} Uhr vereinbart. Ort: {{location}}.\n\nBitte bringen Sie Ihre Medikamentenliste mit.\n\nIhr Pflegeteam'],
  ['klient_klinik_aufnahme', 'Krankenhaus-Aufnahme', 'Klinik', 'high', 'Information Krankenhausaufenthalt', 'Guten Tag {{contactName}},\n\n{{clientName}} wurde am {{date}} in {{hospitalName}} aufgenommen. Wir halten Sie über den weiteren Verlauf informiert.\n\nBei Rückfragen: {{phone}}'],
  ['klient_klinik_entlassung', 'Entlassung aus Klinik', 'Klinik', 'high', 'Entlassung aus der Klinik', 'Guten Tag {{clientName}},\n\nwir freuen uns, Sie nach Ihrer Entlassung aus {{hospitalName}} am {{date}} wieder betreuen zu dürfen. Besondere Hinweise: {{info}}\n\nIhr Pflegeteam'],
  ['klient_angehoerige_info', 'Angehörigen-Information', 'Angehörige', 'normal', 'Information für Angehörige', 'Guten Tag {{contactName}},\n\nwir möchten Sie über {{clientName}} informieren: {{info}}\n\nBei Rückfragen erreichen Sie uns unter {{phone}}.\n\nMit freundlichen Grüßen'],
  ['klient_leistungsaenderung', 'Leistungsänderung', 'Leistungen', 'normal', 'Änderung der Leistungen', 'Guten Tag {{clientName}},\n\nab {{date}} ändern sich Ihre vereinbarten Leistungen: {{info}}. Bei Fragen vereinbaren Sie bitte einen Rücksprachetermin.\n\nFreundliche Grüße'],
  ['klient_besuchstermin', 'Besuchstermin', 'Besuche', 'normal', 'Besuchstermin', 'Guten Tag {{clientName}},\n\nfür {{date}} um {{time}} Uhr ist ein Besuch geplant. Bitte teilen Sie uns mit, ob der Termin passt.\n\nHerzliche Grüße'],
  ['klient_transport', 'Transport organisiert', 'Organisation', 'normal', 'Transport am {{date}}', 'Guten Tag {{clientName}},\n\nfür {{date}} um {{time}} Uhr ist ein Transport zu {{location}} organisiert. Bitte seien Sie rechtzeitig bereit.\n\nFreundliche Grüße'],
  ['klient_einverstaendnis', 'Einverständnis erforderlich', 'Dokumente', 'high', 'Einverständnis erforderlich', 'Guten Tag {{clientName}},\n\nfür {{topic}} benötigen wir Ihr Einverständnis. Bitte prüfen Sie das Dokument im Portal und geben Sie uns bis {{date}} Rückmeldung.\n\nVielen Dank!'],
  ['klient_beschwerde', 'Beschwerde eingegangen', 'Service', 'high', 'Ihre Rückmeldung', 'Guten Tag {{clientName}},\n\nwir haben Ihre Rückmeldung erhalten und nehmen diese ernst. Wir bearbeiten Ihr Anliegen und melden uns bis {{date}} bei Ihnen.\n\nMit freundlichen Grüßen\nQualitätsmanagement'],
  ['klient_pflegegrad', 'Pflegegrad-Information', 'Beratung', 'normal', 'Information Pflegegrad', 'Guten Tag {{clientName}},\n\nzur Information: {{info}}. Ihr aktueller Pflegegrad: {{careLevel}}. Bei Fragen unterstützen wir Sie gerne.\n\nFreundliche Grüße'],
  ['klient_notfall_info', 'Notfall-Information', 'Notfall', 'critical', 'Wichtige Notfallinformation', 'Guten Tag {{contactName}},\n\nwichtige Information zu {{clientName}}: {{info}}\n\nBitte nehmen Sie umgehend Kontakt mit uns auf: {{phone}}.\n\nPflegedienstleitung'],
  ['klient_portal_zugang', 'Portal-Zugang', 'Portal', 'normal', 'Ihr Portal-Zugang', 'Guten Tag {{clientName}},\n\nIhr Zugang zum Klientenportal ist eingerichtet. Bei Fragen zur Anmeldung erreichen Sie uns unter {{phone}} oder {{email}}.\n\nFreundliche Grüße\n{{companyName}}'],
];

const mitarbeiter = [
  ['ma_schichtplan', 'Schichtplan Info', 'Dienstplan', 'normal', 'Schichtplan {{month}}', 'Hallo {{employeeName}},\n\nder aktualisierte Schichtplan für {{month}} ist verfügbar. Bitte prüfen Sie Ihre Einsätze und melden Sie Konflikte bis {{date}}.\n\nVielen Dank!'],
  ['ma_einsatzaenderung', 'Einsatzänderung', 'Einsatz', 'high', 'Einsatzänderung am {{date}}', 'Hallo {{employeeName}},\n\nfür den {{date}} hat sich Ihr Einsatz geändert: {{info}}. Bitte bestätigen Sie den Erhalt dieser Nachricht.\n\nDienstplanung'],
  ['ma_doku_fehlt', 'Dokumentation fehlt', 'Dokumentation', 'high', 'Dokumentation fehlt', 'Hallo {{employeeName}},\n\nfür den Einsatz bei {{clientName}} am {{date}} fehlt noch die Dokumentation. Bitte ergänzen Sie diese bis {{endDate}}.\n\nVielen Dank!'],
  ['ma_willkommen', 'Willkommen im Team', 'Onboarding', 'normal', 'Willkommen im Team', 'Herzlich willkommen im Team, {{employeeName}}!\n\nwir freuen uns, Sie bei uns begrüßen zu dürfen. Bei Fragen wenden Sie sich an Ihre Teamleitung oder das Büro.\n\nIhr Pflegeteam'],
  ['ma_urlaub_freigabe', 'Urlaubsfreigabe', 'Personal', 'normal', 'Urlaub genehmigt', 'Hallo {{employeeName}},\n\nIhr Urlaubsantrag vom {{date}} bis {{endDate}} wurde genehmigt. Bitte hinterlegen Sie die Vertretung im Dienstplan.\n\nFreundliche Grüße\nPersonalbüro'],
  ['ma_schulung_einladung', 'Schulungseinladung', 'Fortbildung', 'normal', 'Pflichtschulung: {{topic}}', 'Hallo {{employeeName}},\n\nSie sind zur Pflichtschulung „{{topic}}“ am {{date}} um {{time}} Uhr eingeladen. Ort: {{info}}. Bitte bestätigen Sie Ihre Teilnahme.\n\nFortbildungsteam'],
  ['ma_fortbildung_erinnerung', 'Fortbildung Erinnerung', 'Fortbildung', 'normal', 'Erinnerung Fortbildung', 'Hallo {{employeeName}},\n\nErinnerung: Ihre Fortbildung „{{topic}}“ findet am {{date}} statt. Bitte bringen Sie Ihren Nachweis mit.\n\nAkademie'],
  ['ma_dienstuebergabe', 'Dienstübergabe', 'Schicht', 'normal', 'Dienstübergabe {{date}}', 'Hallo {{employeeName}},\n\nÜbergabe vom {{date}}: {{summary}}\n\nBitte beachten Sie die besonderen Hinweise im Dienstbuch.\n\nSchichtleitung'],
  ['ma_toureninfo', 'Fahrzeug-/Toureninfo', 'Disposition', 'normal', 'Tour am {{date}}', 'Hallo {{employeeName}},\n\nfür Ihre Tour am {{date}}: {{info}}. Bitte prüfen Sie Fahrzeug und Material vor Tourbeginn.\n\nDisposition'],
  ['ma_zeiterfassung', 'Zeiterfassung Hinweis', 'Personal', 'high', 'Zeiterfassung {{month}}', 'Hallo {{employeeName}},\n\nbitte ergänzen Sie Ihre Zeiterfassung für {{month}} bis {{date}}. Offene Einträge können die Abrechnung verzögern.\n\nBüro'],
  ['ma_gesundheitszeugnis', 'Gesundheitszeugnis', 'Personal', 'high', 'Gesundheitszeugnis fällig', 'Hallo {{employeeName}},\n\nbitte reichen Sie Ihr aktuelles Gesundheitszeugnis bis {{date}} im Personalbüro ein.\n\nVielen Dank!'],
  ['ma_rueckmeldung', 'Rückmeldung erbeten', 'Allgemein', 'normal', 'Rückmeldung erbeten', 'Hallo {{employeeName}},\n\nbitte geben Sie uns Rückmeldung zu: {{info}}. Antwort bitte bis {{date}}.\n\nDanke!'],
  ['ma_arbeitszeit_aenderung', 'Arbeitszeitänderung', 'Dienstplan', 'high', 'Arbeitszeitänderung', 'Hallo {{employeeName}},\n\nab {{date}} ändert sich Ihre Arbeitszeit: {{info}}. Bitte bestätigen Sie den Erhalt.\n\nPersonalbüro'],
  ['ma_krankmeldung', 'Krankmeldung bestätigt', 'Personal', 'normal', 'Krankmeldung erhalten', 'Hallo {{employeeName}},\n\nwir haben Ihre Krankmeldung für den {{date}} erhalten. Gute Besserung! Bei längerer Abwesenheit melden Sie sich bitte im Personalbüro.\n\nFreundliche Grüße'],
  ['ma_probezeit', 'Probezeit-Gespräch', 'Personal', 'normal', 'Einladung Probezeitgespräch', 'Hallo {{employeeName}},\n\nwir laden Sie zum Probezeitgespräch am {{date}} um {{time}} Uhr ein. Ort: {{location}}.\n\nPersonalbüro'],
  ['ma_leistungsbeurteilung', 'Leistungsbeurteilung', 'Personal', 'normal', 'Leistungsbeurteilung', 'Hallo {{employeeName}},\n\nIhre Leistungsbeurteilung für {{period}} steht zur Besprechung bereit. Termin: {{date}} um {{time}} Uhr.\n\nTeamleitung'],
  ['ma_arbeitskleidung', 'Arbeitskleidung', 'Organisation', 'normal', 'Arbeitskleidung', 'Hallo {{employeeName}},\n\nIhre Arbeitskleidung kann ab {{date}} im Personalbüro abgeholt werden. Bitte bringen Sie Ihren Ausweis mit.\n\nBüro'],
  ['ma_impfung', 'Impfung/Erstimpfung', 'Gesundheit', 'high', 'Impfstatus', 'Hallo {{employeeName}},\n\nbitte reichen Sie Ihren aktuellen Impfnachweis bis {{date}} ein oder vereinbaren Sie einen Termin.\n\nPersonalbüro'],
  ['ma_erste_hilfe', 'Erste-Hilfe-Kurs', 'Fortbildung', 'normal', 'Erste-Hilfe-Kurs', 'Hallo {{employeeName}},\n\nIhr Erste-Hilfe-Kurs findet am {{date}} um {{time}} Uhr statt. Ort: {{location}}. Teilnahme ist verpflichtend.\n\nAkademie'],
  ['ma_fuehrungszeugnis', 'Führungszeugnis', 'Personal', 'high', 'Führungszeugnis', 'Hallo {{employeeName}},\n\nbitte reichen Sie ein aktuelles erweitertes Führungszeugnis bis {{date}} ein.\n\nPersonalbüro'],
  ['ma_einsatz_abbruch', 'Einsatz Abbruch', 'Einsatz', 'critical', 'Einsatz abgebrochen', 'Hallo {{employeeName}},\n\nder Einsatz bei {{clientName}} am {{date}} wurde abgebrochen. Grund: {{info}}. Bitte melden Sie sich in der Disposition.\n\nDisposition'],
  ['ma_fahrzeug_hinweis', 'Fahrzeug Hinweis', 'Disposition', 'normal', 'Fahrzeug {{date}}', 'Hallo {{employeeName}},\n\nfür {{date}} ist Fahrzeug {{info}} zugewiesen. Bitte prüfen Sie Tankstand und Pflegeutensilien.\n\nDisposition'],
  ['ma_personalgespraech', 'Personalgespräch', 'Personal', 'normal', 'Personalgespräch', 'Hallo {{employeeName}},\n\nwir laden Sie zum Personalgespräch am {{date}} um {{time}} Uhr ein. Thema: {{topic}}.\n\nTeamleitung'],
  ['ma_arbeitsunfall', 'Arbeitsunfall Meldung', 'Gesundheit', 'critical', 'Arbeitsunfall — Rückmeldung', 'Hallo {{employeeName}},\n\nbitte dokumentieren Sie den Vorfall vom {{date}} vollständig und reichen Sie alle Unterlagen bis {{endDate}} ein.\n\nArbeitsschutz'],
  ['ma_quartals_feedback', 'Quartals-Feedback', 'Team', 'normal', 'Quartals-Feedback', 'Hallo {{employeeName}},\n\nbitte geben Sie bis {{date}} Ihr Feedback zum vergangenen Quartal ab: {{info}}\n\nTeamleitung'],
  ['ma_vertretung', 'Vertretung gesucht', 'Dienstplan', 'urgent', 'Vertretung am {{date}}', 'Hallo {{employeeName}},\n\nfür den {{date}} wird dringend eine Vertretung gesucht: {{info}}. Bitte melden Sie sich, falls Sie einspringen können.\n\nDienstplanung'],
];

const team = [
  ['team_meeting', 'Team-Meeting', 'Meeting', 'normal', 'Team-Meeting am {{date}}', 'Liebes Team,\n\nwir laden zum Team-Meeting am {{date}} um {{time}} Uhr ein. Tagesordnung: {{info}}\n\nBitte nehmen Sie teil.\n\nTeamleitung'],
  ['team_wichtige_info', 'Wichtige Info', 'Information', 'high', 'Wichtige Information', 'Liebes Team,\n\nwichtige Information: {{info}}\n\nBitte lesen und bei Fragen melden.\n\nSchichtleitung'],
  ['team_prozess', 'Prozessänderung', 'Prozesse', 'high', 'Prozessänderung ab {{date}}', 'Liebes Team,\n\nab {{date}} gilt eine geänderte Vorgehensweise: {{info}}. Die Details finden Sie im QM-Handbuch.\n\nBitte um Beachtung.'],
  ['team_qm_hinweis', 'QM-Hinweis', 'Qualität', 'normal', 'QM-Hinweis', 'Liebes Team,\n\nQM-Hinweis: {{info}}. Bitte dokumentieren Sie entsprechend und melden Sie Auffälligkeiten.\n\nQualitätsmanagement'],
  ['team_schicht_uebergabe', 'Übergabe Schicht', 'Schicht', 'normal', 'Schichtübergabe {{shift}}', 'Übergabe {{shift}} am {{date}}:\n\n{{summary}}\n\nBitte alle Punkte im Dienstbuch prüfen.\n\nSchichtleitung'],
  ['team_personalengpass', 'Personalengpass', 'Personal', 'urgent', 'Personalengpass am {{date}}', 'Liebes Team,\n\nam {{date}} besteht ein Personalengpass. Wer kurzfristig einspringen kann, melde sich bitte im Büro.\n\nVielen Dank!'],
  ['team_hygiene', 'Hygienehinweis', 'Qualität', 'high', 'Hygienehinweis', 'Liebes Team,\n\nbitte beachten Sie den aktualisierten Hygienehinweis: {{info}}. Einhaltung ist für alle Bereiche verbindlich.\n\nQM'],
  ['team_besuch', 'Besuch/Angehörige', 'Klient', 'normal', 'Besuch bei {{clientName}}', 'Liebes Team,\n\nam {{date}} ist ein Besuch bei {{clientName}} geplant. Bitte koordinieren Sie Zeiten und dokumentieren Sie den Verlauf.\n\nPflegedienst'],
  ['team_notfalluebung', 'Notfallübung', 'Sicherheit', 'high', 'Notfallübung am {{date}}', 'Liebes Team,\n\nam {{date}} um {{time}} Uhr findet eine Notfallübung statt. Bitte nehmen Sie teil und beachten Sie die Ablaufpläne.\n\nEinrichtungsleitung'],
  ['team_feedback', 'Feedback Runde', 'Team', 'normal', 'Feedback-Runde', 'Liebes Team,\n\nwir laden zur Feedback-Runde am {{date}} ein. Thema: {{topic}}. Ihre Rückmeldungen sind uns wichtig.\n\nTeamleitung'],
  ['team_einarbeitung', 'Einarbeitung neuer MA', 'Personal', 'normal', 'Einarbeitung', 'Liebes Team,\n\nab {{date}} beginnt die Einarbeitung von {{employeeName}}. Bitte unterstützen Sie {{toPerson}} in der ersten Woche.\n\nTeamleitung'],
  ['team_audit', 'Audit-Vorbereitung', 'Qualität', 'high', 'Audit-Vorbereitung', 'Liebes Team,\n\nam {{date}} findet ein Audit statt. Bitte bereiten Sie folgende Bereiche vor: {{info}}\n\nQM'],
  ['team_wundmanagement', 'Wundmanagement Schulung', 'Fortbildung', 'normal', 'Wundmanagement', 'Liebes Team,\n\nSchulung Wundmanagement am {{date}} um {{time}} Uhr. Teilnahme verpflichtend für alle Pflegekräfte.\n\nPDL'],
  ['team_sturzprotokoll', 'Sturzprotokoll Hinweis', 'Sicherheit', 'high', 'Sturz bei {{clientName}}', 'Liebes Team,\n\nes liegt ein Sturzereignis bei {{clientName}} vor. Bitte prüfen Sie Maßnahmen und dokumentieren Sie gemäß Protokoll.\n\nSchichtleitung'],
  ['team_dienstplan', 'Dienstplan Veröffentlichung', 'Dienstplan', 'normal', 'Neuer Dienstplan', 'Liebes Team,\n\nder Dienstplan für {{month}} ist veröffentlicht. Bitte prüfen Sie Ihre Einsätze bis {{date}}.\n\nDienstplanung'],
  ['team_inventur', 'Inventur', 'Organisation', 'normal', 'Inventur am {{date}}', 'Liebes Team,\n\nam {{date}} findet eine Inventur statt. Bitte stellen Sie Material und Dokumentation bereit.\n\nVerwaltung'],
  ['team_angehoerige', 'Koordination Angehörige', 'Klient', 'normal', 'Angehörigenkontakt', 'Liebes Team,\n\nfür {{clientName}} ist Abstimmung mit Angehörigen erforderlich: {{info}}\n\nBitte koordinieren Sie Termine.\n\nPflegedienst'],
  ['team_wetter', 'Wetter-/Unwetter Hinweis', 'Sicherheit', 'urgent', 'Wetterwarnung', 'Liebes Team,\n\nWetterwarnung für {{date}}: {{info}}. Bitte beachten Sie erhöhte Vorsicht bei Touren und Besuchen.\n\nEinrichtungsleitung'],
];

const intern = [
  ['intern_standard', 'Standardantwort Büro', 'Allgemein', 'low', 'Ihre Nachricht', 'Guten Tag,\n\nvielen Dank für Ihre Nachricht. Wir bearbeiten Ihr Anliegen und melden uns zeitnah.\n\nFreundliche Grüße\nBüro'],
  ['intern_weiterleitung', 'Weiterleitung', 'Workflow', 'normal', 'Weiterleitung', 'Hallo,\n\nIhre Anfrage wurde an {{employeeName}} weitergeleitet. Sie erhalten in Kürze eine Rückmeldung.\n\nBüro'],
  ['intern_rueckruf', 'Rückrufbitte', 'Kontakt', 'high', 'Rückruf erbeten', 'Guten Tag,\n\nwir haben versucht, Sie zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück.\n\nVielen Dank!\nBüro'],
  ['intern_unterlagen', 'Unterlagen angefordert', 'Dokumente', 'normal', 'Unterlagen angefordert', 'Guten Tag,\n\nbitte reichen Sie folgende Unterlagen ein: {{info}}. Eingang bis {{date}} erbeten.\n\nBüro'],
  ['intern_termin', 'Termin intern', 'Termine', 'normal', 'Interner Termin', 'Hallo Team,\n\ninterner Termin am {{date}} um {{time}} Uhr: {{topic}}. Bitte vormerken.\n\nBüro'],
  ['intern_it', 'IT-Hinweis', 'IT', 'normal', 'IT-Hinweis', 'Hallo,\n\nIT-Hinweis: {{info}}. Bei Problemen wenden Sie sich an den Support.\n\nIT'],
  ['intern_datenschutz', 'Datenschutz Info', 'Datenschutz', 'normal', 'Datenschutz', 'Hallo,\n\nzur Information: {{info}}. Bitte beachten Sie die Datenschutzrichtlinien im Intranet.\n\nDatenschutzbeauftragte:r'],
  ['intern_abwesenheit', 'Abwesenheit Kolleg:in', 'Personal', 'normal', 'Abwesenheit', 'Hallo,\n\n{{employeeName}} ist vom {{startDate}} bis {{endDate}} abwesend. Anliegen bitte an {{info}} richten.\n\nBüro'],
  ['intern_eingang', 'Bestätigung Eingang', 'Workflow', 'low', 'Eingang bestätigt', 'Guten Tag,\n\nwir bestätigen den Eingang Ihrer Nachricht vom {{date}}. Bearbeitungsnummer: {{info}}.\n\nBüro'],
  ['intern_freigabe', 'Freigabe erforderlich', 'Workflow', 'high', 'Freigabe erforderlich', 'Hallo,\n\nfür {{topic}} ist Ihre Freigabe erforderlich. Bitte prüfen Sie die Unterlagen bis {{date}}.\n\nBüro'],
  ['intern_protokoll', 'Protokoll verteilt', 'Meeting', 'normal', 'Protokoll {{date}}', 'Hallo,\n\ndas Protokoll vom {{date}} wurde verteilt. Rückfragen bitte bis {{endDate}}.\n\nBüro'],
  ['intern_kurzinfo', 'Kurzinfo Büro', 'Allgemein', 'normal', 'Kurzinfo', 'Kurzinfo: {{info}}\n\nBei Rückfragen melden Sie sich im Büro.\n\n{{date}}'],
  ['intern_urlaubsplan', 'Freigabe Urlaubsplanung', 'Personal', 'normal', 'Urlaubsplanung', 'Hallo,\n\nbitte geben Sie den Urlaubsplan für {{month}} bis {{date}} frei.\n\nPersonalbüro'],
  ['intern_budget', 'Budget-Hinweis', 'Finanzen', 'high', 'Budget-Hinweis', 'Hallo,\n\nBudget-Hinweis für {{period}}: {{info}}. Bitte beachten Sie die Vorgaben bei Bestellungen.\n\nGeschäftsführung'],
  ['intern_vertrag', 'Vertragsverlängerung', 'Verträge', 'normal', 'Vertragsverlängerung', 'Hallo,\n\ndie Vertragsverlängerung für {{topic}} steht zur Prüfung bereit. Rückmeldung bis {{date}}.\n\nVerwaltung'],
  ['intern_qm_audit', 'QM-Audit Termin', 'Qualität', 'high', 'QM-Audit', 'Hallo,\n\nQM-Audit am {{date}} um {{time}} Uhr. Bitte stellen Sie Unterlagen bereit: {{info}}\n\nQM'],
  ['intern_ds_schulung', 'Datenschutz-Schulung', 'Datenschutz', 'normal', 'Datenschutz-Schulung', 'Hallo,\n\nPflichtschulung Datenschutz am {{date}} um {{time}} Uhr. Teilnahme ist verpflichtend.\n\nDatenschutzbeauftragte:r'],
  ['intern_zeiterfassung', 'Zeiterfassung Deadline', 'Personal', 'high', 'Zeiterfassung fällig', 'Hallo,\n\nbitte schließen Sie die Zeiterfassung für {{month}} bis {{date}} ab.\n\nPersonalbüro'],
  ['intern_beschaffung', 'Beschaffung genehmigt', 'Organisation', 'normal', 'Beschaffung genehmigt', 'Hallo,\n\ndie Beschaffung „{{topic}}“ wurde genehmigt. Umsetzung ab {{date}}.\n\nVerwaltung'],
  ['intern_rechnungsfreigabe', 'Rechnungsfreigabe', 'Finanzen', 'high', 'Rechnungsfreigabe', 'Hallo,\n\nRechnung {{invoiceNumber}} über {{amount}} EUR zur Freigabe. Fällig bis {{dueDate}}.\n\nAbrechnung'],
  ['intern_mandanten_info', 'Mandanten-Info', 'Organisation', 'normal', 'Information', 'Hallo,\n\nInformation für alle Bereiche: {{info}}\n\n{{companyName}}'],
  ['intern_wartung', 'Systemwartung', 'IT', 'high', 'Systemwartung', 'Hallo,\n\nSystemwartung am {{date}} von {{start}} bis {{end}} Uhr. Währenddessen kann es zu Einschränkungen kommen.\n\nIT'],
  ['intern_qualifikation', 'Qualifikationsnachweis', 'Personal', 'normal', 'Qualifikationsnachweis', 'Hallo {{employeeName}},\n\nbitte reichen Sie Ihren Qualifikationsnachweis für {{topic}} bis {{date}} ein.\n\nPersonalbüro'],
  ['intern_korrespondenz', 'Korrespondenz Weiterleitung', 'Workflow', 'normal', 'Weiterleitung Korrespondenz', 'Hallo,\n\nKorrespondenz zu {{topic}} wurde weitergeleitet an {{toPerson}}.\n\nBüro'],
  ['intern_aktenvernichtung', 'Aktenvernichtung', 'Datenschutz', 'normal', 'Aktenvernichtung', 'Hallo,\n\nAktenvernichtung am {{date}}. Bitte kennzeichnen Sie zu vernichtende Akten bis {{endDate}}.\n\nDatenschutzbeauftragte:r'],
  ['intern_meeting', 'Meeting Protokoll', 'Meeting', 'normal', 'Meeting {{date}}', 'Hallo,\n\nMeeting am {{date}} um {{time}} Uhr: {{topic}}. Protokoll folgt.\n\nBüro'],
  ['intern_vertretung', 'Vertretungsregelung', 'Organisation', 'normal', 'Vertretungsregelung', 'Hallo,\n\nVertretungsregelung vom {{startDate}} bis {{endDate}}: {{info}}\n\nBüro'],
  ['intern_abrechnung', 'Abrechnungs-Deadline', 'Finanzen', 'urgent', 'Abrechnungs-Deadline', 'Hallo,\n\nAbrechnungs-Deadline für {{month}}: {{date}}. Offene Posten bitte umgehend abschließen.\n\nAbrechnung'],
  ['intern_personalplanung', 'Personalplanung', 'Personal', 'normal', 'Personalplanung', 'Hallo,\n\nPersonalplanung für {{month}}: {{info}}. Rückmeldung bis {{date}}.\n\nPersonalbüro'],
  ['intern_richtlinie', 'Allgemeine Richtlinie', 'Organisation', 'high', 'Neue Richtlinie', 'Hallo,\n\nneue Richtlinie ab {{date}}: {{info}}. Bitte lesen und bestätigen.\n\nGeschäftsführung'],
  ['intern_kritisch', 'Kritische Meldung intern', 'Notfall', 'critical', 'KRITISCH: {{topic}}', 'ACHTUNG — kritische Meldung:\n\n{{info}}\n\nSofortige Rückmeldung erforderlich.\n\n{{date}} {{time}}'],
];

function section(name, audience, rows) {
  return rows
    .map(
      ([key, title, category, priority, subject, body], index) =>
        `  def('${key}', '${title.replace(/'/g, "\\'")}', '${category}', '${audience}', '${priority}', '${subject.replace(/'/g, "\\'")}', ${JSON.stringify(body)}, ${index + 1}),`,
    )
    .join('\n');
}

const header = `import type { CommunicationPriority } from '@/features/communication/communication.types';
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
${section('KLIENT', 'klient', klient)}
];

const MITARBEITER_TEMPLATES: CommunicationTemplateDefinition[] = [
${section('MITARBEITER', 'mitarbeiter', mitarbeiter)}
];

const TEAM_TEMPLATES: CommunicationTemplateDefinition[] = [
${section('TEAM', 'team', team)}
];

const INTERN_TEMPLATES: CommunicationTemplateDefinition[] = [
${section('INTERN', 'intern', intern)}
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
  const hex = Buffer.from(templateKey).toString('hex').slice(0, 12).padEnd(12, '0');
  return \`a0000002-0001-4002-8002-\${hex.padEnd(12, '0').slice(0, 12)}\`;
}

export function communicationTemplateToCareSuiteTemplate(
  template: CommunicationTemplateDefinition,
): CareSuiteTemplate {
  const variables = [...template.body_template.matchAll(/\\{\\{(\\w+)\\}\\}/g)].map((m) => m[1]);
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
    tags: [template.template_key, template.template_category, \`priority:\${template.priority_default}\`],
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
`;

fs.writeFileSync(outPath, header);
console.log('Wrote', outPath);
console.log('Counts:', {
  klient: klient.length,
  mitarbeiter: mitarbeiter.length,
  team: team.length,
  intern: intern.length,
  total: klient.length + mitarbeiter.length + team.length + intern.length,
});
