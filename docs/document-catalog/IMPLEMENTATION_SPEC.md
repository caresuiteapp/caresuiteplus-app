# Zentraler CareSuite-Dokumentenkatalog
Stand: 11.10.2026. Status: Umsetzungsspezifikation, keine implementierte Datenbank und keine juristische Freigabe.

## Ziel
Eine gemeinsame Dokumentenverwaltung für ambulante/stationäre Pflege, Betreuung, Alltagsbegleitung, Tages-/Nachtpflege und Kurzzeitpflege. Auswahl einer Vorlage, Zuordnung einer berechtigten Akte, automatische Datenübernahme mit Vorschau, manuelle Ergänzung, Freigabe, Erstellung eines dauerhaften PDF-Artefakts, Ablage, Download und Druck. Bestehende PDF- und Aktenfunktionen wiederverwenden.

## Katalog
Die 24 Fachgruppen des vereinbarten Katalogs: Aufnahme; Verträge; Vollmachten/Einwilligungen; Pflegeplanung; Risiken/Prophylaxen; Behandlungspflege; Medikamente; Wunden/Spezialversorgung; Betreuung; Alltagsbegleitung/Hauswirtschaft; Leistungsanträge/Beratung; ambulante Einsätze; stationäres Wohnen; Tages-/Nacht-/Kurzzeitpflege; Notfälle/Schutz; Palliativversorgung; Hygiene; Personal; Qualitätsmanagement; Anerkennung/Zulassung; Abrechnung; Datenschutz; Arbeitsschutz/Geräte; Überleitung/Archivierung.
Jede einzelne Vorlage benötigt Fachbereich, Dokumentzweck, zulässige Rollen, Format, Pflichtfelder, Datenbindungen, Inhaltsbausteine, Quellen, rechtlichen Geltungsbereich und Freigabestatus. Keine leeren Vorlagen als fertig kennzeichnen.

## Datenmodell (logische Entitäten, noch keine Migration)
- document_categories: stabile Kennung, Name, Reihenfolge, Fachbereiche.
- document_templates: stabile Kennung, Kategorie, Dokumentart, global oder mandanteneigen, Eigentümermandant, Aktivstatus.
- document_template_versions: Vorlagen-ID, Version, Feldschema, Inhaltsschema, Layoutprofil, Geltungsgebiet, Leistungsart, Quellenstand, Reviewdatum, Reviewer, Status und Inhaltsprüfsumme.
- document_clause_versions: Textbaustein, Version, Anwendbarkeit, Quellen, Reviewstatus, Änderbarkeit.
- document_brand_profiles: Mandant, freigegebenes Logo, Firmierung, Adresse, Kontakt, Register-/Steuerangaben nach Rechtsform, Layoutparameter, Version.
- document_field_bindings: Vorlagenversion, Feldpfad, autorisierte Quelldomäne, Quellfeld, Transformation, Pflichtstatus.
- document_instances: Mandant, konkrete Vorlagenversion, Aktenzuordnung, Berechtigungsbereich, Ersteller, Status, ausgewählter Zeitraum/Einsatz.
- document_instance_revisions: Dokument-ID, Revision, eingefrorener Datenstand, Feldherkunft, manuelle Änderungen, individuelle Zusatztexte, Vorgängerrevision.
- document_artifacts: konkrete Revision, privater Speicherpfad, Dateityp, PDF-Prüfsumme, Renderer-/Layoutversion, Erstellzeit.
- document_signature_records: Artefakt-ID, Unterzeichnerrolle, Signaturverfahren, Nachweisreferenz, Zeitpunkt; keine Gleichsetzung einfacher Unterschrift mit qualifizierter Signatur.
- document_verification_records: Artefakt-ID, zufälliger Verifikationstoken-Digest, signiertes Manifest, Algorithmus, Schlüsselkennung, Widerrufsstatus.
- document_events: Dokument-/Artefakt-ID, Aktion, Akteur, Zeitpunkt, Änderungsreferenz.
- document_legal_reviews: Vorlagen-/Bausteinversion, Prüfumfang, Reviewer, Ergebnis, Datum, belegte Quelle.
Bestehende Mandanten-, Personen-, Personal-, Einsatz-, Leistungs- und Aktenentitäten verknüpfen. Keine zweite Patienten-/Klientendatenbank. Vor Migration vorhandene Schlüssel und Beziehungen prüfen.

