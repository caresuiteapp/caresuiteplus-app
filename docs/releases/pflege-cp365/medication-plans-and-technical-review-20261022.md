# Medikationspläne und technische Prüfung, 22.10.2026

## Umgesetzter Ablauf

Der vorbereitete Web-Arbeitsplatz verbindet den strukturierten Verordnungsentwurf mit einer gesonderten technischen Prüfung. Die erfassende Person fordert die Prüfung unter ihrer aktuellen Sitzung an. Eine andere Person mit einem anderen authentifizierten Konto kann den unveränderten Auftrag prüfen, ablehnen oder eine noch ungenutzte Berechtigung widerrufen. Die erfassende Person kann anschließend die strukturierten Angaben ausdrücklich übernehmen. Die unabhängige Bestätigung liest den vollständigen ursprünglichen Vorgang zurück. Dieser Ablauf bestätigt keine ärztliche Verordnung oder medizinische Qualifikation.

Die Prüfanfrage bindet ursprünglichen Entwurf, vollständigen nativen Ausgangsstand, Quelle, Archiv und Erfassungssitzung. Eine technische Übernahme verändert weder Status noch Risikokennzeichnungen oder andere native Angaben. Veraltete Originale und bestehende, noch nicht abgestimmte native Gabepläne blockieren die Übernahme. Eine exakte Wiederholung liefert den ursprünglichen Beleg; sie führt keine zweite Änderung aus.

Explizite Tagespläne enthalten lokale Gültigkeitstage und einzeln erfasste, aufsteigende Uhrzeiten mit Dosis, Einheit und Applikationsweg. Jeder Eintrag muss zur aktuellen strukturierten Verordnung und ihrer bestätigten technischen Übernahme gehören. Eine unabhängige technische Planprüfung verwendet die tatsächliche aktuelle eigene Rolle und Sitzung. Überschneidende bestätigte Pläne werden abgewiesen. Eine gesondert geprüfte Beendigung ab einem zukünftigen lokalen Tag bewahrt alle früheren Planstände und erlaubt eine anschließende neue Fassung.

Kontext, Plan- und Prüfseiten tragen einen Fingerabdruck über den vollständigen Bestand einschließlich älterer Seiten, aktueller Berechtigungs- und Sitzungszustände sowie Übertragungs- und Archivnachweis. Die Leser prüfen diesen Bestand während und nach dem Laden. Änderungen an einer alten Plan- oder Prüfposition können damit nicht hinter einer unveränderten ersten Seite verschwinden.

## Bedarfsprüfung und Schreibgrenze

Die Prüfung verwendet tatsächliche native Gaben, genaue Zeitpunkte und dezimale Mengen. Sie berücksichtigt Vorgänger und Nachfolger, geschlossene Bezugsfenster und spätere Anker bei rückwirkend erfassten Zeitpunkten. Zeitabstände werden zusätzlich als exakte Mikrosekundenzeichenfolgen übertragen und gegen die angezeigten Minuten geprüft. Unvollständige oder widersprüchliche Altbestände dürfen keine erfolgreiche Mengen- oder Abstandsberechnung vortäuschen.

Diese Prüfung erlaubt keine Gabe. Der neue Ausführungsendpunkt weist Schreibversuche immer mit 42501 ab. Gemeinsame Altschreibwege und klinische Ausführungsvoraussetzungen sind noch nicht vollständig geschlossen und abgenommen. Fehlende native BtM-/Hochrisikofelder bleiben unbekannt; es wurden keine Felder mit klinischen Standardwerten nachgetragen. Der Web-Arbeitsplatz sperrt tatsächliche Bedarfsgaben einschließlich verspäteter Gaben vor dem alten Schreibweg. Nichtgaben und bestehende Regelpfade behalten ihre bisherigen Prüfungen. Android-Oberflächen und gemeinsame native Dienste wurden nicht verändert.

## Navigation und Wiederaufnahme

Die ursprünglichen Formulare, Verordnungsentwurf, Tagesplan und technische Prüfung besitzen gegenseitig ausschließende, synchrone Editorreservierungen. Während einer ausstehenden Elternnavigation können keine konkurrierenden Änderungen oder Schreibanfragen beginnen. Der gemeinsame Web-Navigationsschutz prüft einen erfassten Eigentümer- und Phasennachweis nach der Rückfrage und unmittelbar vor dem tatsächlichen Routenaustritt erneut.

Für technische Prüfaufträge und Übernahmen gibt es ein dauerhaftes Browserjournal mit dem minimalen eigenen Bezug und dem exakten Auftrag. Es enthält keine vollständigen nativen, Quellen- oder Archiv-Snapshots. Vor jedem Versand muss die Speicherung zurückgelesen werden. Nach einem Neustart wird zuerst der ursprüngliche Beleg bestätigt; eine Wiederholung behält die ursprüngliche Anfrage-ID. Konkurrierende Anfragen in mehreren Tabs desselben Browserprofils werden für denselben Ursprung über navigator.locks abgewehrt. Unklare, beschädigte oder derzeit unzugängliche Journale werden nicht stillschweigend gelöscht. Diese Wiederaufnahmeeigenschaft gilt nicht pauschal für alle übrigen Pflegeformulare.

## Weitere funktionale Korrekturen

