import { batchTpl } from '../helpers';

const KLIENT = batchTpl('tpl-comm-klient', 'communication', 'message', [
  {
    title: 'Terminbestätigung',
    content:
      'Guten Tag {{clientName}},\n\nhiermit bestätigen wir Ihren Termin am {{date}} um {{time}} Uhr. Bei Rückfragen erreichen Sie uns unter {{phone}}.\n\nFreundliche Grüße\nIhr Pflegeteam',
    categoryKey: 'klient',
    opts: { isDefault: true },
  },
  {
    title: 'Erinnerung Termin',
    content:
      'Liebe:r {{clientName}},\n\nwir möchten Sie freundlich an Ihren Termin am {{date}} um {{time}} Uhr erinnern. Bitte melden Sie sich, falls Sie verhindert sind.\n\nHerzliche Grüße',
    categoryKey: 'klient',
  },
  {
    title: 'Terminabsage',
    content:
      'Guten Tag {{clientName}},\n\nleider müssen wir den Termin am {{date}} absagen. Wir melden uns zeitnah mit einem neuen Vorschlag.\n\nEntschuldigen Sie die Unannehmlichkeiten.',
    categoryKey: 'klient',
  },
  {
    title: 'Nachfrage Unterlagen',
    content:
      'Guten Tag {{clientName}},\n\nfür die weitere Bearbeitung benötigen wir noch folgende Unterlagen: {{info}}. Sie können diese im Portal hochladen oder uns per Post zukommen lassen.\n\nVielen Dank für Ihre Unterstützung.',
    categoryKey: 'klient',
  },
  {
    title: 'Entschuldigung Verzögerung',
    content:
      'Liebe:r {{clientName}},\n\nwir bitten um Entschuldigung für die Verzögerung bei {{topic}}. Wir arbeiten mit Hochdruck daran und melden uns bis {{date}} bei Ihnen.\n\nMit freundlichen Grüßen',
    categoryKey: 'klient',
  },
  {
    title: 'Willkommensnachricht',
    content:
      'Herzlich willkommen, {{clientName}}!\n\nwir freuen uns, Sie in unserer Einrichtung betreuen zu dürfen. Bei Fragen stehen wir Ihnen jederzeit unter {{phone}} zur Verfügung.\n\nIhr Betreuungsteam',
    categoryKey: 'klient',
  },
  {
    title: 'Urlaubsabwesenheit',
    content:
      'Guten Tag {{clientName}},\n\nbitte beachten Sie, dass unser Büro vom {{startDate}} bis {{endDate}} geschlossen ist. In dringenden Fällen wenden Sie sich bitte an {{phone}}.\n\nFreundliche Grüße',
    categoryKey: 'klient',
  },
  {
    title: 'Rechnungshinweis',
    content:
      'Guten Tag {{clientName}},\n\nIhre Rechnung für {{month}} steht im Portal bereit. Bei Fragen zur Abrechnung erreichen Sie uns unter {{phone}}.\n\nMit freundlichen Grüßen\nBuchhaltung',
    categoryKey: 'klient',
  },
  {
    title: 'Dank für Nachricht',
    content:
      'Liebe:r {{clientName}},\n\nvielen Dank für Ihre Nachricht. Wir haben diese erhalten und bearbeiten Ihr Anliegen. Sie erhalten zeitnah eine Rückmeldung.\n\nHerzliche Grüße',
    categoryKey: 'klient',
  },
  {
    title: 'Dokument bereit',
    content:
      'Guten Tag {{clientName}},\n\nein neues Dokument steht in Ihrem Portal zur Verfügung. Bitte prüfen Sie die Unterlagen und geben Sie uns bei Bedarf Rückmeldung.\n\nFreundliche Grüße',
    categoryKey: 'klient',
  },
  {
    title: 'Information Allgemein',
    content:
      'Guten Tag {{clientName}},\n\nwir möchten Sie über Folgendes informieren: {{info}}\n\nBei Rückfragen stehen wir Ihnen gerne zur Verfügung.\n\nMit freundlichen Grüßen',
    categoryKey: 'klient',
  },
  {
    title: 'Rückrufbitte',
    content:
      'Guten Tag {{clientName}},\n\nwir haben versucht, Sie telefonisch zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück — am besten zwischen {{time}} und 16:00 Uhr.\n\nVielen Dank!',
    categoryKey: 'klient',
  },
]);