## Datenübernahme
Quellen: Unternehmensdaten, ausgewählte Person, rechtliche Vertretung, Kostenträger, Mitarbeitende, Einsätze, bestätigte Leistungen, Preise, Bewilligungen, Kontaktdaten.
Nur für das Dokument benötigte und zugriffsberechtigte Daten übernehmen. Fehlende Pflichtangaben benennen und finale Erstellung verhindern; optional fehlende Inhalte sinnvoll ausblenden. Datenherkunft sichtbar, Änderungen nachvollziehbar.
Auswahl eines Empfängers ersetzt keine Zugriffsprüfung. Leistungserstellung benötigt expliziten Zeitraum und eindeutige Einsatzauswahl. Keine ungeprüften Entwurfsleistungen als bestätigt ausgeben.
Bereits ausgestellte Dokumente behalten eingefrorene Daten; Änderungen erzeugen neue Revision oder Nachtrag. Alte PDF-Dateien niemals still überschreiben.

## Gestaltung
Gemeinsame Druckfamilie: Weiß, Dunkelblau, dezentes Elektroblau, konsistente lizenzierte/eingebettete Schrift, gut lesbare Textgrößen, klare Hierarchie, großzügige nutzbare Schreib-/Unterschriftsfelder. Keine dunklen Vollflächen oder Glass-Effekte im Druck.
Layoutprofile:
1. A4-Brief hochkant: DIN-5008-orientierte Geschäftsbriefgestaltung, Absenderzeile, Fensteranschrift, Informationsblock, Betreff, Inhalt, Anlagen, Pflichtangaben in Fußzeile.
2. A4-Vertrag hochkant: Vertragsparteien, strukturierte Paragraphen, Leistungs-/Preisübersichten, individuelle Vereinbarungen, Anlagen, Unterschriften.
3. A4-Leistungsnachweis quer: feste Tabellenbreiten, wiederholte Tabellenköpfe, Zeitraum, Leistungen, Zeiten/Mengen, Summen, Bestätigung.
4. A4-Fachformular hochkant: eindeutige Eingabefelder, Auswahlmöglichkeiten, Verlauf.
5. A4-Protokoll/Verlauf hoch oder quer: chronologische Tabelle, Fortsetzungsseiten.
6. A4-Antrag mit Anlagen: bei vorgeschriebenen Fremdformularen deren Layout erhalten.
Unternehmenslogo als tatsächlicher Absender; CareSuite-Herkunftskennzeichnung separat und kleiner. Unternehmensfarbe in freigegebenen Grenzen.
DIN 5008 regelt Gestaltung, nicht die rechtliche Wirksamkeit. Konformität erst nach Prüfung gegen maßgebliche Normfassung; Fensterpassung zusätzlich mit Druck bei 100 Prozent, Faltung und realem Umschlag prüfen. Kein DIN-Zertifizierungszeichen ohne Nachweis.
Lange Namen, große Logos, fehlende optionale Daten, 31 Tageszeilen, mehrseitige Tabellen und Verträge testen. Keine isolierten Überschriften oder getrennten Unterschriftsgruppen.

## Rechtliche Inhalte
Separate Varianten für ambulante Pflege, Betreuung/Alltagsbegleitung und stationäres Wohnen. Anwendbarkeit nach Leistungsart, Bundesland, Vertrags- und Zulassungsstatus.
Ausführliche verständliche Vertragsbausteine: Parteien, Vertretung, Gegenstand, Umfang, Grenzen, Vergütung/Eigenanteile, Abrechnung, Durchführung, Absagen, Laufzeit/Kündigung, Datenschutz, Haftung im zulässigen Umfang, Beschwerden, Zusatzvereinbarungen, Anlagen.
Kein universeller Vertrag und keine pauschale Behauptung rechtlicher Sicherheit.
Reviewstufen: Entwurf, fachlich geprüft, rechtlich geprüft im benannten Umfang, freigegeben, abgelöst. Änderungen an geprüften Klauseln erzeugen neue ungeprüfte Version.
Individuelle Ergänzungen separat und bearbeitbar; Formulareingabe allein macht Standardtext nicht zur ausgehandelten Individualabrede.
Quellen: https://www.gesetze-im-internet.de/sgb_11/__120.html ; https://www.gesetze-im-internet.de/wbvg/__3.html ; https://www.gesetze-im-internet.de/wbvg/__6.html ; https://www.gesetze-im-internet.de/bgb/__305b.html ; https://www.din.de/de/mitwirken/normenausschuesse/nia/einfach-richtig-schreiben-707192
Keine externe Zertifizierung behaupten. Offizielle Kassen-/Behördenformulare unverändert nutzen, soweit erforderlich; Herkunftsnachweis gegebenenfalls als separates Begleitblatt.

