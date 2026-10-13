# Office-Dokumentenkatalog: Integrationsstand vom 13.10.2026

Die technische Integration enthält den Hauptstand `0a496f3da713a8f4b73cd57e30e237d1b97f5d35`. Sie umfasst den gesamten Katalog mit 450 Einträgen in 25 Fachbereichen. Die aktuelle Kopfzeile mit Neo rechts neben dem Logo, die neue Seitennavigation und die serverseitig verifizierten Einsatzabschlüsse bleiben erhalten. Die bisherigen 430 Kennungen bleiben erhalten; 20 CareSuite-Software- und App-Dokumente gehören ebenfalls zur zentralen Sammlung.

## Oberfläche und Zugänge

Der Dokumentenkatalog ist ein eigenes Office-Widget mit eigener Grafik, Navigation und Arbeitsfläche. Der kanonische Zugang lautet `/business/office/document-catalog`; `/office/document-catalog` bleibt als weiterer Zugang verfügbar. Widget-Auswahl, Kopfzeile, Schriftgrößen, Wetter, Navigation und die acht Desktop-Bereiche des aktuellen Hauptstands werden übernommen. Die neue Kachel gehört zum Office-Standarddesktop und wird bei vorhandenen Office-Auswahlen einmalig vorangestellt. Alle bisherigen Kacheln und ihre relative Reihenfolge bleiben erhalten; bei einem vollen Desktop entsteht eine weitere Seite. Die Einführungskennung wird getrennt nach Mandant, Person und Bereich gespeichert. Wer die Kachel danach entfernt, erhält sie beim Neuladen nicht erneut. Ohne Katalogberechtigung wird sie nicht hinzugefügt. Die Office-Navigation und Widget-Auswahl bieten weiterhin einen Zugang.

Die Arbeitsfläche bietet Suche, Fachbereichs- und Modulfilter, eine Aktenauswahl, bearbeitbare Felder und Textabschnitte, Tabellenzeilen, eigene Zusatztexte sowie Vorschau, PDF-Download, Druck und Aktenablage. Unternehmenslogo und Stammdaten werden geladen. Fehlende Angaben bleiben sichtbar. Bei Fensterbriefen wird die Empfängeranschrift ausdrücklich gewählt; die Aktenzuordnung bleibt davon unabhängig. Unternehmensverträge wiederholen die eigene Organisation nicht als zweite Vertragspartei; ein gespeicherter CareSuite-Anbietertext erscheint als eigene Partei.

Kontextbezogene Vorschläge sind in den Fachansichten aufklappbar. Jeder Vorschlag nennt seinen Zweck und übernimmt die tatsächlichen Vorgangs- und Aktenkennungen. URLs enthalten keine Namen, Anschriften, Diagnosen oder Dokumenttexte. Ein eigener, aus demselben Katalog erzeugter Metadatenindex vermeidet den Import von Dokumenttexten und PDF-Schriften in jede Fachansicht.

| Arbeitsbereich | Einbindung |
| --- | --- |
| Office und Desktop | Eigene Kachel, Office-Navigation, Apps- und Widget-Auswahl, Dashboard und Dokumentenverwaltung |
| Klientenaufnahme | Hinweis auf Aufnahme- und Stammdokumente in der bereits angelegten Klientenakte |
| Klientenakte | Übersicht, Dokumente, Verträge, Einwilligungen, Abrechnung, Portal, Einsätze, Aufgaben und Fachregister |
| Personalakte | Beschäftigung, Dokumente, Qualifikationen, Portalfreigaben und Rückgabe von Arbeitsmitteln |
| Einsätze und Leistungsnachweise | Übernahme der echten Klienten-, Mitarbeiter- und Einsatzkennungen; bestehender Abschluss- und Signaturablauf bleibt erhalten |
| Abrechnung und Budgets | Vorschläge in Rechnungsdetails und Klientenbudgets; Verknüpfung mit der ausgewählten Rechnung |
| Pflege und Stationär | Modulbereiche, Medikation, Wunddokumentation und Übergabeberichte |
| Beratung, Akademie und Alltag | Kontextvorschläge über die gemeinsamen Modul- und Dokumentbausteine |
| Qualität, Datenschutz und Inventar | Vorschläge im Arbeitsbereich sowie in Datenschutz- und Inventaransichten |

Die generierten Elternrouten berücksichtigen beide neuen Katalogzugänge.

23 benannte Arbeitsabläufe steuern die Vorschläge zentral. Ein Vorschlag behauptet weder, dass eine Unterlage fehlt, noch dass sie rechtlich zwingend vorgeschrieben ist. Unpassende Personenarten und fehlende Erstellungsrechte werden berücksichtigt.

## Datenübernahme und Fassungen

Unternehmens-, Klienten- und Personalstammdaten werden mandantenbezogen aus ausdrücklich benannten Spalten übernommen. Adressen von Unternehmen und zugeordneter Person bleiben getrennt. Einwilligungen und Vertretungsangaben werden nicht aus einem beliebigen Notfallkontakt abgeleitet. Fehlende Vertretungskennzeichnungen in älteren Datenbankständen führen zu einer sichtbaren Ergänzungsaufforderung. Nicht verfügbare Fachinformationen werden nicht erfunden.

Die gezielte Vorgangsübernahme unterstützt tatsächliche abgeschlossene Einsatzzeiten, Rechnungszeiträume und Rechnungspositionen, gespeicherte Medikationsdaten sowie Wundfälle mit dem letzten dokumentierten Assessment. Zu jedem referenzierten Vorgang werden Mandant, zugeordneter Klient und die erforderlichen Leserechte geprüft. Die gespeicherte Rechnung kann ihren eigenen Empfänger als Kostenträger liefern. Geplante Zeiten, Absagen, fehlende Endzeiten und ungültige Zeitintervalle erzeugen keine ausgeführten Leistungen. Bestätigungen werden nicht automatisch ergänzt. Unterschiedliche Kalendertage bleiben bei Einsätzen über Mitternacht erkennbar.

