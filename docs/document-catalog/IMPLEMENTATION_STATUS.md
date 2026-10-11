# CareSuite HealthOS — neues Office-Widget „Dokumentenkatalog“

Stand: 11.10.2026. Entwicklungsstand zur Prüfung, nicht veröffentlicht. Zielbild: [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md). Vollständige Liste: [CATALOG_430.md](CATALOG_430.md).

## Ergebnis und Umfang

Ein eigenes Office-Widget und eine zentrale Weboberfläche sind implementiert. Alle **430 vereinbarten Dokumenttypen in 24 Fachbereichen** sind auswählbar. Der Katalog wurde unabhängig von den bisherigen HTML-Vorlagen erstellt. Neue Inhalte, Feldschemata, Layouts und PDF-Ausgabe liegen in eigenen Dateien. Bestehende technische Rechte-, Schrift-, Daten- und Aktenfunktionen werden angebunden. Historisch ausgestellte Dateien werden erhalten.

Die 430 Einträge sind **bearbeitbare Entwicklungsentwürfe**. Viele verwenden ein gemeinsames Fachbereichsgrundschema; ausgewählte Dokumenttypen besitzen eigene Felder und Tabellen. Verträge und Erklärungen enthalten neu verfasste Ausgangsabschnitte. Dokumentweise vollständige Fachinhalte, geprüfte Vertragsvarianten, regionale Regeln und nachgewiesene Freigaben stehen aus. Der gesamte Katalog wird in der Oberfläche entsprechend gekennzeichnet.

| Teil | Implementierter Stand |
| --- | --- |
| Office | Eigenes Widget mit eigener Grafik, Office-Navigation und modulübergreifendem Schnellzugriff im Web |
| Module | Gemeinsame Route `/business/office/document-catalog`; Kontextparameter `module`, `clientId`, `employeeId`, `templateKey` und wiederverwendbare Aktion |
| Suche | Suche nach mehreren Begriffen, Fachbereich und Modul; alle 430 Einträge über Filter erreichbar |
| Zielakten | 307 Klienten-/Patienteneinträge, 22 Personaleinträge, 101 Unternehmens-/Standorteinträge |
| Layouts | 5 Fensterbriefe, 40 Verträge/Erklärungen, 238 Formulare, 142 Tabellen im Querformat, 5 Checklisten |
| Originale | 38 Dokumenttypen als Originalunterlage mit neuem Zuordnungsblatt; PDF-Ausstellerunterlagen werden erhalten |
| Editor | Felder, Herkunftskennzeichnung, Textabschnitte, Tabellenzeilen und getrennte individuelle Zusatztexte |
| Ausgabe | Ein gemeinsamer Vektor-PDF-Renderer für Vorschau, Download, Druck und Ablage; eingebettete bestehende CareSuite-Schrift |
| Aktenablage | Serverdienst und SQL für transaktionale Metadatenablage; Klienten-/Personalaktenverknüpfung, zentrale Unternehmensfassungen |
| Fassungen | Eingefrorener Datenstand, eigene UUID je Fassung, Vorgängerreferenz; gespeicherte Fassungen werden nicht überschrieben |
| Integrität | SHA-256 der tatsächlichen PDF-/Originalbytes und des kanonischen Datenstands; erneute Prüfung beim Download |

Das Widget erscheint auf neuen Office-Desktops in der Standardauswahl. Bereits persönlich zusammengestellte Desktops bleiben erhalten; dort ist es in der Widget-Auswahl verfügbar. Die neue Navigation ist auf Web begrenzt. Der fertiggestellte Android-Arbeitsplatz erhält keine neuen Menüpunkte oder Widgets aus diesem Auftrag.

## Datenübernahme und Bearbeitung

Nach Auswahl einer berechtigten gespeicherten Akte werden Firmierung, Anschrift, Kontakt, Logo-Verweis und vorhandene Register-/Steuer-/IK-Angaben übernommen. Personenname und Anschrift sowie vorhandene Angaben zu Geburtsdatum, Pflegegrad, Kostenträger, Versichertennummer beziehungsweise Personalnummer/Tätigkeit werden zugeordnet. Alle übernommenen Formularwerte bleiben für die konkrete Dokumentfassung bearbeitbar.

