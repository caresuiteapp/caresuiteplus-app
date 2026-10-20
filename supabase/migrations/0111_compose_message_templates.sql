-- ==========================================================================
-- CareSuite+ — Migration 0111: Expanded compose message templates by audience
-- Seeds klient / mitarbeiter / team / intern message templates (Paket F+)
-- ==========================================================================

UPDATE public.templates SET
  category_key = 'intern',
  content = 'Guten Tag,

vielen Dank für Ihre Nachricht. Wir bearbeiten Ihr Anliegen und melden uns zeitnah.

Freundliche Grüße
Büro',
  title = 'Standardantwort Büro',
  sort_order = 1
WHERE id = 'a0000001-0001-4001-8001-000000000001';

UPDATE public.templates SET
  category_key = 'klient',
  content = 'Guten Tag {{clientName}},

hiermit bestätigen wir Ihren Termin am {{date}} um {{time}} Uhr. Bei Rückfragen erreichen Sie uns unter {{phone}}.

Freundliche Grüße
Ihr Pflegeteam',
  sort_order = 1
WHERE id = 'a0000001-0001-4001-8001-000000000002';

UPDATE public.templates SET
  category_key = 'team',
  title = 'Team-Meeting',
  content = 'Liebes Team,

wir laden zum Team-Meeting am {{date}} um {{time}} Uhr ein. Tagesordnung: {{info}}

Bitte nehmen Sie teil.

Teamleitung',
  sort_order = 1
WHERE id = 'a0000001-0001-4001-8001-000000000003';