const MITARBEITER = batchTpl('tpl-comm-mitarbeiter', 'communication', 'message', [
  {
    title: 'Schichtplan Info',
    content:
      'Hallo {{employeeName}},\n\nder aktualisierte Schichtplan für {{month}} ist verfügbar. Bitte prüfen Sie Ihre Einsätze und melden Sie Konflikte bis {{date}}.\n\nVielen Dank!',
    categoryKey: 'mitarbeiter',
    opts: { isDefault: true },
  },
  {
    title: 'Einsatzänderung',
    content:
      'Hallo {{employeeName}},\n\nfür den {{date}} hat sich Ihr Einsatz geändert: {{info}}. Bitte bestätigen Sie den Erhalt dieser Nachricht.\n\nDienstplanung',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Dokumentation fehlt',
    content:
      'Hallo {{employeeName}},\n\nfür den Einsatz bei {{clientName}} am {{date}} fehlt noch die Dokumentation. Bitte ergänzen Sie diese bis {{endDate}}.\n\nVielen Dank!',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Willkommen im Team',
    content:
      'Herzlich willkommen im Team, {{employeeName}}!\n\nwir freuen uns, Sie bei uns begrüßen zu dürfen. Bei Fragen wenden Sie sich an Ihre Teamleitung oder das Büro.\n\nIhr Pflegeteam',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Urlaubsfreigabe',
    content:
      'Hallo {{employeeName}},\n\nIhr Urlaubsantrag vom {{date}} bis {{endDate}} wurde genehmigt. Bitte hinterlegen Sie die Vertretung im Dienstplan.\n\nFreundliche Grüße\nPersonalbüro',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Schulungseinladung',
    content:
      'Hallo {{employeeName}},\n\nSie sind zur Pflichtschulung „{{topic}}“ am {{date}} um {{time}} Uhr eingeladen. Ort: {{info}}. Bitte bestätigen Sie Ihre Teilnahme.\n\nFortbildungsteam',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Fortbildung Erinnerung',
    content:
      'Hallo {{employeeName}},\n\nerinnerung: Ihre Fortbildung „{{topic}}“ findet am {{date}} statt. Bitte bringen Sie Ihren Nachweis mit.\n\nAkademie',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Dienstübergabe',
    content:
      'Hallo {{employeeName}},\n\nÜbergabe vom {{date}}: {{summary}}\n\nBitte beachten Sie die besonderen Hinweise im Dienstbuch.\n\nSchichtleitung',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Fahrzeug-/Toureninfo',
    content:
      'Hallo {{employeeName}},\n\nfür Ihre Tour am {{date}}: {{info}}. Bitte prüfen Sie Fahrzeug und Material vor Tourbeginn.\n\nDisposition',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Zeiterfassung Hinweis',
    content:
      'Hallo {{employeeName}},\n\nbitte ergänzen Sie Ihre Zeiterfassung für {{month}} bis {{date}}. Offene Einträge können die Abrechnung verzögern.\n\nBüro',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Gesundheitszeugnis',
    content:
      'Hallo {{employeeName}},\n\nbitte reichen Sie Ihr aktuelles Gesundheitszeugnis bis {{date}} im Personalbüro ein.\n\nVielen Dank!',
    categoryKey: 'mitarbeiter',
  },
  {
    title: 'Rückmeldung erbeten',
    content:
      'Hallo {{employeeName}},\n\nbitte geben Sie uns Rückmeldung zu: {{info}}. Antwort bitte bis {{date}}.\n\nDanke!',
    categoryKey: 'mitarbeiter',
  },
]);

