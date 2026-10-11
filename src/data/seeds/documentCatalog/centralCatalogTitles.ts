/** Vollständiger vereinbarter Katalog. Kennungen bleiben bei Erweiterungen stabil. */
// The numeric prefix is a permanent identity, not an array position. Never
// reuse it; entries can be reordered without changing an existing template ID.
export const CENTRAL_CATALOG_GROUPS = [
  { key: 'aufnahme', name: 'Aufnahme und Stammdaten', target: 'client', modules: ['office', 'assist', 'pflege', 'stationaer'], titles: `
001|Anfragebogen und Erstkontaktprotokoll
002|Aufnahmecheckliste
003|Klient:innen- beziehungsweise Bewohner:innen-Stammblatt
004|Kontaktdatenblatt für Angehörige und Bezugspersonen
005|Notfallkontakte
006|Übersicht behandelnder Ärzt:innen, Therapeut:innen und Apotheken
007|Kranken- und Pflegeversicherungsdaten
008|Pflegegradbescheid und Änderungsbescheide
009|Pflegegutachten
010|Übersicht bewilligter Leistungen und Kostenträger
011|Erstgesprächs- beziehungsweise Aufnahmegesprächsprotokoll
012|Aufnahme vorhandener Hilfsmittel
013|Übersicht weiterer beteiligter Dienste
014|Kommunikationsbedarf, Sprache und Verständigungshilfen
015|Checkliste übernommener und noch fehlender Unterlagen` },
  { key: 'vertraege', name: 'Verträge und Leistungsvereinbarungen', target: 'client', modules: ['office', 'assist', 'pflege', 'stationaer'], titles: `
001|Ambulanter Pflegevertrag
002|Betreuungsvertrag
003|Vertrag über Alltagsbegleitung
004|Hauswirtschaftsvertrag
005|Wohn- und Betreuungsvertrag für stationäre Einrichtungen
006|Tages- beziehungsweise Nachtpflegevertrag
007|Kurzzeitpflegevertrag
008|Vereinbarung über Verhinderungspflege
009|Privatleistungsvereinbarung
010|Leistungsbeschreibung und Leistungskatalog
011|Preisverzeichnis
012|Individueller Kostenvoranschlag
013|Vereinbarung über Eigenanteile
014|Vereinbarung über Fahrtkosten und Auslagen
015|Zusatzleistungsvereinbarung
016|Vertragsänderung beziehungsweise Nachtrag
017|Information zu Ausfällen, Absagen und Kündigungen
018|Kündigung und Vertragsbeendigungsbestätigung
019|Empfangsbestätigung ausgehändigter Vertragsunterlagen` },
  { key: 'vollmachten', name: 'Vollmachten, Einwilligungen und Verfügungen', target: 'client', modules: ['office', 'assist', 'pflege', 'stationaer'], titles: `
001|Datenschutzinformation für Klient:innen und Bewohner:innen
002|Einwilligung für bestimmte Datenverarbeitungen
003|Schweigepflichtentbindung für konkret benannte Empfänger
004|Einwilligung zur Foto- oder Videodokumentation
005|Einwilligung zur Veröffentlichung von Bildern
006|Kommunikationsvereinbarung für E-Mail, Messenger oder digitale Portale
007|Vorsorgevollmacht
008|Betreuerausweis beziehungsweise gerichtlicher Betreuungsbeschluss
009|Dokumentation des Umfangs der rechtlichen Vertretung
010|Patientenverfügung
011|Betreuungsverfügung
012|Vollmacht für Anträge und Kommunikation mit Kostenträgern
013|Abrechnungsvollmacht
014|Abtretungserklärung
015|SEPA-Lastschriftmandat
016|Schlüsselüberlassungsvereinbarung
017|Widerruf einer Einwilligung oder Vollmacht` },
  { key: 'pflegeplanung', name: 'Pflegeanamnese und Pflegeplanung', target: 'client', modules: ['pflege', 'stationaer'], titles: `
001|Pflegeanamnese
002|Strukturierte Informationssammlung
003|Biografische Informationen mit Versorgungsbezug
004|Erfassung von Ressourcen und Unterstützungsbedarf
005|Erfassung persönlicher Wünsche und Gewohnheiten
006|Pflegerische Risikoeinschätzung
007|Individueller Maßnahmenplan beziehungsweise Pflegeplanung
008|Tagesstruktur und wiederkehrende Versorgungsabläufe
009|Vereinbarte Pflegeziele
010|Pflegebericht beziehungsweise Berichteblatt
011|Evaluation der Maßnahmen
012|Dokumentation veränderter Versorgungssituationen
013|Dokumentation abgelehnter Leistungen und vereinbarter Alternativen
014|Angehörigengespräch und Beratung
015|Fallbesprechungsprotokoll
016|Pflegevisitenprotokoll` },
  { key: 'risiken', name: 'Risiken, Beobachtungen und Prophylaxen', target: 'client', modules: ['pflege', 'stationaer'], titles: `
001|Sturzrisikoeinschätzung
002|Sturzprotokoll
003|Dekubitusrisikoeinschätzung
004|Hautbeobachtung
005|Mobilitäts- und Bewegungsbeurteilung
006|Bewegungs- beziehungsweise Positionierungsplan
007|Ernährungsassessment
008|Gewichtsverlauf
009|Trinkprotokoll
010|Ernährungs- beziehungsweise Essprotokoll
011|Schluckbeobachtung und Dysphagiedokumentation
012|Schmerzassessment und Schmerzverlauf
013|Kontinenzeinschätzung
014|Ausscheidungsprotokoll
015|Beobachtung von Kognition, Orientierung und Verhalten
016|Schlafbeobachtung
017|Mundgesundheitsassessment
018|Dokumentation individuell erforderlicher Prophylaxen
019|Beratungsnachweis zu festgestellten Risiken
020|Dokumentation von Wirksamkeit und Anpassung der Maßnahmen` },
  { key: 'behandlungspflege', name: 'Behandlungspflege und ärztliche Zusammenarbeit', target: 'client', modules: ['pflege', 'stationaer'], titles: `
001|Verordnung häuslicher Krankenpflege
002|Folgeverordnung beziehungsweise Änderungsverordnung
003|Genehmigung oder Ablehnung der Krankenkasse
004|Ärztliche Anordnung
005|Dokumentation telefonischer Anordnungen und ihrer Rückbestätigung
006|Behandlungspflegeplan
007|Durchführungsnachweis Behandlungspflege
008|Vitalwerteprotokoll
009|Blutzuckerprotokoll
010|Insulin- und Injektionsnachweis
011|Kompressionsversorgungsnachweis
012|Katheter- und Katheterwechselprotokoll
013|Stomaversorgungsdokumentation
014|Sonden- und PEG-Versorgungsdokumentation
015|Enteraler Ernährungsplan
016|Infusions- beziehungsweise Portversorgungsdokumentation
017|Sauerstofftherapie- und Inhalationsnachweis
018|Ärztliches Kommunikationsprotokoll
019|Dokumentation von Abweichungen, Komplikationen und eingeleiteten Maßnahmen
020|Befunde, Arztbriefe und Krankenhausentlassberichte` },
  { key: 'medikamente', name: 'Medikamente und Arzneimittelsicherheit', target: 'client', modules: ['pflege', 'stationaer'], titles: `
001|Aktueller Medikationsplan
002|Ärztliche Medikamentenanordnungen
003|Dokumentation von Medikationsänderungen
004|Allergie- und Unverträglichkeitsübersicht
005|Medikamentenrichtplan
006|Medikamentengabenachweis
007|Bedarfsmedikationsanordnung mit Anlass, Dosierung und Grenzen
008|Bedarfsmedikationsnachweis mit Wirkungskontrolle
009|Dokumentation verweigerter oder ausgefallener Medikamentengaben
010|Dokumentation von Einnahmeunterstützung
011|Medikamentenbestell- und Liefernachweis
012|Medikamentenübernahme bei Aufnahme oder Rückkehr
013|Bestands- und Verfallsdatenkontrolle
014|Temperaturprotokoll für kühlpflichtige Arzneimittel
015|Betäubungsmittel-Bestands- und Verbleibsnachweis
016|Dokumentation von Arzneimittelfehlern
017|Rückgabe- beziehungsweise Entsorgungsnachweis
018|Vereinbarung zur selbstständigen Medikamentenverwaltung` },
  { key: 'wunden', name: 'Wunden und besondere pflegerische Versorgungen', target: 'client', modules: ['pflege', 'stationaer'], titles: `
001|Wundanamnese
002|Wundassessment
003|Wundverlaufsdokumentation
004|Wundfotodokumentation
005|Ärztliche Anordnung zur Wundversorgung
006|Verbandwechselnachweis
007|Wundmaterialübersicht
008|Schmerzbeobachtung bei Wundversorgung
009|Dokumentation von Infektionszeichen
010|Kommunikation mit Ärzt:innen und Wundexpert:innen
011|Versorgungsplan für komplexe Wunden
012|Tracheostomaversorgungsnachweis
013|Absaugprotokoll
014|Beatmungs- und Gerätekontrollprotokoll
015|Notfallplan für außerklinische Intensivpflege
016|Überwachungs- und Verlaufsprotokoll bei Intensivversorgung` },
  { key: 'betreuung', name: 'Betreuung, Aktivierung und soziale Teilhabe', target: 'client', modules: ['assist', 'stationaer', 'pflege'], titles: `
001|Betreuungsanamnese
002|Interessen- und Gewohnheitenprofil
003|Biografiebogen für die Betreuung
004|Individueller Betreuungsplan
005|Teilhabeziele und gewünschte Aktivitäten
006|Wochen- und Monatsprogramm
007|Gruppenangebotsplanung
008|Einzelbetreuungsplanung
009|Teilnahme- beziehungsweise Anwesenheitsnachweis
010|Betreuungs- und Aktivierungsbericht
011|Dokumentation von Spaziergängen und Ausflügen
012|Begleitungsnachweis für Arzt- und Behördentermine
013|Dokumentation kognitiver und alltagspraktischer Angebote
014|Beobachtung von Stimmung, Rückzug und Überforderung
015|Angehörigen- und Bezugspersonengespräch
016|Evaluation der Betreuungsangebote
017|Veranstaltungs- und Ausflugsorganisation
018|Individueller Unterstützungsplan bei Demenz
019|Krisenplan bei herausforderndem Verhalten` },
  { key: 'alltag', name: 'Alltagsbegleitung, Entlastung und Hauswirtschaft', target: 'client', modules: ['assist', 'office'], titles: `
001|Bedarfserhebung für Alltagsunterstützung
002|Individuelle Leistungs- und Aufgabenvereinbarung
003|Haushalts- und Unterstützungsplan
004|Einsatzplan für Alltagsbegleitung
005|Hauswirtschaftlicher Tätigkeitsnachweis
006|Betreuungs- und Begleitungsnachweis
007|Einkaufsauftrag und Einkaufsliste
008|Bargeldübernahme- und Rückgabeprotokoll
009|Beleg- und Auslagenabrechnung
010|Haushaltskassenbuch bei übernommener Geldverwaltung
011|Schlüsselübergabe- und Rückgabeprotokoll
012|Vereinbarung zur Nutzung von Haushaltsgeräten
013|Dokumentation von Sachschäden und besonderen Vorkommnissen
014|Abgrenzung zulässiger Tätigkeiten und ausgeschlossener Leistungen
015|Information zur Nutzung des Entlastungsbetrags
016|Leistungsnachweis für Angebote nach § 45a SGB XI
017|Erstattungsunterlagen für Leistungen aus dem Entlastungsbetrag
018|Unterlagen zum Umwandlungsanspruch
019|Nachweis zur Entlastung pflegender Angehöriger
020|Rückmeldung zur Veränderung des Unterstützungsbedarfs` },
  { key: 'antraege', name: 'Verhinderungspflege, Beratung und Leistungsanträge', target: 'client', modules: ['assist', 'pflege', 'beratung', 'office'], titles: `
001|Antrag auf Verhinderungspflege
002|Bewilligung beziehungsweise Kostenzusage
003|Angaben zur verhinderten Pflegeperson
004|Vereinbarung über Ersatzpflege
005|Stunden- oder tagebezogener Ersatzpflegenachweis
006|Rechnung und Erstattungsunterlagen
007|Übersicht bereits verwendeter Leistungsbudgets
008|Unterlagen zur Kurzzeitpflege
009|Beratungsnachweis nach § 37 Absatz 3 SGB XI
010|Beratungsprotokoll zu Versorgungsbedarf und Entlastungsmöglichkeiten
011|Antrag auf Pflegegrad beziehungsweise Höherstufung
012|Antrag auf Pflegehilfsmittel
013|Antrag auf wohnumfeldverbessernde Maßnahmen
014|Antrag auf Kostenübernahme durch das Sozialamt
015|Unterlagen zur Hilfe zur Pflege
016|Dokumentation von Antragsfristen und Rückfragen
017|Bescheide und Widerspruchsunterlagen` },
  { key: 'einsatz', name: 'Ambulante Einsatzorganisation', target: 'client', modules: ['assist', 'pflege', 'office'], titles: `
001|Tourenplan
002|Dienst- und Einsatzplan
003|Klient:innenbezogenes Einsatzprofil
004|Aufgabenliste für einzelne Einsätze
005|Einsatzbeginn- und Einsatzendenachweis
006|Leistungsnachweis mit Leistungsbestätigung
007|Dokumentation von Leistungsänderungen
008|Einsatzabsage und Ausfallgrund
009|Dokumentation nicht angetroffener Klient:innen
010|Notfallablauf bei ausbleibendem Kontakt
011|Vertretungs- und Übergabeinformation
012|Rufbereitschaftsplan
013|Rufbereitschafts- und Telefonprotokoll
014|Fahrt- und Wegezeitnachweis
015|Fahrtenbuch beziehungsweise Kilometerabrechnung
016|Fahrzeugübergabe- und Fahrzeugkontrollbogen
017|Übersicht verwahrter Schlüssel und Zugangsinformationen
018|Dokumentation von Verspätungen und Versorgungsunterbrechungen` },
  { key: 'stationaer', name: 'Stationäre Pflege und Wohnen', target: 'client', modules: ['stationaer', 'office'], titles: `
001|Vorvertragliche Informationen
002|Einzugs- und Aufnahmecheckliste
003|Zimmerübergabeprotokoll
004|Inventar- und Eigentumsverzeichnis
005|Hausordnung
006|Übersicht von Wahl- und Zusatzleistungen
007|Belegungs- und Zimmerübersicht
008|Bewohner:innenbezogene Tagesstruktur
009|Abwesenheits- und Rückkehrdokumentation
010|Besuchs- und Kontaktvereinbarungen
011|Wäschekennzeichnung und Wäscheverlustdokumentation
012|Bewohnergeld- beziehungsweise Verwahrgeldkonto
013|Quittungen über Auszahlungen und Auslagen
014|Bewohnerbeirats- beziehungsweise Vertretungsunterlagen
015|Protokolle von Bewohner:innenversammlungen
016|Dokumentation von Beschwerden und Beteiligung
017|Entgeltänderungsmitteilungen
018|Unterlagen zur indikatorengestützten Qualitätserhebung
019|Rückmeldungen und Auswertungen der Datenauswertungsstelle
020|Meldungen und Unterlagen für die zuständige Aufsichtsbehörde
021|Auszugs- und Abschlussprotokoll` },
  { key: 'teilstationaer', name: 'Tagespflege, Nachtpflege und Kurzzeitpflege', target: 'client', modules: ['stationaer', 'pflege', 'office'], titles: `
001|Aufnahme- beziehungsweise Buchungsvereinbarung
002|Besuchstage- und Anwesenheitsübersicht
003|Individueller Tagespflegeplan
004|Tagesstruktur und Betreuungsprogramm
005|Fahrdienstvereinbarung
006|Abhol- und Rückbringplan
007|Übergabeprotokoll zwischen Einrichtung und Häuslichkeit
008|Übernahme aktueller Medikamente und Anordnungen
009|Dokumentation mitgebrachter Hilfsmittel und persönlicher Gegenstände
010|Mahlzeiten- und Ernährungsinformationen
011|Tagesbezogene Pflege- und Betreuungsdokumentation
012|Abwesenheits- und Stornierungsnachweis
013|Kostenzusage und Abrechnungsunterlagen
014|Überleitungs- beziehungsweise Entlassungsbericht
015|Rückgabeprotokoll für Medikamente, Hilfsmittel und Eigentum` },
  { key: 'notfall', name: 'Notfälle, Schutz und besondere Ereignisse', target: 'client', modules: ['assist', 'pflege', 'stationaer', 'office'], titles: `
001|Klient:innenbezogenes Notfallblatt
002|Individueller Notfall- und Krisenplan
003|Notfallprotokoll
004|Unfall- beziehungsweise Ereignisbericht
005|Dokumentation von Rettungsdiensteinsätzen
006|Krankenhausüberleitungsbogen
007|Dokumentation von Gewalt, Vernachlässigung oder Missbrauchsverdacht
008|Schutzmaßnahmen- und Interventionsplan
009|Vermisstenmeldung beziehungsweise Suchablauf
010|Dokumentation akuter Selbst- oder Fremdgefährdung
011|Dokumentation freiheitsentziehender Maßnahmen
012|Gerichtliche Genehmigungen
013|Prüfung von Alternativen zu freiheitsentziehenden Maßnahmen
014|Dokumentation von Aufklärung, Entscheidung und Verlauf
015|Nachbesprechung kritischer Ereignisse
016|Meldung an zuständige Stellen` },
  { key: 'palliativ', name: 'Palliative Versorgung und Lebensende', target: 'client', modules: ['pflege', 'stationaer'], titles: `
001|Palliative Bedarfserhebung
002|Individueller palliativer Versorgungsplan
003|Dokumentation von Wünschen für die letzte Lebensphase
004|Symptom- und Schmerzverlauf
005|Ärztlicher Krisen- und Bedarfsmedikationsplan
006|SAPV-Verordnung und Versorgungsunterlagen
007|Kontaktübersicht Hospizdienst und Palliativteam
008|Gesprächsprotokoll zur gesundheitlichen Versorgungsplanung
009|Dokumentation von Behandlungsentscheidungen und Therapiebegrenzungen
010|Begleitung und Beratung von Angehörigen
011|Sterbeverlaufsdokumentation
012|Dokumentation der Versorgung nach dem Tod
013|Benachrichtigungsprotokoll
014|Eigentums- und Schlüsselrückgabe
015|Abschluss der Versorgungsakte` },
  { key: 'hygiene', name: 'Hygiene, Reinigung und Lebensmittel', target: 'company', modules: ['office', 'assist', 'pflege', 'stationaer'], titles: `
001|Hygieneplan
002|Reinigungs- und Desinfektionsplan
003|Händehygieneanweisung
004|Hautschutzplan
005|Hygieneschulungsnachweis
006|Infektionsbezogener Maßnahmenplan
007|Dokumentation von Infektionen und Ausbrüchen
008|Meldeunterlagen bei meldepflichtigen Sachverhalten
009|Schutzkleidungs- und Schutzausrüstungsvorgaben
010|Aufbereitungsanweisungen für verwendete Produkte
011|Aufbereitungs- und Freigabenachweise
012|Wäschehygieneplan
013|Abfall- und Entsorgungsplan
014|Reinigungsnachweise
015|Lebensmittelhygienekonzept beziehungsweise HACCP-Unterlagen
016|Temperaturkontrollen für Lebensmittel
017|Wareneingangs- und Lagerkontrollen
018|Allergeninformationen
019|Belehrungs- und Schulungsnachweise im Lebensmittelbereich
020|Schädlingskontrollnachweise
021|Trinkwasserbezogene Prüf- und Maßnahmenunterlagen` },
  { key: 'personal', name: 'Personal und Qualifikation', target: 'employee', modules: ['office'], titles: `
001|Personalstammblatt
002|Arbeitsvertrag und Vertragsnachträge
003|Stellenbeschreibung
004|Berufsabschluss- und Qualifikationsnachweise
005|Berufszulassung beziehungsweise Anerkennungsnachweise
006|Nachweise besonderer Fachqualifikationen
007|Führungszeugnis
008|Einarbeitungsplan
009|Einarbeitungs- und Kompetenznachweis
010|Fortbildungsplan
011|Fortbildungs- und Schulungsnachweise
012|Nachweise für Betreuungskräfte nach §§ 43b, 53b SGB XI
013|Qualifikationsnachweise für Alltagsbegleitung nach Landesrecht
014|Delegations- und Aufgabenübertragungsnachweise
015|Verpflichtung auf Vertraulichkeit
016|Dienstplan
017|Arbeitszeitnachweis
018|Rufbereitschafts- und Bereitschaftsdienstnachweis
019|Urlaubs- und Abwesenheitsplanung
020|Mitarbeitergespräch
021|Praxisanleitungs- und Ausbildungsnachweise
022|Austritts- und Rückgabecheckliste` },
  { key: 'qm', name: 'Qualitätsmanagement und Betriebsorganisation', target: 'company', modules: ['office', 'pflege', 'stationaer', 'assist'], titles: `
001|Einrichtungskonzept
002|Pflegekonzept
003|Betreuungs- und Hauswirtschaftskonzept
004|Leitbild
005|Organigramm
006|Zuständigkeits- und Vertretungsregelung
007|Qualitätsmanagementhandbuch beziehungsweise Prozesssammlung
008|Verfahrens- und Arbeitsanweisungen
009|Umsetzung relevanter Expertenstandards
010|Dokumentenlenkung und Versionsübersicht
011|Beschwerdeformular und Beschwerdeauswertung
012|Fehlermeldung und Verbesserungsmaßnahme
013|Internes Audit und Auditbericht
014|Qualitätszirkel- und Teambesprechungsprotokoll
015|Befragungen von Klient:innen, Bewohner:innen und Angehörigen
016|Kooperationsvereinbarungen
017|Notfall- und Betriebsausfallkonzept
018|Nachweise interner Kontrollen
019|Prüfberichte des Medizinischen Dienstes beziehungsweise anderer Prüfstellen
020|Maßnahmenplan zu Prüffeststellungen
021|Nachweis umgesetzter Korrekturen
022|Managementbewertung beziehungsweise interne Qualitätsauswertung` },
  { key: 'zulassung', name: 'Anerkennung, Zulassung und Kostenträgerverträge', target: 'company', modules: ['office'], titles: `
001|Gewerbe- und Unternehmensunterlagen
002|Anerkennungsantrag für Angebote zur Unterstützung im Alltag
003|Anerkennungsbescheid
004|Angebotskonzept und Leistungsbeschreibung
005|Qualifikations- und Fachkraftnachweise
006|Nachweis fachlicher Begleitung beziehungsweise Kooperationsvertrag
007|Versicherungsnachweise
008|Tätigkeits- beziehungsweise Jahresberichte
009|Änderungsanzeigen zur Anerkennung
010|Versorgungsvertrag nach SGB XI
011|Vergütungsvereinbarungen
012|Verträge zur häuslichen Krankenpflege nach SGB V
013|Institutionskennzeichen und zugehörige Unterlagen
014|Zulassungsunterlagen für besondere Versorgungsangebote
015|Betriebsanzeigen und aufsichtsrechtliche Unterlagen
016|Schriftverkehr mit Pflegekassen, Krankenkassen und Behörden` },
  { key: 'abrechnung', name: 'Abrechnung und Finanzen', target: 'client', modules: ['office'], titles: `
001|Leistungsbestätigung beziehungsweise unterschriebener Leistungsnachweis
002|Abrechnungsfähige Leistungsübersicht
003|Monatsabrechnung je Klient:in oder Bewohner:in
004|Rechnung an Kostenträger
005|Privatrechnung beziehungsweise Eigenanteilsrechnung
006|Elektronischer Abrechnungsdatensatz und Übertragungsprotokoll
007|Abrechnungsfreigabe
008|Budgetübersicht je Leistungsart
009|Kostenzusagen und Bewilligungen
010|Absetzung, Rückweisung und Korrekturabrechnung
011|Gutschrift und Stornorechnung
012|Offene-Posten-Liste
013|Zahlungseingangs- und Zuordnungsnachweis
014|Mahnung
015|Erstattungsantrag
016|Auslagen- und Fahrtkostenabrechnung
017|Buchungsbelege
018|Kassenbuch
019|Unterlagen zur Abrechnungsprüfung` },
  { key: 'datenschutz', name: 'Datenschutz und digitale Dokumentation', target: 'company', modules: ['office'], titles: `
001|Verzeichnis von Verarbeitungstätigkeiten
002|Technische und organisatorische Maßnahmen
003|Rollen- und Berechtigungskonzept
004|Auftragsverarbeitungsverträge
005|Datenschutzinformationen für Mitarbeitende
006|Lösch- und Aufbewahrungskonzept
007|Datenschutz-Folgenabschätzung
008|Dokumentation von Datenschutzverletzungen
009|Auskunfts- und andere Betroffenenanfragen
010|Einwilligungs- und Widerrufsverwaltung
011|IT-Sicherheits- und Datensicherungskonzept
012|Wiederherstellungs- und Ausfallverfahren
013|Vergabe und Entzug von Benutzerrechten
014|Änderungs- und Zugriffsprotokolle
015|Regelung zu mobilen Geräten
016|Regelung zur elektronischen Leistungsbestätigung und Unterschrift
017|Datenexport- und Archivierungsverfahren` },
  { key: 'arbeitsschutz', name: 'Arbeitsschutz, Geräte und Gebäude', target: 'company', modules: ['office', 'pflege', 'stationaer'], titles: `
001|Gefährdungsbeurteilungen
002|Betriebsanweisungen
003|Arbeitsschutzunterweisungen
004|Gefahrstoffverzeichnis
005|Sicherheitsdatenblätter
006|Dokumentation arbeitsmedizinischer Vorsorge
007|Unfallanzeige und Erste-Hilfe-Dokumentation
008|Nachweise ausgebildeter Ersthelfender
009|Brandschutzordnung
010|Flucht-, Rettungs- und Evakuierungspläne
011|Räumungsübungen
012|Medizinprodukteverzeichnis
013|Medizinproduktebücher
014|Einweisungsnachweise für Geräte
015|Wartungs-, Prüf- und Reparaturnachweise
016|Prüfungen elektrischer Betriebsmittel
017|Hilfsmittelübergabe- und Funktionskontrollnachweise
018|Gebäude- und Anlagenprüfungen
019|Fahrzeugprüfungen und Wartungsnachweise` },
  { key: 'abschluss', name: 'Überleitung, Beendigung und Archivierung', target: 'client', modules: ['office', 'assist', 'pflege', 'stationaer'], titles: `
001|Überleitungsbogen bei Krankenhausaufnahme
002|Übergabe an einen anderen Pflege- oder Betreuungsdienst
003|Entlassungs- beziehungsweise Abschlussbericht
004|Abschlussgespräch
005|Dokumentation offener Versorgungsaufgaben
006|Medikamenten- und Hilfsmittelübergabe
007|Rückgabe von Eigentum und verwahrtem Geld
008|Schlüsselrückgabe
009|Schlussabrechnung
010|Abschlusskontrolle der Akte
011|Archivierungsvermerk
012|Dokumentation der Löschung nach Ablauf maßgeblicher Fristen` },
] as const;