INSERT INTO public.templates (
  id, tenant_id, scope, module_key, template_type, status, title, content, is_default, sort_order, category_key
) VALUES
  ('a0000001-0001-4001-8002-000000000001', NULL, 'system', 'communication', 'message', 'active', 'Erinnerung Termin', 'Liebe:r {{clientName}},

wir möchten Sie freundlich an Ihren Termin am {{date}} um {{time}} Uhr erinnern. Bitte melden Sie sich, falls Sie verhindert sind.

Herzliche Grüße', FALSE, 2, 'klient'),
  ('a0000001-0001-4001-8002-000000000002', NULL, 'system', 'communication', 'message', 'active', 'Terminabsage', 'Guten Tag {{clientName}},

leider müssen wir den Termin am {{date}} absagen. Wir melden uns zeitnah mit einem neuen Vorschlag.

Entschuldigen Sie die Unannehmlichkeiten.', FALSE, 3, 'klient'),
  ('a0000001-0001-4001-8002-000000000003', NULL, 'system', 'communication', 'message', 'active', 'Nachfrage Unterlagen', 'Guten Tag {{clientName}},

für die weitere Bearbeitung benötigen wir noch folgende Unterlagen: {{info}}. Sie können diese im Portal hochladen oder uns per Post zukommen lassen.

Vielen Dank für Ihre Unterstützung.', FALSE, 4, 'klient'),
  ('a0000001-0001-4001-8002-000000000004', NULL, 'system', 'communication', 'message', 'active', 'Entschuldigung Verzögerung', 'Liebe:r {{clientName}},

wir bitten um Entschuldigung für die Verzögerung bei {{topic}}. Wir arbeiten mit Hochdruck daran und melden uns bis {{date}} bei Ihnen.

Mit freundlichen Grüßen', FALSE, 5, 'klient'),
  ('a0000001-0001-4001-8002-000000000005', NULL, 'system', 'communication', 'message', 'active', 'Willkommensnachricht', 'Herzlich willkommen, {{clientName}}!

wir freuen uns, Sie in unserer Einrichtung betreuen zu dürfen. Bei Fragen stehen wir Ihnen jederzeit unter {{phone}} zur Verfügung.

Ihr Betreuungsteam', FALSE, 6, 'klient'),
  ('a0000001-0001-4001-8002-000000000006', NULL, 'system', 'communication', 'message', 'active', 'Urlaubsabwesenheit', 'Guten Tag {{clientName}},

bitte beachten Sie, dass unser Büro vom {{startDate}} bis {{endDate}} geschlossen ist. In dringenden Fällen wenden Sie sich bitte an {{phone}}.

Freundliche Grüße', FALSE, 7, 'klient'),
  ('a0000001-0001-4001-8002-000000000007', NULL, 'system', 'communication', 'message', 'active', 'Rechnungshinweis', 'Guten Tag {{clientName}},

Ihre Rechnung für {{month}} steht im Portal bereit. Bei Fragen zur Abrechnung erreichen Sie uns unter {{phone}}.

Mit freundlichen Grüßen
Buchhaltung', FALSE, 8, 'klient'),
  ('a0000001-0001-4001-8002-000000000008', NULL, 'system', 'communication', 'message', 'active', 'Dank für Nachricht', 'Liebe:r {{clientName}},

vielen Dank für Ihre Nachricht. Wir haben diese erhalten und bearbeiten Ihr Anliegen. Sie erhalten zeitnah eine Rückmeldung.

Herzliche Grüße', FALSE, 9, 'klient'),
  ('a0000001-0001-4001-8002-000000000009', NULL, 'system', 'communication', 'message', 'active', 'Dokument bereit', 'Guten Tag {{clientName}},

ein neues Dokument steht in Ihrem Portal zur Verfügung. Bitte prüfen Sie die Unterlagen und geben Sie uns bei Bedarf Rückmeldung.

Freundliche Grüße', FALSE, 10, 'klient'),
  ('a0000001-0001-4001-8002-000000000010', NULL, 'system', 'communication', 'message', 'active', 'Information Allgemein', 'Guten Tag {{clientName}},

wir möchten Sie über Folgendes informieren: {{info}}

Bei Rückfragen stehen wir Ihnen gerne zur Verfügung.

Mit freundlichen Grüßen', FALSE, 11, 'klient'),
  ('a0000001-0001-4001-8002-000000000011', NULL, 'system', 'communication', 'message', 'active', 'Rückrufbitte Klient', 'Guten Tag {{clientName}},

wir haben versucht, Sie telefonisch zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück — am besten zwischen {{time}} und 16:00 Uhr.

Vielen Dank!', FALSE, 12, 'klient'),

  ('a0000001-0001-4001-8002-000000000101', NULL, 'system', 'communication', 'message', 'active', 'Schichtplan Info', 'Hallo {{employeeName}},

der aktualisierte Schichtplan für {{month}} ist verfügbar. Bitte prüfen Sie Ihre Einsätze und melden Sie Konflikte bis {{date}}.

Vielen Dank!', TRUE, 1, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000102', NULL, 'system', 'communication', 'message', 'active', 'Einsatzänderung', 'Hallo {{employeeName}},

für den {{date}} hat sich Ihr Einsatz geändert: {{info}}. Bitte bestätigen Sie den Erhalt dieser Nachricht.

Dienstplanung', FALSE, 2, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000103', NULL, 'system', 'communication', 'message', 'active', 'Dokumentation fehlt', 'Hallo {{employeeName}},

für den Einsatz bei {{clientName}} am {{date}} fehlt noch die Dokumentation. Bitte ergänzen Sie diese bis {{endDate}}.

Vielen Dank!', FALSE, 3, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000104', NULL, 'system', 'communication', 'message', 'active', 'Willkommen im Team', 'Herzlich willkommen im Team, {{employeeName}}!

wir freuen uns, Sie bei uns begrüßen zu dürfen. Bei Fragen wenden Sie sich an Ihre Teamleitung oder das Büro.

Ihr Pflegeteam', FALSE, 4, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000105', NULL, 'system', 'communication', 'message', 'active', 'Urlaubsfreigabe', 'Hallo {{employeeName}},

Ihr Urlaubsantrag vom {{date}} bis {{endDate}} wurde genehmigt. Bitte hinterlegen Sie die Vertretung im Dienstplan.

Freundliche Grüße
Personalbüro', FALSE, 5, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000106', NULL, 'system', 'communication', 'message', 'active', 'Schulungseinladung', 'Hallo {{employeeName}},

Sie sind zur Pflichtschulung „{{topic}}“ am {{date}} um {{time}} Uhr eingeladen. Ort: {{info}}. Bitte bestätigen Sie Ihre Teilnahme.

Fortbildungsteam', FALSE, 6, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000107', NULL, 'system', 'communication', 'message', 'active', 'Fortbildung Erinnerung', 'Hallo {{employeeName}},

Erinnerung: Ihre Fortbildung „{{topic}}“ findet am {{date}} statt. Bitte bringen Sie Ihren Nachweis mit.

Akademie', FALSE, 7, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000108', NULL, 'system', 'communication', 'message', 'active', 'Dienstübergabe', 'Hallo {{employeeName}},

Übergabe vom {{date}}: {{summary}}

Bitte beachten Sie die besonderen Hinweise im Dienstbuch.

Schichtleitung', FALSE, 8, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000109', NULL, 'system', 'communication', 'message', 'active', 'Fahrzeug-/Toureninfo', 'Hallo {{employeeName}},

für Ihre Tour am {{date}}: {{info}}. Bitte prüfen Sie Fahrzeug und Material vor Tourbeginn.

Disposition', FALSE, 9, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000110', NULL, 'system', 'communication', 'message', 'active', 'Zeiterfassung Hinweis', 'Hallo {{employeeName}},

bitte ergänzen Sie Ihre Zeiterfassung für {{month}} bis {{date}}. Offene Einträge können die Abrechnung verzögern.

Büro', FALSE, 10, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000111', NULL, 'system', 'communication', 'message', 'active', 'Gesundheitszeugnis', 'Hallo {{employeeName}},

bitte reichen Sie Ihr aktuelles Gesundheitszeugnis bis {{date}} im Personalbüro ein.

Vielen Dank!', FALSE, 11, 'mitarbeiter'),
  ('a0000001-0001-4001-8002-000000000112', NULL, 'system', 'communication', 'message', 'active', 'Rückmeldung erbeten', 'Hallo {{employeeName}},

bitte geben Sie uns Rückmeldung zu: {{info}}. Antwort bitte bis {{date}}.

Danke!', FALSE, 12, 'mitarbeiter'),

  ('a0000001-0001-4001-8002-000000000201', NULL, 'system', 'communication', 'message', 'active', 'Wichtige Info', 'Liebes Team,

wichtige Information: {{info}}

Bitte lesen und bei Fragen melden.

Schichtleitung', FALSE, 2, 'team'),
  ('a0000001-0001-4001-8002-000000000202', NULL, 'system', 'communication', 'message', 'active', 'Prozessänderung', 'Liebes Team,

ab {{date}} gilt eine geänderte Vorgehensweise: {{info}}. Die Details finden Sie im QM-Handbuch.

Bitte um Beachtung.', FALSE, 3, 'team'),
  ('a0000001-0001-4001-8002-000000000203', NULL, 'system', 'communication', 'message', 'active', 'QM-Hinweis', 'Liebes Team,

QM-Hinweis: {{info}}. Bitte dokumentieren Sie entsprechend und melden Sie Auffälligkeiten.

Qualitätsmanagement', FALSE, 4, 'team'),
  ('a0000001-0001-4001-8002-000000000204', NULL, 'system', 'communication', 'message', 'active', 'Übergabe Schicht', 'Übergabe {{shift}} am {{date}}:

{{summary}}

Bitte alle Punkte im Dienstbuch prüfen.

Schichtleitung', FALSE, 5, 'team'),
  ('a0000001-0001-4001-8002-000000000205', NULL, 'system', 'communication', 'message', 'active', 'Personalengpass', 'Liebes Team,

am {{date}} besteht ein Personalengpass. Wer kurzfristig einspringen kann, melde sich bitte im Büro.

Vielen Dank!', FALSE, 6, 'team'),
  ('a0000001-0001-4001-8002-000000000206', NULL, 'system', 'communication', 'message', 'active', 'Hygienehinweis', 'Liebes Team,

bitte beachten Sie den aktualisierten Hygienehinweis: {{info}}. Einhaltung ist für alle Bereiche verbindlich.

QM', FALSE, 7, 'team'),
  ('a0000001-0001-4001-8002-000000000207', NULL, 'system', 'communication', 'message', 'active', 'Besuch/Angehörige', 'Liebes Team,

am {{date}} ist ein Besuch bei {{clientName}} geplant. Bitte koordinieren Sie Zeiten und dokumentieren Sie den Verlauf.

Pflegedienst', FALSE, 8, 'team'),
  ('a0000001-0001-4001-8002-000000000208', NULL, 'system', 'communication', 'message', 'active', 'Notfallübung', 'Liebes Team,

am {{date}} um {{time}} Uhr findet eine Notfallübung statt. Bitte nehmen Sie teil und beachten Sie die Ablaufpläne.

Einrichtungsleitung', FALSE, 9, 'team'),
  ('a0000001-0001-4001-8002-000000000209', NULL, 'system', 'communication', 'message', 'active', 'Feedback Runde', 'Liebes Team,

wir laden zur Feedback-Runde am {{date}} ein. Thema: {{topic}}. Ihre Rückmeldungen sind uns wichtig.

Teamleitung', FALSE, 10, 'team'),

  ('a0000001-0001-4001-8002-000000000301', NULL, 'system', 'communication', 'message', 'active', 'Weiterleitung', 'Hallo,

Ihre Anfrage wurde an {{employeeName}} weitergeleitet. Sie erhalten in Kürze eine Rückmeldung.

Büro', FALSE, 2, 'intern'),
  ('a0000001-0001-4001-8002-000000000302', NULL, 'system', 'communication', 'message', 'active', 'Rückrufbitte', 'Guten Tag,

wir haben versucht, Sie zu erreichen. Bitte rufen Sie uns unter {{phone}} zurück.

Vielen Dank!
Büro', FALSE, 3, 'intern'),
  ('a0000001-0001-4001-8002-000000000303', NULL, 'system', 'communication', 'message', 'active', 'Unterlagen angefordert', 'Guten Tag,

bitte reichen Sie folgende Unterlagen ein: {{info}}. Eingang bis {{date}} erbeten.

Büro', FALSE, 4, 'intern'),
  ('a0000001-0001-4001-8002-000000000304', NULL, 'system', 'communication', 'message', 'active', 'Termin intern', 'Hallo Team,

interner Termin am {{date}} um {{time}} Uhr: {{topic}}. Bitte vormerken.

Büro', FALSE, 5, 'intern'),
  ('a0000001-0001-4001-8002-000000000305', NULL, 'system', 'communication', 'message', 'active', 'IT-Hinweis', 'Hallo,

IT-Hinweis: {{info}}. Bei Problemen wenden Sie sich an den Support.

IT', FALSE, 6, 'intern'),
  ('a0000001-0001-4001-8002-000000000306', NULL, 'system', 'communication', 'message', 'active', 'Datenschutz Info', 'Hallo,

zur Information: {{info}}. Bitte beachten Sie die Datenschutzrichtlinien im Intranet.

Datenschutzbeauftragte:r', FALSE, 7, 'intern'),
  ('a0000001-0001-4001-8002-000000000307', NULL, 'system', 'communication', 'message', 'active', 'Abwesenheit Kolleg:in', 'Hallo,

{{employeeName}} ist vom {{startDate}} bis {{endDate}} abwesend. Anliegen bitte an {{info}} richten.

Büro', FALSE, 8, 'intern'),
  ('a0000001-0001-4001-8002-000000000308', NULL, 'system', 'communication', 'message', 'active', 'Bestätigung Eingang', 'Guten Tag,

wir bestätigen den Eingang Ihrer Nachricht vom {{date}}. Bearbeitungsnummer: {{info}}.

Büro', FALSE, 9, 'intern'),
  ('a0000001-0001-4001-8002-000000000309', NULL, 'system', 'communication', 'message', 'active', 'Freigabe erforderlich', 'Hallo,

für {{topic}} ist Ihre Freigabe erforderlich. Bitte prüfen Sie die Unterlagen bis {{date}}.

Büro', FALSE, 10, 'intern'),
  ('a0000001-0001-4001-8002-000000000310', NULL, 'system', 'communication', 'message', 'active', 'Protokoll verteilt', 'Hallo,

das Protokoll vom {{date}} wurde verteilt. Rückfragen bitte bis {{endDate}}.

Büro', FALSE, 11, 'intern'),
  ('a0000001-0001-4001-8002-000000000311', NULL, 'system', 'communication', 'message', 'active', 'Kurzinfo Büro', 'Kurzinfo: {{info}}

Bei Rückfragen melden Sie sich im Büro.

{{date}}', FALSE, 12, 'intern')
ON CONFLICT (id) DO NOTHING;