## Herkunft und Integrität
Sichtbare Kennzeichnung: Erstellt mit CareSuite HealthOS | Dokument-ID | Revision | Seite x/y. Tatsächliche Anbieterfirmierung vor Verwendung bestätigen.
Dokument-ID serverseitig kollisionssicher vergeben. QR-Code enthält ausschließlich nicht erratbaren Prüfverweis, keine Gesundheitsdaten.
PDF-Bytes hashen; signiertes Manifest außerhalb des PDF bindet Artefakt-ID, Revision, Hash, Vorlagenversion und Zeitpunkt. Dadurch keine zirkuläre Prüfsumme im PDF. Alternativ korrektes standardisiertes PDF-Signaturverfahren.
Private Schlüssel ausschließlich serverseitig geschützt, Schlüsselrotation und Widerruf vorsehen.
QR-Prüfung allein belegt die Registrierung, nicht die Unverändertheit des vorgelegten PDF. Byte-Integrität nur durch Vergleich des vorgelegten PDF mit der signierten Prüfsumme oder gültige PDF-Signatur prüfen.
Papierkopien können nicht wie PDF-Bytes verifiziert werden; nur Abgleich mit autorisiertem Original.
Keine Zusage von Diebstahlsicherheit: Kopien sind weiterhin möglich. Zugriffsschutz, Herkunft, Manipulationserkennung und nachvollziehbare Versionen sind die belegbaren Ziele.
Öffentliche Prüfung offenbart keinerlei Patientennamen, Aktennummern, Unterschriften oder Inhalte. Vollständige Prüfung nur autorisiert. Ratenbegrenzung vorsehen.

## Schutz und Speicherung
Mandantentrennung auf Datenbank- und Speicherzugriffsebene; private PDF-Dateien, kurzlebige Downloadfreigaben, vorhandene Aktenberechtigungen beachten. Rollen allein reichen ohne Akten-/Mandantenprüfung nicht.
Globale Vorlagen enthalten keine personenbezogenen Daten. Mandanteneigene Änderungen bleiben privat.
Statushistorie nachvollziehbar, Aufbewahrung/Löschung je Dokumentzweck, kein pauschaler unbegrenzter Verbleib von Gesundheitsdaten.
Finalisierung muss Datenstand, Revision und Artefakt konsistent verbinden. Wiederholte Exportanfragen dürfen kein doppeltes Aktenoriginal erzeugen. Gescheiterte Erstellung erhält nachvollziehbaren Fehlerzustand.

## Bedienablauf
Vorlage auswählen -> Person/Akte und Anlass wählen -> berechtigte Daten übernehmen -> fehlende Angaben/Zusatztexte bearbeiten -> verbindliche Seitenvorschau -> bei Bedarf Prüfung/Unterschrift -> finalisieren -> Akte/Download/Druck.
Zusätzliche Varianten: leeres Formular, vorausgefüllter Entwurf, Kopie, Nachtrag, Storno. Entwürfe sichtbar kennzeichnen. Unterschriften auf konkrete Revision beziehen; nach Inhaltsänderung erneut unterzeichnen.
Editor mit strukturierten Textbausteinen und eingeschränkter Formatierung; keine beliebigen ausführbaren HTML-Inhalte.

## Umsetzung und Abnahme
1. Bestehende Akten-, Dokumenten-, Mandanten- und Berechtigungsarchitektur inventarisieren.
2. Versioniertes Datenmodell und eingeschränkte Zugriffe entwickeln und testen.
3. Layoutfamilie mit Brief, Querformatnachweis und Vertrag als reale Muster rendern und visuell prüfen.
4. Datenbindung, Editor, PDF-Erstellung und Aktenablage durchgängig verbinden.
5. Herkunfts-/Integritätsprüfung implementieren; geänderte PDF-Datei muss Prüfung nicht bestehen.
6. Sämtliche Fachgruppen Vorlage für Vorlage ausarbeiten, zuordnen und freigeben.
7. Integration, Druckprüfung und Rollen-/Mandantentests; erst dann Veröffentlichung.
Abnahme verlangt: korrekte Empfänger/Zeiträume, keine Fremdmandantendaten, echte Aktenablage, stabile Datenstände, korrekte Tabellen und Seitenumbrüche, Fensterbriefprüfung, fehlende Pflichtfelder, lange Texte, Widerruf, Erkennung veränderter Dateien und unveränderte historische Dokumente.
Nicht fertig: Datenbankmigration, UI, Renderer, Verifikationsdienst, alle Dokumenttexte, Rechts-/DIN-Freigaben. Dieses Dokument ist die prüfbare Grundlage, kein fertiges Produkt.