Die verbundenen Staging- und Produktionsschemas wurden am 11.10.2026 ausschließlich über Spaltenmetadaten gelesen. Staging verwendet teilweise `tenant_company_profiles` und `clients.zip`, Produktion erweiterte `tenants`-Spalten und `clients.house_number`. Nur bestätigte Fehler wegen fehlender Spalten aktivieren den passenden Fallback. Berechtigungs- und Netzwerkfehler werden weitergegeben. Es werden explizite Feldlisten verwendet; Löhne, Portalzugänge, Zugangscodes und unbenötigte Notizen gelangen nicht in den Datenstand.

Der Stand wird beim Erstellen eingefroren. Spätere Stammdatenänderungen verändern gespeicherte Dokumente nicht. Manuelle Felder, Vorgaben, offene Angaben und tatsächlich übernommene Werte sind unterscheidbar. Pflichtangaben verhindern die Aktenablage bei fehlendem Inhalt. Schnelle Personenwechsel und späte Datei-Leseergebnisse dürfen keine vorherige Akte übernehmen.

**Noch nicht automatisch angebunden:** konkrete Einsätze/Leistungszeilen mit Zeitraum, bewilligte Budgets, Leistungspositionen/Preise, Rechnungsberechnungen, Vertretungsnachweise und Kontakte, individuelle Medikations-/Pflege-/Wunddaten sowie dokumentabhängige Daten aus weiteren Modulen. Diese Inhalte werden in diesem Stand manuell eingegeben. Die Oberfläche erzeugt keine automatisch bestätigten Leistungen oder medizinischen Entscheidungen.

Eine Änderung einer gespeicherten Fassung erzeugt eine neue ID und eine Vorgängerreferenz. Bei Originalunterlagen kann die neue Fassung das geprüfte Original ihrer Vorgängerfassung übernehmen; ein anderer Mandant, eine andere Akte oder Vorlage ist als Quelle ausgeschlossen. PDF und Original sind separat herunterladbar. Die Fassungsliste lädt derzeit die jüngsten 100 Einträge; Paginierung und weitergehende Akten-/Zeitraumfilter sind noch auszuarbeiten.

## Datenbank, Zugriff und Dienst

Die vorbereiteten SQL-Dateien liegen in `supabase/schema/central_document_catalog.sql` und `central_document_catalog_seed.sql`. Sie wurden **nicht auf Staging oder Produktion angewendet**. Die vorhandene Ausführungsumgebung bietet keine Supabase-CLI; die Dateien sind deshalb überprüfte Release-Kandidaten außerhalb der automatischen Migrationen. Im bestehenden Release-Verfahren müssen sie in reguläre Migrationen übernommen werden. Der Seed ist aus denselben Definitionen wie die Oberfläche erzeugt und überschreibt keine bereits vorhandene Version.

`central_document_catalog` speichert Vorlagenversionen. `central_document_records` speichert Akte, Datenstand, Revision, Dateipfade, Prüfwerte und Herkunftsmanifest. Die authentifizierte Edge Function `central-document-record` prüft Benutzerprofil, Mandant, Live-Berechtigungen, tatsächliche Akte und unveränderte Katalogdefinition, berechnet Prüfwerte selbst und registriert alle Metadaten über eine Transaktion. PDF-Dateien werden privat ohne Überschreiben hochgeladen; Fehler führen nicht zu einer Erfolgsmeldung.

RLS beschränkt Datensätze und Dateien auf Mandant und erforderliche Aktenrechte. Klientendokumente werden als `restricted` gespeichert und erfordern auch im neuen Dienst `office.clients.view_sensitive`, da ihr Datenstand Gesundheits-/Versicherungsangaben enthalten kann. Katalogtitel bleiben mit `office.documents.view` sichtbar. Personalunterlagen werden nicht automatisch im Mitarbeiterportal freigegeben. Die allgemeinen Dokumentberechtigungen bleiben erforderlich. Modulübergreifender Zugriff hebt Rollenrechte nicht auf.

