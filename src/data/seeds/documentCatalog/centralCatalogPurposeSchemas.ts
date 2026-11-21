import type { CentralDocumentLayout } from '@/types/documents/centralCatalog';

export const CENTRAL_CATALOG_PURPOSE_SCHEMAS: Readonly<Record<string, { layout: CentralDocumentLayout; fieldLabels: string[]; columns: string[] }>> = {
  csdc_aufnahme_002: {
    layout: "checklist",
    fieldLabels: ["Aufnahmedatum und zuständiges Team", "Geplanter Versorgungsbeginn", "Offene Entscheidungen und nächste Prüfung"],
    columns: ["Prüfschritt", "Status", "Zuständig", "Frist", "Nachweis"],
  },
  csdc_aufnahme_004: {
    layout: "table",
    fieldLabels: ["Zweck und Gültigkeit der Kontaktübersicht", "Letzte Überprüfung durch zuständige Person"],
    columns: ["Name", "Rolle / Beziehung", "Dienstlich benötigter Kontakt", "Erreichbarkeit", "Erlaubter Anlass", "Vertretungsnachweis / Verweis"],
  },
  csdc_aufnahme_006: {
    layout: "table",
    fieldLabels: ["Datenstand der Übersicht", "Freigabe für den benötigten Kommunikationsweg"],
    columns: ["Funktion / Fachgebiet", "Name / Einrichtung", "Kontakt", "Erreichbarkeit", "Zuständigkeit", "Bestätigt am"],
  },
  csdc_aufnahme_010: {
    layout: "table",
    fieldLabels: ["Zeitraum der Übersicht", "Stand und Herkunft der Bewilligungsdaten"],
    columns: ["Bewilligte Leistung", "Kostenträger", "Aktenzeichen", "Gültigkeit", "Bewilligter Umfang", "Abweichung / Hinweis"],
  },
  csdc_aufnahme_015: {
    layout: "checklist",
    fieldLabels: ["Aufnahmevorgang und Dokumentenstand", "Offene Prüfung und zuständige Person"],
    columns: ["Dokument", "Status", "Eingang / Fassung", "Zuständig", "Frist", "Ablage / Verweis"],
  },
  csdc_pflegeplanung_003: {
    layout: "form",
    fieldLabels: ["Informationsquelle und Perspektive der Person", "Alltagsprägende Erfahrungen und Gewohnheiten", "Personen, Sprache und kulturelle Bezüge mit Versorgungsrelevanz", "Wünsche und persönliche Grenzen", "Bedeutung für die aktuelle Unterstützung"],
    columns: [],
  },
  csdc_pflegeplanung_006: {
    layout: "table",
    fieldLabels: ["Ausgangssituation und Informationsquellen", "Verantwortliche Fachperson und Zeitpunkt"],
    columns: ["Risikobereich", "Konkrete Beobachtung", "Fachliche Einschätzung", "Weitere Erhebung erforderlich", "Vereinbarter nächster Schritt"],
  },
  csdc_pflegeplanung_008: {
    layout: "table",
    fieldLabels: ["Gewünschter Tagesrhythmus", "Geltender Zeitraum und Ausnahmen"],
    columns: ["Tagesabschnitt", "Übliche Aktivität", "Vereinbarte Unterstützung", "Zuständig", "Abweichender Ablauf"],
  },
  csdc_pflegeplanung_009: {
    layout: "table",
    fieldLabels: ["Ausgangslage und Prioritäten der Person", "Abstimmung und Beteiligte"],
    columns: ["Bedarf", "Vereinbartes Pflegeziel", "Erkennbares Bewertungskriterium", "Prüfzeitpunkt oder Anlass", "Zuständig"],
  },
  csdc_pflegeplanung_011: {
    layout: "form",
    fieldLabels: ["Auslöser und Datum der Evaluation", "Maßnahme und bisheriger Stand", "Beobachtete Entwicklung und Bewertung", "Perspektive der versorgten Person", "Entscheidung und angepasster Planstand", "Verantwortlich und nächste Prüfung"],
    columns: [],
  },
  csdc_pflegeplanung_013: {
    layout: "form",
    fieldLabels: ["Datum, Uhrzeit und angebotene Leistung", "Tatsächlicher Status der Leistung", "Aussage der Person in eigenen Worten, soweit mitgeteilt", "Gespräch und angebotene Alternativen", "Entscheidung der Person und weitere Abstimmung", "Benachrichtigung und dokumentierende Person"],
    columns: [],
  },
  csdc_pflegeplanung_015: {
    layout: "table",
    fieldLabels: ["Datum, Anlass und Teilnehmende", "Ausgangssituation und offene Fragestellung"],
    columns: ["Besprechungspunkt", "Einschätzung", "Vereinbarung oder Entscheidung", "Verantwortlich", "Rückmeldetermin"],
  },
  csdc_pflegeplanung_016: {
    layout: "table",
    fieldLabels: ["Datum, Anlass und Beteiligte", "Rückmeldung und Wünsche der versorgten Person", "Planstand und Prüfumfang"],
    columns: ["Prüfbereich", "Beobachtung", "Abweichung zum Plan", "Abgesprochene Anpassung", "Verantwortlich", "Nachprüfung"],
  },
  csdc_risiken_004: {
    layout: "form",
    fieldLabels: ["Datum, Uhrzeit und Körperstelle", "Beobachteter Hautzustand", "Beschwerden aus Sicht der Person", "Vergleich mit Vorbefund", "Dokumentierte Rücksprache und Folgebeobachtung"],
    columns: [],
  },
  csdc_risiken_006: {
    layout: "table",
    fieldLabels: ["Referenz der fachlichen Festlegung", "Bedürfnisse, Verträglichkeit und verabredete Hilfsmittel", "Evaluationsanlass und Verantwortliche"],
    columns: ["Zeit oder Anlass laut Planung", "Individuell festgelegte Bewegung oder Position", "Unterstützung und Hilfsmittel", "Zuständig", "Beachtung im Einzelfall"],
  },
  csdc_risiken_007: {
    layout: "form",
    fieldLabels: ["Anlass, Datenquellen und Zeitraum", "Gewichtsverlauf mit Messbezug", "Ess- und Trinkgewohnheiten und Präferenzen", "Beobachtete Schwierigkeiten bei Aufnahme und Unterstützung", "Verträglichkeit und vorliegende fachliche Vorgaben", "Fachliche Einschätzung und weiterer Abklärungsbedarf"],
    columns: [],
  },
  csdc_risiken_010: {
    layout: "table",
    fieldLabels: ["Erfassungszeitraum und Teilkontext", "Vorliegende individuelle Vorgaben und Quellen"],
    columns: ["Datum und Uhrzeit", "Mahlzeit oder Lebensmittel", "Angebotene Menge und Einheit", "Verzehrte Menge und Einheit", "Unterstützung", "Beobachtung", "Erfasst von"],
  },
  csdc_risiken_011: {
    layout: "form",
    fieldLabels: ["Beobachtungssituation, Zeitpunkt und Informationsquelle", "Aufgenommene Nahrung oder Flüssigkeit und Konsistenz", "Beobachtete Anzeichen sowie geschilderte Beschwerden", "Vorliegende fachliche Vorgaben", "Tatsächliche Reaktion und Rücksprache", "Vereinbarte Folgebeobachtung"],
    columns: [],
  },
  csdc_risiken_012: {
    layout: "table",
    fieldLabels: ["Zeitraum, Ausgangslage und Selbstauskunft oder Fremdbeobachtung", "Verwendetes geeignetes Instrument"],
    columns: ["Datum und Uhrzeit", "Schmerzort und Situation", "Instrument und beobachteter Wert", "Dokumentierte Handlung", "Wirkung und Zeitpunkt", "Erfasst von"],
  },
  csdc_risiken_014: {
    layout: "table",
    fieldLabels: ["Beobachtungszeitraum und Erfassungsanlass", "Individuell vereinbarte Beobachtungskriterien"],
    columns: ["Datum und Uhrzeit", "Art der Ausscheidung", "Menge und Einheit oder Schätzung", "Beschaffenheit", "Besonderheiten und Rückmeldung", "Erfasst von"],
  },
  csdc_risiken_016: {
    layout: "table",
    fieldLabels: ["Erfassungszeitraum und Informationsquelle", "Gewohnter Rhythmus und Wünsche"],
    columns: ["Datum", "Zeitangaben und Beobachtung", "Unterbrechungen", "Selbsteinschätzung", "Relevante Einflussfaktoren", "Erfasst von"],
  },
  csdc_risiken_019: {
    layout: "form",
    fieldLabels: ["Datum, Teilnehmende und Beratungssituation", "Festgestelltes Risiko und Beobachtungsgrundlage", "Besprochene Inhalte und geäußerte Fragen", "Verständigung und Entscheidung", "Vereinbarte nächste Schritte und beratende Person"],
    columns: [],
  },
  csdc_risiken_020: {
    layout: "form",
    fieldLabels: ["Bezug zur Maßnahme und Anlass der Prüfung", "Erwartetes Ergebnis und damaliger Ausgangspunkt", "Beobachtetes Ergebnis und Quelle", "Bewertung mit der Person", "Entscheidung, angepasster Planstand und nächste Prüfung"],
    columns: [],
  },
  csdc_behandlungspflege_005: {
    layout: "form",
    fieldLabels: ["Datum, Uhrzeit und Gesprächskanal", "Anordnende und empfangende Person", "Wortlaut der übermittelten Anordnung", "Dokumentiertes Rücklesen und Bestätigung", "Status und Verweis auf die schriftliche Bestätigung", "Offene Rückfragen und zuständige Stelle"],
    columns: [],
  },
  csdc_behandlungspflege_006: {
    layout: "table",
    fieldLabels: ["Geltende Verordnung, Planstand und Zeitraum", "Zuständigkeit und offene Klärungen"],
    columns: ["Maßnahme", "Verordnungsreferenz", "Geplante Durchführung laut Vorgabe", "Geltungszeitraum", "Zuständig", "Besondere Vorgaben gemäß Quelle"],
  },
  csdc_behandlungspflege_007: {
    layout: "table",
    fieldLabels: ["Nachweiszeitraum und Verordnungsbezug", "Zuordnung zur Originaldokumentation und etwaigen Berichtigungen"],
    columns: ["Tatsächliches Datum und Uhrzeit", "Maßnahme mit Referenz", "Status der Durchführung", "Abweichung und Grund", "Rückmeldung und Zeitpunkt", "Ausführende Person"],
  },
  csdc_behandlungspflege_010: {
    layout: "table",
    fieldLabels: ["Gültige Anordnung und Planstand", "Zeitraum und Zuordnung zum Gabenachweis"],
    columns: ["Zeitpunkt", "Arzneimittel, Stärke und Form", "Tatsächlich verabreichte Menge und Einheit", "Applikationsweg und dokumentierte Stelle", "Gabe oder Ausfall und Grund", "Rückmeldung", "Ausgeführt von"],
  },
  csdc_behandlungspflege_011: {
    layout: "table",
    fieldLabels: ["Anordnungsbezug und Zeitraum", "Individuelle Vorgaben und dokumentierte Besonderheiten"],
    columns: ["Datum und Uhrzeit", "Versorgungsart und Seite", "Tatsächlich durchgeführt oder ausgefallen", "Haut- und Verträglichkeitsbeobachtung", "Abweichung oder Rückmeldung", "Ausgeführt von"],
  },
  csdc_behandlungspflege_012: {
    layout: "table",
    fieldLabels: ["Katheterart und Verordnungsbezug", "Gültige individuelle Vereinbarungen zur Versorgung"],
    columns: ["Datum und Uhrzeit", "Versorgung oder Wechsel", "Materialangaben soweit erforderlich", "Durchführung und Beobachtungen", "Abweichung oder Rücksprache", "Ausgeführt von"],
  },
  csdc_behandlungspflege_013: {
    layout: "form",
    fieldLabels: ["Stomaidentifikation und Anlass", "Datum, Uhrzeit und dokumentierte Durchführung", "Beobachteter Zustand des Stomas und der Umgebungshaut", "Tatsächlich verwendetes Versorgungssystem", "Auffälligkeit und Rückmeldung", "Ausgeführt von"],
    columns: [],
  },
  csdc_behandlungspflege_014: {
    layout: "form",
    fieldLabels: ["Sonde oder System und Verordnungsbezug", "Datum und Uhrzeit", "Beobachtung der Eintrittsstelle", "Dokumentierte Durchführung und verwendetes Material", "Abweichung, Verträglichkeit und Rückmeldung", "Ausgeführt von"],
    columns: [],
  },
  csdc_behandlungspflege_016: {
    layout: "form",
    fieldLabels: ["Zugang oder System und gültige Anordnung", "Art und Zeitpunkt der tatsächlich dokumentierten Versorgung", "Dokumentierter Start, Abschluss oder Übergabe", "Beobachteter Zustand des Zugangs und Verträglichkeit", "Abweichung und Rücksprache", "Ausgeführt von"],
    columns: [],
  },
  csdc_behandlungspflege_017: {
    layout: "table",
    fieldLabels: ["Referenzen und Zeitraum", "Individuelle Vorgaben und Gerätedaten soweit erforderlich"],
    columns: ["Datum und Uhrzeit", "Art der Versorgung", "Tatsächliche Anwendung laut Dokumentation", "Status oder Abweichung", "Beobachtung und Rücksprache", "Ausgeführt von"],
  },
  csdc_behandlungspflege_018: {
    layout: "table",
    fieldLabels: ["Bezug zur Versorgung oder Vorgang", "Zeitraum"],
    columns: ["Datum und Uhrzeit", "Kanal", "Gesprächspartner", "Anlass und gemeldete Beobachtung", "Rückmeldung und Vereinbarung", "Zuständig und Termin"],
  },
  csdc_behandlungspflege_019: {
    layout: "form",
    fieldLabels: ["Ereigniszeit, Beobachtungszeit und Bezug zur Maßnahme", "Beobachteter Ablauf und Abweichung", "Tatsächlich ergriffene Handlung", "Informierte Stelle, Zeitpunkt und Rückmeldung", "Beobachtetes Ergebnis und Nachverfolgung", "Dokumentiert von und Berichtigungsbezug"],
    columns: [],
  },
  csdc_medikamente_003: {
    layout: "form",
    fieldLabels: ["Quelle, Datum und Referenz der Änderungsanordnung", "Bisheriger Stand laut Quelle", "Geänderter Stand und Geltungsbeginn laut Quelle", "Offene Abweichungen und Rückfragen", "Aktualisierter Plan und informierte Beteiligte", "Dokumentiert und geprüft von"],
    columns: [],
  },
  csdc_medikamente_008: {
    layout: "table",
    fieldLabels: ["Referenz auf die gültige Bedarfsanordnung", "Zeitraum und Zuordnung zum Gabenachweis"],
    columns: ["Datum und Zeitpunkt", "Beobachteter Anlass", "Tatsächliche Gabe oder Ausfall", "Beobachtete Wirkung mit Zeitpunkt", "Abweichung und Rücksprache", "Dokumentiert von"],
  },
  csdc_medikamente_009: {
    layout: "form",
    fieldLabels: ["Datum und Zeitpunkt der vorgesehenen Gabe", "Arzneimittel und gültige Anordnungsreferenz", "Tatsächlicher Status und bekannt gewordener Grund", "Aussage der Person soweit mitgeteilt", "Tatsächliche Rücksprache, Rückmeldung und Zeitpunkt", "Dokumentiert von und Folgebezug"],
    columns: [],
  },
  csdc_medikamente_010: {
    layout: "form",
    fieldLabels: ["Datum, Uhrzeit und Bezug zum gültigen Plan", "Vereinbarter Umfang der Unterstützung", "Eigenhandlung der Person und tatsächlich geleistete Hilfe", "Beobachtung oder nicht geleistete Unterstützung", "Rückmeldung und Dokumentation"],
    columns: [],
  },
  csdc_medikamente_011: {
    layout: "table",
    fieldLabels: ["Zeitraum, Lieferstelle und Bezug zum Bestellvorgang", "Verantwortliche Stelle"],
    columns: ["Artikel und Packungsgröße", "Bestelldatum und Bestellmenge", "Lieferdatum und erhaltene Menge", "Abgleich und Differenz", "Bearbeitung und Person"],
  },
  csdc_medikamente_012: {
    layout: "table",
    fieldLabels: ["Anlass, Datum und Übergabestelle", "Vorliegende Pläne mit Stand und Herkunft", "Zuständige Person für offene Klärungen"],
    columns: ["Arzneimittel und dokumentierter Bestand", "Plan- oder Originalbezug", "Festgestellte Differenz", "Status der Klärung", "Übergabe oder Übernahme dokumentiert von"],
  },
  csdc_medikamente_013: {
    layout: "table",
    fieldLabels: ["Prüfdatum, Aufbewahrungsort und Verantwortliche", "Bezugszeitraum und dokumentierte Folgemaßnahmen"],
    columns: ["Artikel und Packungskennung", "Tatsächlicher Bestand und Einheit", "Verfallsangabe", "Auffälligkeit", "Abgesprochene Rückmeldung", "Prüfvermerk"],
  },
  csdc_medikamente_016: {
    layout: "form",
    fieldLabels: ["Ereignis- und Feststellungszeit", "Betroffenes Arzneimittel und Anordnungsbezug", "Beobachteter Ablauf und Fehlerart", "Tatsächlich eingeleitete Schritte und informierte Stellen", "Beobachtetes Ergebnis und offene Nachverfolgung", "Verantwortlich und Berichtigungsbezug"],
    columns: [],
  },
  csdc_medikamente_017: {
    layout: "table",
    fieldLabels: ["Anlass und zuständige Stelle", "Maßgebliches betriebliches Verfahren oder gesonderter Nachweis"],
    columns: ["Datum und Uhrzeit", "Arzneimittel oder Packung", "Menge und Einheit", "Rückgabe oder Entsorgung", "Empfangende Stelle oder Beleg", "Verantwortlich"],
  },
  csdc_wunden_003: {
    layout: "table",
    fieldLabels: ["Wundkennung, Körperstelle und Referenz zum Ausgangsassessment", "Messmethode und Dokumentationszeitraum"],
    columns: ["Datum und Uhrzeit", "Dokumentierte Maße und Methode", "Veränderung zu Vorbefund", "Beschwerden oder Beobachtung", "Durchgeführte Versorgung und Rücksprache", "Erfasst von"],
  },
  csdc_wunden_004: {
    layout: "form",
    fieldLabels: ["Wundkennung und Körperstelle", "Aufnahmedatum, Uhrzeit und aufnehmende Person", "Interner Bildverweis und Zuordnung zum Assessment", "Aufnahmebedingungen und Vergleichbarkeit", "Dokumentierter Zulässigkeits- und Ablagevermerk"],
    columns: [],
  },
  csdc_wunden_006: {
    layout: "table",
    fieldLabels: ["Wundkennung und gültiger Anordnungsbezug", "Zeitraum und Art des Nachweises"],
    columns: ["Datum und Uhrzeit", "Verbandwechsel oder Ausfall", "Tatsächlich verwendetes Material", "Beobachtung beim Wechsel", "Abweichung und Rückmeldung", "Ausgeführt von"],
  },
  csdc_wunden_007: {
    layout: "table",
    fieldLabels: ["Wundkennung oder Bestandsbereich", "Planstand und Zuständigkeit"],
    columns: ["Material und Produktbezeichnung", "Größe oder Ausführung", "Menge und Einheit", "Einsatzbezug", "Bestands- oder Ersatzhinweis"],
  },
  csdc_wunden_009: {
    layout: "form",
    fieldLabels: ["Wundkennung und Feststellungszeit", "Tatsächlich beobachtete Veränderung", "Betroffenenbericht und Vorbefund", "Kontaktierte Stelle und Zeitpunkt", "Rückmeldung, dokumentierte Handlung und Folgebeobachtung"],
    columns: [],
  },
  csdc_wunden_010: {
    layout: "form",
    fieldLabels: ["Wundkennung und Kommunikationsanlass", "Zeitpunkt, Kanal und Kontaktperson", "Übermittelte Beobachtungen und Unterlagen", "Erhaltene Rückmeldung und Originalreferenz", "Vereinbarter nächster Schritt und Verantwortliche"],
    columns: [],
  },
  csdc_wunden_011: {
    layout: "table",
    fieldLabels: ["Wundkennung, Ausgangslage und Anordnungsreferenz", "Beteiligte Stellen und gemeinsam dokumentiertes Versorgungsziel"],
    columns: ["Individuell festgelegte Maßnahme", "Quellenbezug", "Anlass oder Zeitpunkt laut Plan", "Zuständig", "Überprüfung und offener Punkt"],
  },
  csdc_betreuung_004: {
    layout: "table",
    fieldLabels: ["Planungszeitraum und Bezug zur bisherigen Fassung", "Wünsche der betreuten Person"],
    columns: ["Teilhabeziel", "Vereinbartes Angebot", "Zeitfenster", "Zuständig", "Überprüfung"],
  },
  csdc_betreuung_009: {
    layout: "table",
    fieldLabels: ["Nachweiszeitraum", "Bezug zur Einzel- oder Gruppenplanung"],
    columns: ["Datum", "Angebot", "Beginn", "Ende", "Teilnahme / Abwesenheit", "Dokumentiert durch"],
  },
  csdc_alltag_006: {
    layout: "table",
    fieldLabels: ["Leistungszeitraum", "Vereinbarter Aufgabenrahmen", "Abweichungen und tatsächliche Bestätigung"],
    columns: ["Datum", "Beginn", "Ende", "Leistung", "Menge / Einheit", "Mitarbeitende", "Bestätigung"],
  },
  csdc_alltag_010: {
    layout: "table",
    fieldLabels: ["Abrechnungszeitraum", "Verantwortliche Person und vereinbarter Rahmen", "Anfangsbestand und Abgleichdatum"],
    columns: ["Datum", "Vorgang / Beleg", "Einnahme (€)", "Ausgabe (€)", "Bestand (€)", "Erfasst / geprüft durch"],
  },
  csdc_alltag_015: {
    layout: "form",
    fieldLabels: ["Stand und Quelle der Information", "Entlastungsbetrag nach § 45b SGB XI", "Einschlägige Leistungsart und Anerkennung des Anbieters", "Abgrenzung zum Umwandlungsanspruch nach § 45a Abs. 4 SGB XI", "Belege und Einreichung bei der Pflegekasse", "Zuständige Kontaktstelle und offene Klärung"],
    columns: [],
  },
  csdc_alltag_017: {
    layout: "form",
    fieldLabels: ["Erstattungszeitraum", "Leistungsart nach § 45b SGB XI", "Belegnummern und zugehörige Beträge", "Einreichung und zuständige Pflegekasse", "Rückmeldung, offene Klärung und Nachweisverweis"],
    columns: [],
  },
  csdc_alltag_018: {
    layout: "form",
    fieldLabels: ["Anspruchsmonat", "Leistungsgrundlage nach § 45a Abs. 4 SGB XI", "Anerkanntes Angebot und tatsächlich vorliegende Belege", "Bereits verwendete Beträge und Datenquelle", "Kostenträger und individueller Klärungsstand"],
    columns: [],
  },
  csdc_antraege_003: {
    layout: "form",
    fieldLabels: ["Regelmäßig pflegende Person", "Zeitraum der Verhinderung", "Verhinderung am jeweiligen Tag von und bis", "Grund der Verhinderung im erforderlichen Umfang", "Quelle der Angaben und Datum"],
    columns: [],
  },
  csdc_antraege_005: {
    layout: "table",
    fieldLabels: ["Regelmäßig pflegende Person", "Ersatzpflegeperson oder Einrichtung", "Bezug zum Antrag", "Nachweis der Aufwendungen"],
    columns: ["Datum", "Verhinderung von und bis", "Ersatzpflege von und bis", "Stunden- oder tagebezogene Angabe", "Ersatzpflegeleistung", "Aufwendungen", "Beleg", "Bestätigung"],
  },
  csdc_antraege_006: {
    layout: "checklist",
    fieldLabels: ["Kostenträger und Vorgangsbezug", "Leistungsart und Leistungszeitraum", "Einreichung am und über welchen Weg", "Ansprechpartner für Rückfragen"],
    columns: ["Belegart", "Aussteller", "Belegnummer", "Leistungszeitraum", "Betrag", "Vorhanden", "Eingereicht"],
  },
  csdc_antraege_007: {
    layout: "table",
    fieldLabels: ["Kalenderjahr oder Abrechnungszeitraum", "Auskunft des Kostenträgers mit Stichtag", "Noch offene Einreichungen"],
    columns: ["Budgetart", "Abrechnungszeitraum", "Verfügbare Ausgangssumme", "Bestätigte Erstattungen", "Weitere offene Ansprüche", "Bestätigter Restbetrag"],
  },
  csdc_antraege_010: {
    layout: "form",
    fieldLabels: ["Anlass und Ziel der Beratung", "Beteiligte und ihre Sicht auf die Versorgung", "Relevante Unterstützungsbedarfe und Ressourcen", "Besprochene Entlastungsmöglichkeiten", "Vereinbarte Unterstützung und zuständige Stelle", "Mitteilung an Dritte und dokumentierte Grundlage", "Wiedervorlage"],
    columns: [],
  },
  csdc_einsatz_004: {
    layout: "checklist",
    fieldLabels: ["Einsatzkennung und Datum", "Zugeordnete Person und Aufgabenfreigabe"],
    columns: ["Aufgabe", "Vorgesehener Zeitpunkt", "Zuständig", "Tatsächlicher Status", "Abweichung"],
  },
  csdc_einsatz_005: {
    layout: "table",
    fieldLabels: ["Einsatzbezug und Nachweiszeitraum", "Zeitquelle und dokumentierte Berichtigung"],
    columns: ["Datum", "Beginn", "Ende", "Pause / Unterbrechung", "Mitarbeitende", "Quelle / Bestätigung"],
  },
  csdc_notfall_003: {
    layout: "table",
    fieldLabels: ["Ereignisbezogene Aktenreferenz", "Ereignisort", "Dokumentierende Person", "Abschluss und tatsächliche Übergabe"],
    columns: ["Uhrzeit", "Beobachtung", "Tatsächlich erfolgte Handlung", "Handelnde Person", "Benachrichtigung / Übergabe"],
  },
  csdc_palliativ_002: {
    layout: "table",
    fieldLabels: ["Abgestimmte Ziele und geltende Originalunterlagen", "Team, Ansprechpartner und Erreichbarkeit", "Stand und Prüfverantwortung"],
    columns: ["Versorgungsbereich", "Vereinbarte Maßnahme oder Unterstützung", "Quellenbezug", "Zuständig", "Kontaktweg", "Abgestimmter Prüf- oder Änderungsanlass"],
  },
  csdc_palliativ_004: {
    layout: "table",
    fieldLabels: ["Beobachtungszeitraum und Ausgangslage", "Genutztes Instrument sowie Eigen- oder Fremdbeobachtung"],
    columns: ["Datum und Uhrzeit", "Symptom und Situation", "Beobachtete Ausprägung", "Tatsächliche Maßnahme", "Wirkung oder Verlauf mit Zeitpunkt", "Dokumentiert von"],
  },
  csdc_palliativ_007: {
    layout: "table",
    fieldLabels: ["Stand, verantwortliche Stelle und Geltungsbereich", "Abstimmung mit beteiligten Stellen"],
    columns: ["Dienst oder Kontaktperson", "Aufgabe", "Telefon oder Kontaktweg", "Erreichbarkeit", "Vereinbarter alternativer Kontakt"],
  },
  csdc_palliativ_011: {
    layout: "table",
    fieldLabels: ["Berichtszeitraum und zugehörige Versorgung", "Verweis auf abgestimmten Plan und Beteiligte"],
    columns: ["Datum und Uhrzeit", "Tatsächlich beobachteter Verlauf", "Dokumentierte Handlung", "Kontakt und Rückmeldung", "Eintragende Person"],
  },
  csdc_palliativ_012: {
    layout: "form",
    fieldLabels: ["Zeitpunkt und beobachteter Anlass", "Verweis auf vorhandene ärztliche Feststellung soweit vorliegend", "Dokumentierte Versorgung und persönliche Wünsche", "Benachrichtigte Stellen und Zeiten", "Übergaben und offene Aufgaben", "Eintragende Person"],
    columns: [],
  },
  csdc_palliativ_013: {
    layout: "table",
    fieldLabels: ["Anlass und zugehöriger Vorgang", "Vereinbarte Kontaktreihenfolge und Zuständigkeit"],
    columns: ["Datum und Uhrzeit", "Kontaktperson und Kanal", "Kontaktversuch oder erreicht", "Mitgeteilter Sachverhalt und Rückmeldung", "Nächster vereinbarter Schritt", "Dokumentiert von"],
  },
  csdc_palliativ_014: {
    layout: "table",
    fieldLabels: ["Rückgabeanlass und Übergabesituation", "Übergebende und zur Entgegennahme berechtigte Person"],
    columns: ["Gegenstand oder Schlüsselkennung", "Anzahl", "Dokumentierter Zustand", "Zeitpunkt der Übergabe", "Empfangsbestätigung oder offener Verbleib"],
  },
  csdc_palliativ_015: {
    layout: "form",
    fieldLabels: ["Abschlussanlass und Abschlussdatum", "Abschließende Kontakte und vereinbarte Übergaben", "Aktenvollständigkeit und Ablageverweise", "Offene Aufgaben und Zuständigkeiten", "Verantwortlicher Abschlussvermerk"],
    columns: [],
  },
  csdc_personal_009: {
    layout: "table",
    fieldLabels: ["Einarbeitungsbereich und Zeitraum", "Anleitende oder bewertende Person", "Rahmen und Umfang der Einsatzentscheidung"],
    columns: ["Lernziel", "Beobachtete Tätigkeit", "Datum", "Bewertung", "Grenzen der Freigabe", "Nachprüfung"],
  },
  csdc_personal_016: {
    layout: "table",
    fieldLabels: ["Planungszeitraum", "Organisation oder Planungsbereich", "Geprüfte Planungsfassung"],
    columns: ["Datum", "Person", "Schichtart", "Geplanter Beginn", "Geplantes Ende", "Pause", "Einsatzort"],
  },
  csdc_personal_017: {
    layout: "table",
    fieldLabels: ["Erfassungszeitraum", "Geltungsbereich der Arbeitszeiterfassung", "Nachweis eines nachträglichen Korrekturvorgangs"],
    columns: ["Datum", "Tatsächlicher Beginn", "Tatsächliches Ende", "Pause", "Dauer", "Korrekturgrund", "Bestätigung"],
  },
  csdc_qm_004: {
    layout: "form",
    fieldLabels: ["Unser Auftrag und unsere Zielgruppen", "Selbstbestimmung und Umgang miteinander", "Zusammenarbeit und Verantwortlichkeiten", "Umgang mit Beschwerden", "Verbindliche Grundsätze im Versorgungsalltag"],
    columns: [],
  },
  csdc_qm_010: {
    layout: "table",
    fieldLabels: ["Geltungsbereich der Dokumentenlenkung", "Verantwortliche Stelle", "Regeln zur Verteilung und Ablage"],
    columns: ["Dokument-ID", "Bezeichnung", "Version", "Freigabe", "Gültig ab", "Ablösebezug", "Verantwortlich"],
  },
  csdc_qm_014: {
    layout: "table",
    fieldLabels: ["Datum, Ort und Anlass", "Leitung und Teilnehmende", "Tagesordnung und nächste Besprechung"],
    columns: ["Punkt", "Feststellung", "Beschluss", "Nächster Schritt", "Verantwortlich", "Termin"],
  },
  csdc_zulassung_002: {
    layout: "checklist",
    fieldLabels: ["Land und zuständige Anerkennungsbehörde", "Angebotsform und Träger", "Amtliches Verfahren oder Vorgangsnummer", "Verantwortliche Person und Bearbeitungsstand"],
    columns: ["Unterlage oder Prüfschritt", "Fassung und Datum", "Nachweisstelle", "Status", "Offene Angaben"],
  },
  csdc_zulassung_004: {
    layout: "form",
    fieldLabels: ["Art und Zielgruppe des Angebots", "Ziele, Inhalt und Grenzen", "Leistungsorte und Einzugsgebiet", "Ablauf, Erreichbarkeit und Preise", "Eingesetzte Kräfte und Qualifikation", "Fachliche Begleitung und Vertretung", "Qualitätssicherung und Beschwerden"],
    columns: [],
  },
  csdc_zulassung_005: {
    layout: "table",
    fieldLabels: ["Angebot und Anerkennungsbezug", "Zuständige Fachkraft für die Prüfung"],
    columns: ["Eingesetzte Person oder Personalreferenz", "Rolle", "Qualifikation oder Schulung", "Nachweis und Datum", "Geltungsstand", "Prüfung und offene Punkte"],
  },
  csdc_zulassung_008: {
    layout: "form",
    fieldLabels: ["Anerkanntes Angebot und zuständige Behörde", "Berichtsjahr", "Anzahl der Nutzenden", "Übersicht der eingesetzten Kräfte", "Nachweis aktueller Kenntnisse", "Angaben zur fachlichen Begleitung", "Weiterbestehen der Anerkennungsvoraussetzungen", "Einreichungsnachweis im zuständigen elektronischen Verfahren"],
    columns: [],
  },
  csdc_abrechnung_002: {
    layout: "table",
    fieldLabels: ["Abrechnungszeitraum", "Leistungs- und Vertragsgrundlage", "Verantwortliche Prüfung und Stichtag"],
    columns: ["Leistungsdatum", "Leistung und Kennung", "Einheit", "Menge", "Leistungsbeleg", "Abrechenbarkeit", "Prüfhinweis"],
  },
  csdc_abrechnung_003: {
    layout: "table",
    fieldLabels: ["Leistungsmonat", "Vertrags- und Leistungsgrundlage", "Abrechnungsempfänger", "Summe der Leistungen", "Kostenträgeranteil", "Eigenanteil"],
    columns: ["Leistungsdatum", "Position", "Einheit", "Menge", "Satz", "Betrag", "Nachweis"],
  },
  csdc_abrechnung_007: {
    layout: "form",
    fieldLabels: ["Belegnummer und Fassung", "Abrechnungszeitraum", "Verantwortliche Prüferrolle", "Prüfzeitpunkt und Entscheidung", "Ausschlüsse, Rückgabegrund oder Auflagen", "Nachweis der Freigabe"],
    columns: [],
  },
  csdc_abrechnung_008: {
    layout: "table",
    fieldLabels: ["Datenstand", "Quelle bewilligter oder verfügbarer Beträge", "Berechnungsgrundlage und offene Prüfungen"],
    columns: ["Leistungsart", "Zeitraum", "Bestätigter Betrag", "Verbraucht", "Vorgemerkt", "Verfügbar", "Quelle"],
  },
  csdc_abrechnung_012: {
    layout: "table",
    fieldLabels: ["Stichtag", "Organisation oder Abrechnungsbereich", "Quelle der offenen Posten"],
    columns: ["Debitor", "Belegnummer", "Fälligkeit", "Forderung", "Zahlung", "Offener Saldo", "Klärungsstatus"],
  },
  csdc_abrechnung_013: {
    layout: "form",
    fieldLabels: ["Zahler oder Zahlungsreferenz", "Zahlungstag und Betrag", "Rechnung oder Beleg", "Zuordnungsbetrag und Währung", "Restbetrag", "Klärung und Dokumentationsbezug"],
    columns: [],
  },
  csdc_datenschutz_001: {
    layout: "table",
    fieldLabels: ["Verantwortliche Stelle und Kontaktdaten", "Datenschutzkontakt", "Rolle und Geltungsbereich des Verzeichnisses"],
    columns: ["Verarbeitung und Zweck", "Kategorien betroffener Personen", "Kategorien von Daten", "Empfänger", "Drittlandbezug", "Löschfrist", "TOM-Verweis"],
  },
  csdc_datenschutz_014: {
    layout: "table",
    fieldLabels: ["Zweck und Freigabe der Auswertung", "Protokollquelle und Zeitraum", "Vorgangsbezug"],
    columns: ["Zeitpunkt", "Art des Ereignisses", "Benutzer oder Dienst", "Objektbezug", "Aktion", "Ergebnis", "Nachweisreferenz"],
  },
  csdc_arbeitsschutz_003: {
    layout: "form",
    fieldLabels: ["Unterweisungsdatum", "Arbeitsplatz und Unterweisungsanlass", "Unterweisende Person", "Inhalte und Unterlagenstand", "Teilnehmende", "Art der Bestätigung und Lernerfolg"],
    columns: [],
  },
  csdc_arbeitsschutz_004: {
    layout: "table",
    fieldLabels: ["Geltungsbereich und Stichtag", "Verantwortliche Stelle und Nachweisablage"],
    columns: ["Stoffbezeichnung", "Einstufung oder gefährliche Eigenschaften", "Mengenbereich", "Arbeitsbereich", "Sicherheitsdatenblatt und Fassung"],
  },
  csdc_arbeitsschutz_012: {
    layout: "table",
    fieldLabels: ["Betreiber und Betriebsstätte", "Stand des Bestandsverzeichnisses", "Zuständige Stelle und Zugriff auf Prüfnachweise"],
    columns: ["Bezeichnung, Art und Typ", "Loscode oder Seriennummer", "Anschaffungsjahr", "Hersteller, Bevollmächtigter oder Importeur mit Anschrift", "Betriebliche Identifikationsnummer, soweit vorhanden", "Standort und betriebliche Zuordnung"],
  },
  csdc_abschluss_005: {
    layout: "table",
    fieldLabels: ["Versorgungswechsel und Bezug zur Abschlussdokumentation", "Bearbeitungsstand und zuständige Organisation"],
    columns: ["Aufgabe", "Aktueller Stand", "Fälligkeit", "Zuständige Stelle", "Übergabe / Bestätigung"],
  },
  csdc_abschluss_010: {
    layout: "checklist",
    fieldLabels: ["Geprüfter Aktenumfang und Prüfdatum", "Aktenverantwortliche Person und Archivbezug"],
    columns: ["Prüfschritt", "Status", "Nachweis", "Zuständig", "Frist"],
  },
};