Sieben Web-Repositories unterscheiden jetzt das authentifizierte Konto vom tatsächlich serverseitig aufgelösten aktuellen internen Profil und Mandanten. Ein anderes Profil desselben Kontos reicht nicht. Die betroffenen Bereiche sind Wundpfad, Vitalpfad, Atem-/Intensivpflege, Behandlungspflege, Medikationssicherheit, Pflegedokumentation und Grundpflege.

Die vorbereitete Web-Dokumentwiederherstellung folgt dem aktuellen gemeinsamen Persistenzvertrag: vorhandene unterschriebene Originale bleiben erhalten, neue Signatur- oder Abschlussbehauptungen benötigen den atomaren Serverabschluss, bestehende Dokumentfassungen werden mit Versionsvergleich geändert und fremde Uploads bei Namenskollision nicht überschrieben. Die automatische Wiederherstellung signierter Entwürfe erweitert diese Grenze nicht. Veraltete Extraktions-Harnesses wurden an die tatsächlichen aktuellen Auth-, Aufnahme-, Render- und Persistenzverträge angeschlossen; Produktregeln wurden dafür nicht abgeschwächt.

## Staging und Nachweise

Nur Staging shwpweerzsfkqaivmaoc wurde geändert. Die Dateien unter supabase/migrations behalten die jeweils tatsächlich angewandte Fassung; folgende enge Korrekturen ersetzen keine früheren Migrationsdateien:

- 20261022045543: technischer Prüfauftrag, Entscheidung und Bestätigung.
- 20261022051245: Tagespläne, unabhängige Prüfung, zukünftige Beendigung und gesperrte Ausführungsprüfung.
- 20261022051321: vollständiger Übertragungs- und Quellenbezug im Bestandsfingerabdruck.
- 20261022051800: exakte Mikrosekundenbelege.
- 20261022052007: unbekannte native Risikofelder ohne Spaltenannahme erhalten.
- 20261022052206: tatsächlichen Rückgabetyp des strikten Datumsparsers berücksichtigen.

Der strikte lokale Medikationsprüfer bestand mit 1.204 Node-Prüfungen und fünf Edge-Syntaxprüfungen. Die Node-Auswahl enthält auch die gemeinsamen Profil- und Sperrprüfungen. Ein separater Lauf der 330 übrigen Node-Testdateien ergab 12.107 Prüfungen, davon 12.105 bestanden und zwei fehlgeschlagen. Beide Auswahlmengen teilen sich Profil-/Sperrprüfungen; ihre Zahlen dürfen nicht als disjunkte Gesamtsumme addiert werden.

Die zwei verbliebenen Fehler betreffen einen unveränderten Vertragskonflikt im Mitarbeiterportal: vorbereitete Pflege-Tests fordern eigene Zuweisungen und Primär-/Notfallkontakte, der aktuelle gemeinsame Dienst liest Mandantenklienten, Team-Einsätze und sämtliche Kontakte. Dieser bestehende gemeinsame/native Ablauf wurde nicht aufgrund einer alten Testannahme geändert. Die Kriterien bleiben als offene Abnahme erhalten.

Drei tatsächliche Staging-Rollback-Suiten bestanden nach den Änderungen: Verordnungsentwurf/Übernahme, technischer Prüfablauf und Tagesplan/Bedarfsprüfung. Die letzte Suite prüft unter anderem unabhängige Rollen und Sitzungen, Originaländerungen, Seitenwechsel, alte Bestandsänderungen, Überschneidung, Beendigung, exakte Zeit-/Mengengrenzen, beschädigte Altbestände, Unveränderlichkeit und Rechteentzug. Ihre echten SQL-Antworten wurden zusätzlich mit den tatsächlichen Web-Domain-Prüfungen verarbeitet; das gespeicherte JSON enthält ausschließlich synthetische, vollständig zurückgerollte Testdaten.

Nach den Suiten waren Plan-, Planprüf-, Planberechtigungs-, Beendigungs-, Verordnungsprüf- und Übernahmetabellen leer. Alle 16 neuen geprüften öffentlichen Prüf-/Plan-/Ausführungsfunktionen verweigern anon, authenticated und service_role das Ausführungsrecht. Die beiden ergänzten Bereichsindizes wurden im tatsächlichen Katalog geprüft. Die Sicherheitsprüfung meldete keinen Befund für die neuen Objekte; eine fehlerfreie Gesamtprüfung des Projekts wird nicht behauptet.

Der strikte Prüfer meldet weiterhin complete=false und Exitcode 2: Projekt-Vitest, Web-TypeScript und Edge-TypeScript konnten mangels vorhandener Werkzeuge nicht laufen. Der Web-tsconfig schließt Edge aus. Reale Auth-/Storage-/Edge-HTTP-Abnahme, echte parallele SQL-Transaktionen, breiter/schmaler Browseraufbau und fachliche Prüfung bleiben offen. Der alte historische Stand von 12.598 Tests ist kein heutiger Freigabenachweis.

Pflege bleibt global gesperrt. Dieser Zwischenstand wurde nicht produktiv migriert, freigeschaltet oder deployt. Die Weiterarbeit an den übrigen Pflege-Schnittstellen wird getrennt dokumentiert; die Abnahmematrix beschreibt weiterhin die Voraussetzungen für das vollständige Modul.