Restriktive Storage-Regeln begrenzen auch ältere, weiter gefasste Bucket-Regeln für die neuen Katalogpfade. Gespeicherte Katalogfassungen, alte Generatorverweise und Akten-Dateizeiger werden gegen normales Überschreiben geschützt. Die Originale werden ebenfalls geschützt. Eine besondere Aufbewahrungs-/Lösch- und Berichtigungsregelung für diese unveränderlichen Fassungen muss vor fachlicher Freigabe im vorhandenen Datenschutzprozess ausgearbeitet werden.

Der Dienst ist nicht deployt. Ohne aktivierten SQL-Stand und Dienst kann die Weboberfläche keine echte Aktenablage zusichern und meldet den Fehler. Der vorhandene Demo-Modus speichert tatsächliche PDF-Bytes nur für die Sitzung und benennt diesen Umfang sichtbar.

## Gestaltung und rechtliche Freigabe

Die neue Druckfamilie nutzt Weiß, Dunkelblau, dezentes Blau, klare Überschriften, feste Ränder und eine eigene Fußzeile. Unternehmenslogo und tatsächliche Absenderdaten stehen getrennt von der kleineren CareSuite-Herkunftsangabe. Briefe enthalten bearbeitbaren Betreff, Zeichen, Anlagen, Rücksendeangabe und Anschriftbereich. Die Form-B-orientierten Fensterzonen sind im Renderer explizit hinterlegt. Tabellen haben ein gemeinsames Spaltenraster, angepasste Breiten und wiederholte Köpfe. Verträge besitzen Parteienblöcke, bearbeitbare Abschnitte, Zusatzvereinbarungen und Unterschriftsflächen.

Die vier erzeugten Prüfdokumente sind ausschließlich Gestaltungstests mit erfundenen Daten und `example.test`-Kontakten; sie begrenzen den implementierten Katalog nicht auf vier Vorlagen. Alle PDF-Ausgaben tragen **ENTWURF**. Die Prüfung gegen die maßgebliche DIN-Normfassung sowie ein Ausdruck bei 100 Prozent mit Faltung und tatsächlichem Umschlag stehen aus.

Vertragsausgangstexte ersetzen keine vollständige Ausarbeitung der jeweiligen Vertragsart. Insbesondere ambulante Pflege, Wohn-/Betreuungsverträge, Kurzzeitpflege, Arbeits-/Honorarverträge, Datenschutzinformationen, Einwilligungen, Abtretung und SEPA benötigen dokumentweise Ausgestaltung und fachkundige Prüfung. Pflegeassessments benötigen die passenden freigegebenen Instrumente und gegebenenfalls Nutzungsrechte. Vorgeschriebene Formulare und fremde Ausstellerunterlagen werden als Originale aufgenommen.

Die ID und Prüfwerte belegen Zuordnung und Integrität. Das Herkunftsmanifest bezeichnet ausschließlich `stored_file_integrity`. Eine optional konfigurierte HMAC-Signatur ist technisch vorbereitet; Schlüsselbetrieb, Rotation, Verifikationsdienst und belastbare Nachweiskette sind noch offen. Externe Zertifikate, qualifizierte Signaturen, PDF/A-Konformität und ein absoluter Schutz vor Kopieren oder Diebstahl werden nicht behauptet.