const TEAM = batchTpl('tpl-comm-team', 'communication', 'message', [
  {
    title: 'Team-Meeting',
    content:
      'Liebes Team,\n\nwir laden zum Team-Meeting am {{date}} um {{time}} Uhr ein. Tagesordnung: {{info}}\n\nBitte nehmen Sie teil.\n\nTeamleitung',
    categoryKey: 'team',
    opts: { isDefault: true },
  },
  {
    title: 'Wichtige Info',
    content:
      'Liebes Team,\n\nwichtige Information: {{info}}\n\nBitte lesen und bei Fragen melden.\n\nSchichtleitung',
    categoryKey: 'team',
  },
  {
    title: 'Prozessänderung',
    content:
      'Liebes Team,\n\nab {{date}} gilt eine geänderte Vorgehensweise: {{info}}. Die Details finden Sie im QM-Handbuch.\n\nBitte um Beachtung.',
    categoryKey: 'team',
  },
  {
    title: 'QM-Hinweis',
    content:
      'Liebes Team,\n\nQM-Hinweis: {{info}}. Bitte dokumentieren Sie entsprechend und melden Sie Auffälligkeiten.\n\nQualitätsmanagement',
    categoryKey: 'team',
  },
  {
    title: 'Übergabe Schicht',
    content:
      'Übergabe {{shift}} am {{date}}:\n\n{{summary}}\n\nBitte alle Punkte im Dienstbuch prüfen.\n\nSchichtleitung',
    categoryKey: 'team',
  },
  {
    title: 'Personalengpass',
    content:
      'Liebes Team,\n\nam {{date}} besteht ein Personalengpass. Wer kurzfristig einspringen kann, melde sich bitte im Büro.\n\nVielen Dank!',
    categoryKey: 'team',
  },
  {
    title: 'Hygienehinweis',
    content:
      'Liebes Team,\n\nbitte beachten Sie den aktualisierten Hygienehinweis: {{info}}. Einhaltung ist für alle Bereiche verbindlich.\n\nQM',
    categoryKey: 'team',
  },
  {
    title: 'Besuch/Angehörige',
    content:
      'Liebes Team,\n\nam {{date}} ist ein Besuch bei {{clientName}} geplant. Bitte koordinieren Sie Zeiten und dokumentieren Sie den Verlauf.\n\nPflegedienst',
    categoryKey: 'team',
  },
  {
    title: 'Notfallübung',
    content:
      'Liebes Team,\n\nam {{date}} um {{time}} Uhr findet eine Notfallübung statt. Bitte nehmen Sie teil und beachten Sie die Ablaufpläne.\n\nEinrichtungsleitung',
    categoryKey: 'team',
  },
  {
    title: 'Feedback Runde',
    content:
      'Liebes Team,\n\nwir laden zur Feedback-Runde am {{date}} ein. Thema: {{topic}}. Ihre Rückmeldungen sind uns wichtig.\n\nTeamleitung',
    categoryKey: 'team',
  },
]);

const INTERN = batchTpl('tpl-comm-intern', 'communication', 'message', [
  {
    title: 'Standardantwort Büro',
    content:
      'Guten Tag,\n\nvielen Dank für Ihre Nachricht. Wir bearbeiten Ihr Anliegen und melden uns zeitnah.\n\nFreundliche Grüße\nBüro',
    categoryKey: 'intern',
    opts: { isDefault: true },
  },
  {
    title: 'Weiterleitung',
    content:
      'Hallo,\n\nIhre Anfrage wurde an {{employeeName}} weitergeleitet. Sie erhalten in Kürze eine Rückmeldung.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Rückrufbitte',
    content:
      'Guten Tag,\n\nwir haben versucht, Sie zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück.\n\nVielen Dank!\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Unterlagen angefordert',
    content:
      'Guten Tag,\n\nbitte reichen Sie folgende Unterlagen ein: {{info}}. Eingang bis {{date}} erbeten.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Termin intern',
    content:
      'Hallo Team,\n\ninterner Termin am {{date}} um {{time}} Uhr: {{topic}}. Bitte vormerken.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'IT-Hinweis',
    content:
      'Hallo,\n\nIT-Hinweis: {{info}}. Bei Problemen wenden Sie sich an den Support.\n\nIT',
    categoryKey: 'intern',
  },
  {
    title: 'Datenschutz Info',
    content:
      'Hallo,\n\nzur Information: {{info}}. Bitte beachten Sie die Datenschutzrichtlinien im Intranet.\n\nDatenschutzbeauftragte:r',
    categoryKey: 'intern',
  },
  {
    title: 'Abwesenheit Kolleg:in',
    content:
      'Hallo,\n\n{{employeeName}} ist vom {{startDate}} bis {{endDate}} abwesend. Anliegen bitte an {{info}} richten.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Bestätigung Eingang',
    content:
      'Guten Tag,\n\nwir bestätigen den Eingang Ihrer Nachricht vom {{date}}. Bearbeitungsnummer: {{info}}.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Freigabe erforderlich',
    content:
      'Hallo,\n\nfür {{topic}} ist Ihre Freigabe erforderlich. Bitte prüfen Sie die Unterlagen bis {{date}}.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Protokoll verteilt',
    content:
      'Hallo,\n\ndas Protokoll vom {{date}} wurde verteilt. Rückfragen bitte bis {{endDate}}.\n\nBüro',
    categoryKey: 'intern',
  },
  {
    title: 'Kurzinfo Büro',
    content:
      'Kurzinfo: {{info}}\n\nBei Rückfragen melden Sie sich im Büro.\n\n{{date}}',
    categoryKey: 'intern',
  },
]);

export const COMMUNICATION_TEMPLATES = [...KLIENT, ...MITARBEITER, ...TEAM, ...INTERN];