Stammdaten lassen sich erneut laden. Individuell geänderte Felder, Zusatztexte und manuell bearbeitete Tabellen bleiben erhalten. Änderungen nach einer Ablage erhalten eine neue Dokument-ID und eine Verknüpfung zur Vorgängerfassung. Änderungen an Funktionsreferenzen oder am Anzeigenamen des angemeldeten Benutzers setzen einen bearbeiteten Entwurf nicht zurück. Mandanten-, Identitäts- und Berechtigungswechsel trennen die Arbeitsstände.

Die gespeicherten Fassungen lassen sich auf die ausgewählte Klienten- oder Personalakte begrenzen. Weitere Fassungen werden seitenweise nachgeladen; die Ansicht endet nicht stillschweigend nach den ersten 100 Einträgen.

## Aktenablage und Berechtigungen

`central-document-record` prüft Anmeldung, Mandant, Live-Berechtigungen, reale Akte, unveränderte Vorlagendefinition, referenzierte Vorgänge und Vorgängerfassung. Dateien werden privat ohne Überschreiben gespeichert. Der Server berechnet Prüfwerte der tatsächlichen PDF- und Originaldateien und registriert die Metadaten über eine Transaktion. Die Speicherung verknüpft Klienten- und Personalunterlagen mit den bestehenden Akten; Unternehmensdokumente liegen im zentralen Office-Archiv. Dateinamen enthalten Vorlage, Dokument-ID und Fassung. Verträge, Einwilligungen, Leistungsnachweise und Fachunterlagen erhalten passende Aktenkategorien.

Datenbankregeln verhindern das nachträgliche Ändern oder Löschen einer Katalogfassung und ihrer Dateizeiger. Direkte Schreibzugriffe auf den privaten Katalogspeicher sind für angemeldete Clients gesperrt. Ältere erlaubte Dokumenttypen bleiben erhalten, wenn der neue Typ `central_catalog` zur bestehenden Prüfung hinzugefügt wird. Die Aktivierung setzt einen tatsächlich privaten `office-documents`-Bucket voraus.

Alle Vorlagen bleiben Entwürfe. Eine technische ID, Dateiprüfwerte und ein optional konfigurierbares Herkunftsmanifest belegen Zuordnung und Dateiintegrität; sie ersetzen keine externe Zertifizierung, verhindern keine Kopie und bestätigen keine medizinische oder juristische Richtigkeit. Die fachliche und rechtliche Freigabe bleibt dokumentbezogen erforderlich. Offizielle Originalunterlagen werden nicht als neue eigene Urkunden nachgebildet.

## Verifikation und Aktivierung

Die Prüfprotokolle sind in `qa/integration-verification-2026-10-13.json` zusammengefasst. Drei ältere Prüfannahmen des Einsatz-Gates wurden an die bereits im Hauptzweig eingeführten Bestätigungen angepasst: der Abgleich beim Einsatzende wird abgewartet; der gemeinsame Schreibsitzungsschutz gilt auch für beide Abschlussarten; eine verweigerte WFM-Übergabe wird zusammen mit dem erhaltenen Leistungsnachweis gemeldet. Das Laufzeitverhalten wurde dafür nicht geändert. Die vorhandene Testsuite prüft Katalogabdeckung, Datenquellen, Rollen, Mandantentrennung, Transaktionen, Originaldateien, unveränderliche Fassungen, individuelle Bearbeitung und UI-Routing. Die PDF-Prüfung erzeugt alle 450 Vorlagen und prüft die tatsächlichen binären SHA-256-Werte. Beispielseiten für Briefe, Leistungsnachweise, Pflegeverträge, Wundformulare, CareSuite-Nutzungsverträge und Mitarbeiterdatenschutz werden gerendert und visuell geprüft.

Die Browserprüfung der neuen Oberfläche in breiten und schmalen Fenstern, das echte Druckfenster sowie der vollständige Browser–API–Speicher-Ablauf sind noch offen. Das vorhandene Playwright-Werkzeug findet keinen Browser; es wird keine zusätzliche Browser- oder Testinfrastruktur installiert. DOM-Tests werden nicht als visuelle Prüfung ausgegeben.

Die Produktionsdatenbank caresuiteplus-production enthält seit dem 13.10.2026 alle 450 Vorlagen in 25 Fachbereichen. Jede Definition wurde mit dem aktuellen UI-Seed verglichen; der abschließende Abgleich ergab keine Abweichung. Die erste Seed-Übertragung wurde wegen einer Kürzung im Übertragungsweg vollständig korrigiert, bevor die Oberfläche veröffentlicht wurde. Es waren zu diesem Zeitpunkt keine Dokumentfassungen gespeichert. Die tatsächlichen Migrationen 20261013080703, 20261013080727 und 20261013081943 sind im Repository festgehalten. Beide Katalogtabellen verwenden RLS. Der office-documents-Bucket bleibt privat, und der Registrierungsdienst ist nur für service_role ausführbar. central-document-record ist mit JWT-Prüfung und einer festgelegten Version von supabase-js aktiv. Der geschützte Einsatz- und Signaturablauf sowie die ausgelieferte Android-App bleiben erhalten.

Die Veröffentlichung und Datenbankaktivierung wurden am 13.10.2026 ausdrücklich freigegeben. Die Web-Veröffentlichung erfolgt über PR #52. Die laufende Datenbankaktivierung ist in den tatsächlichen Migrationen dokumentiert; die Dateien unter supabase/schema bleiben die Referenz für den Katalog.