Primäre Grundlagen für die weitere Prüfung: [DIN zu DIN 5008](https://www.din.de/resource/blob/709942/885771ab33f656d523d3db160a51084f/nia-newsletter-2020-03-data.pdf), [§ 120 SGB XI](https://www.gesetze-im-internet.de/sgb_11/__120.html), [WBVG](https://www.gesetze-im-internet.de/wbvg/), [§ 305b BGB](https://www.gesetze-im-internet.de/bgb/__305b.html), [DSGVO](https://eur-lex.europa.eu/eli/reg/2016/679/oj), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Diese Links sind Ausgangspunkte und keine abgeschlossene Einzelfallprüfung.

## Nachweise und verbleibende Prüfungen

| Prüfung | Ergebnis / Grenze |
| --- | --- |
| Modell, Eingangsvalidierung, Datenübernahme, Navigation und bestehender Katalog | Vorhandene Vitest-Prüfungen und neue relevante Fälle; genaue Ergebnisse in `qa/verification.json` |
| SQL und Seed | Lokales PGlite: alle 430 Definitionen exakt gleich zum UI, transaktionale richtige Aktenzuordnung, fremde Mandanten/gefälschte Versionen abgewiesen, RLS-/Storage- und Unveränderlichkeitsfälle |
| PDF-Renderer | Alle 430 Einträge mit Testdaten gerendert; vier Stress-/Layoutdokumente mit tatsächlichen PDF-Dateien und SHA-256 geprüft |
| PDF-Gestaltung | Fensterbrief, Vertrag, Nachweistabelle und Wundformular als PDF gerendert und visuell geprüft; Textprüfung der Beispielseiten ohne Zeichen außerhalb der Seite, Entwurfskennzeichnung auf jeder Seite |
| TypeScript | Feature und tatsächliche Imports: keine Diagnose in neuen/geänderten Zeilen; zwölf Diagnosen außerhalb dieser Zeilen. Gesamtprojektprüfung überschreitet den verfügbaren Arbeitsspeicher |
| Edge Function | Erfolgreich gebündelt und Eingangsvalidierung lokal getestet; tatsächlicher Deno-/Supabase-Lauf noch nicht nachgewiesen |
| Web-Oberfläche | SSR prüft sichtbare Zustände und Katalogabdeckung. Der Browserlauf scheitert vor Start am fehlenden vorhandenen Chromium; keine Installation vorgenommen. Cloud-Browser erreicht den lokalen Server nicht. Visuelle Browserprüfung offen |
| Live-Ende-zu-Ende | Anmeldung/JWT, Datenübernahme, Logo-Laden, Upload, Ablage, Download/Hashprüfung, Originalübernahme, Druckfenster und Aktenanzeige zusammen noch nicht nachgewiesen |

Die vorbereitete Browserprüfung nutzt ausschließlich lokale Prüfdaten und testet 1600, 1200, 820, 390 und 320 Pixel sowie vergrößerte Schrift. Vor Veröffentlichung muss sie in der vorhandenen geeigneten Browserumgebung zusammen mit den tatsächlichen Office-Rahmen, geöffneter Navigation und neuen/schon angepassten Desktops ausgeführt werden. Ein vorhandener Browser kann über `CENTRAL_CATALOG_BROWSER_EXECUTABLE` angegeben werden; das Skript installiert nichts.

Reproduzierbare Befehle mit vorhandenen Abhängigkeiten:

```sh
node scripts/build-central-document-catalog.mjs
node scripts/check-central-document-catalog.mjs
npx --no-install vitest run src/__tests__/documents/centralCatalog.test.ts src/__tests__/documents/centralCatalogDatabase.test.ts src/__tests__/documents/centralCatalogWorkspace.test.tsx src/__tests__/documents/centralCatalogSources.test.ts src/__tests__/documents/documentEngineCatalog.test.ts src/__tests__/navigation/moduleDesktop.test.ts src/__tests__/office/officeNavigationParity.test.ts src/__tests__/liquidCommand/liquidCommandFoundation.test.ts
node scripts/qa/centralDocumentCatalogPdf.mjs
node scripts/qa/centralDocumentCatalogBrowser.mjs
```

Vor Veröffentlichung stehen insbesondere die tatsächlichen Browser-/Supabase-Nachweise, die vollständige dokumentweise Inhaltsausarbeitung und die fachlich/rechtlich belegten Freigaben aus. Produktive Daten und bereits ausgestellte Aktenbelege wurden für diese Entwicklung nicht verändert.
