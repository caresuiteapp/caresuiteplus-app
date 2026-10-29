# Monatsnachweise: Webansicht, gespeicherte Quellen und Korrekturkette

Stand: 29.10.2026. Dieser Baustein verbindet den serverseitigen Speichervertrag
mit der Web-/Desktop-Ansicht „Monatsnachweise“. **Die Datenbankentwürfe sind noch
nicht aktiviert; echte Betriebsnachweise und die XML-Ausgabe fehlen.**
Speichervertrag, Leseabfragen und React-Bedienabläufe sind lokal geprüft.
Visuelle Abnahme, echte Auth-/Storage-Prüfung und ITSG-Fälle bleiben offen.

Grundlage sind die Abschnitte 2, 3.2–3.11 und 4.2 des
[ITSG-Prüfkatalogs, Version 1.0, gültig ab 01.05.2026](https://www.gkv-datenaustausch.de/media/dokumente/leistungserbringer_1/pflege/technische_anlagen_aktuell_2/TA1_ANH4_ANL1_20250707_oA.pdf).
Die exakte Quelldatei und ihr SHA-256 stehen im
[Quellenregister](approval/source-lock.json). Die dort genannten Vorgaben zur
Bindung an Pflegekraft und Klient, zur getrennten Bestätigung je Leistungsart
sowie zur Korrektur endgültiger Fassungen bestimmen den Speicherablauf.

## Implementierter Vertrag

Eine Serie gehört eindeutig zu Mandant, Klient, Kalendermonat und Leistungsart.
Eine zweite aktive Fassung derselben Serie wird durch einen eindeutigen
Datenbankindex verhindert. `create` übernimmt ausschließlich bestehende,
freigegebene kanonische Leistungsdatensätze. Die ursprüngliche Pflegekraft,
Klientenzuordnung, Zeiten, Leistungsbeschreibung und Aufgaben kommen aus
serverseitig gelesenen Datensätzen und Originalnachweisen. Der vorhandene
`office_invoice_assert_source` prüft die Quellkette; ein vom Browser gelieferter
Hash, Mitarbeitername oder Bestätigungsschalter ersetzt diese Prüfung nicht.
Der Import verwendet derzeit den vorhandenen Abrechnungsprüfer einschließlich
bestätigter abrechenbarer Dauer und Beträge. Die unabhängige tägliche
Leistungserfassung vor dieser Freigabe ist damit noch nicht umgesetzt.

Die erste Fassung ist `open`. Die übernommene Leistungsart ist eine ausdrückliche
Zuordnung durch die verantwortliche Person, keine automatische Ableitung aus
Assist- oder Tarifdaten. Bis eine fachlich geprüfte Aufteilung auf Einzelaufgaben
vorliegt, wird ein kompletter kanonischer Leistungsdatensatz nur einer Serie
zugeordnet. Mehrere Pflegekräfte behalten getrennte Quellidentitäten. Das
ersetzt noch keine Darstellung einer gemeinsamen GKV-Einzelleistung.

`replace_sources` liest die ausgewählten Quellen erneut. Jede Änderung verlangt
Versionsabgleich und Begründung; vorherige und neue vollständige Fassung werden
im Ereignisjournal abgelegt. Die Originalleistungen selbst werden nicht geändert.

| Auftrag | Voraussetzung | Gespeichertes Ergebnis |
| --- | --- | --- |
| `create` | Eindeutige Serie und geprüfte Quellen | Offene Fassung, Version 1 |
| `replace_sources` | Aktuelle offene Fassung, Begründung | Neuer Bearbeitungsstand mit vorheriger und neuer Quelle im Journal |
| `confirm` | Aktuelle offene Fassung und privater Originalprüfbeleg | Endgültige Fassung mit gebundener Bestätigung |
| `finalize_missing` | Aktuelle offene Fassung und dokumentierte Ausnahme | Endgültige Fassung mit ausdrücklich begründetem Fehlen der Unterschrift |
| `correct` | Aktuelle endgültige Fassung, neue Kennung und Begründung | Vorgänger sofort ungültig; neue offene Version mit kopierten Daten und leerer Bestätigung |

Eine erwartete spätere Portalunterschrift ist kein Ausnahmebeleg und wird nicht
übernommen. Vor einem Abschluss werden Quellen und Originalhash erneut geprüft.
Ein Abschluss sperrt Änderungen. Korrektur, Entwertung, neue Version und
Journal werden gemeinsam gespeichert oder gemeinsam zurückgerollt. Die alte
Bestätigung bleibt am archivierten Vorgänger. Wiederholte Aufträge verwenden
unveränderte Auftragskennungen; die Antwort liest den heutigen gespeicherten
Status, damit eine früher endgültige Antwort nach einer Korrektur nicht wieder
als gültig erscheint.

## Webansicht und Leseabfragen

Der Bereich „Monatsnachweise“ ist in die Pflegekassen-Abrechnung integriert.
Monat und Namensfilter laden Klienten mit freigegebenen Leistungen oder bereits
bestehenden Serien. Die Auswahl einer Leistungsart lädt deren aktuelle Fassung,
kanonische Quellen, frühere Fassungen und das Bearbeitungsprotokoll.

- Quellen zeigen Datum, zugeordnete Pflegekraft, Dauer und Beschreibung. Eine
  bereits anderweitig zugeordnete Quelle ist gesperrt. Bereits gespeicherte
  Quellen außerhalb der geladenen Seite bleiben sichtbar und können aus einer
  offenen Fassung entfernt werden. Beim Speichern werden alle ausgewählten
  Quellen erneut auf dem Server gelesen und geprüft.
- Endgültige Fassungen bieten ausschließlich den begründeten Korrekturweg. Vor
  der Entwertung ist eine ausdrückliche Bestätigung erforderlich. Eine Ausnahme
  ohne Unterschrift ist separat beschriftet und bei ungeklärter Quellenauswahl
  gesperrt. Sie ersetzt keine noch einzuholende Portalunterschrift.
- Frühere Fassungen bleiben vollständig lesbar. Der Vergleich zeigt hinzugefügte
  und entfernte Quellen sowie geänderte Beschreibungen, Zeiten, Pflegekräfte,
  Aufgaben und Originalbelege. Das Protokoll zeigt die neuesten 30 Ereignisse
  mit Zeitpunkt und Begründung; vollständige Vorher-/Nachherstände einzelner
  offener Bearbeitungsrevisionen liegen weiterhin im Datenbankjournal.
- Klienten und Quellen werden mit stabilen UUID-Seitenankern zu je 50 Einträgen
  gelesen, Fassungen zu je 20. Der Leservertrag prüft Mandant, Klient, Monat,
  Leistungsart und Antwortreihenfolge. Nur aktuelle Serien erscheinen in der
  Übersicht; ungültige Vorgänger bleiben über die Historie erreichbar.
- Eine fehlende fachliche Beauftragung führt zur reinen Ansicht. Rollen-,
  Benutzer- und Mandantenwechsel setzen den Arbeitsbereich zurück. Verspätete
  Antworten dürfen nicht in einen neuen Arbeitsbereich gelangen.

Unklare Speicherantworten behalten den unveränderten Auftrag samt Kennung im
aktuellen Arbeitsbereich. Die Aktion „Speicherung klären“ ist rein lesend und
wartet auf einen bereits laufenden Auftrag mit dieser Kennung. Erst nach einem
`not_found` kann genau dieser Auftrag unverändert erneut gesendet werden.
Ein noch nicht eingetroffener erster Request kann damit keine zweite Mutation
mit neuer Kennung erzeugen. Ein inzwischen entwerteter Vorgänger bleibt auch
in der Wiederherstellungsantwort ungültig. Während einer unklaren Speicherung
sind Auswahl und Navigation gesperrt. Die Kennung wird nicht im Browser
persistiert; nach einem erzwungenen Neuladen muss der gespeicherte Stand erneut
abgerufen werden. Das ist kein sitzungsübergreifendes Auftragsjournal im Browser.

[Die Leseerweiterung](sql/monthly-workspace-draft.sql) benötigt zuerst den
Speicherentwurf. Beide sind Review-SQL und wurden nicht als Zielmigration
angewendet. Quellenlisten sind Kandidaten, keine erfolgreiche Originalprüfung.
Die Statusabfrage ist auf den ursprünglichen angemeldeten Akteur beschränkt;
private Request-, Beauftragungs- und Bestätigungstabellen bleiben unlesbar.

## Bestätigung und Vertrauensgrenze

Die private Tabelle `care_security.gkv_monthly_confirmation_receipts` nimmt
Belege des gesonderten Originaldatei-Verifizierers auf.
Sie bindet Nachweis, Bearbeitungsstand, Inhalts-Hash, Erfassungskennung,
verantwortliche Sitzung, Unterzeichnerrolle und gegebenenfalls Vollmachtreferenz
an unveränderliche Original- und Unterschriftsobjekte samt Version und SHA-256.
Die Prüfung lehnt fremde Pfade, alte Erfassungen, abgelaufene Belege,
wiederverwendete Belege und identische bereits verwendete Unterschriftsbytes ab.

Der [private Dienstkern](monthly-original-verifier.md) ist jetzt implementiert:
serverseitig erzeugte PDF, verschlüsselte dauerhafte Originalablage, einmalige
PNG-Erfassung, Zurücklesen, Bildfingerabdruck gegen Wiederverwendung und erneute
SQL-Prüfung vor der Belegerteilung. Sein integrierter Test erzeugt Belege aus
echten synthetischen Datei-Bytes und verbraucht sie über `confirm`. Die ältere
SQL-Vertragssuite verwendet weiterhin ausdrücklich direkt angelegte Fixtures.

**Die Host-/App-Anbindung ist implementiert, ihre Zielaktivierung steht aus.**
Der zusätzliche Worker-Wrapper verlangt einen Host-MAC und eine aktive persönliche
Anmeldung. Der private Erzeuger bleibt unzugänglich; `service_role` erhält keine Freigabe.
Die private Schnittstelle unterstützt Patientenbestätigungen und die
[geprüfte Vertreteroption](monthly-representatives.md). Der begrenzte [Papierweg](monthly-paper.md) ergänzt vollständige Scans und
persönliche Seitenprüfung. Bestehende Einsatzunterschriften
werden nicht als Monatsbestätigung hochgestuft. Die neue Original-PDF ist die
unveränderte Ansicht vor der Unterschrift, keine zusammengesetzte signierte PDF.

Ein endgültiger Datensatz ist außerdem kein XSD-geprüfter, elektronisch
signierter XML-Leistungsnachweis und kein Versandauftrag. Es gibt hier weder
Exportfreigabe noch eine neue Verbindung zum DTA-/KIM-Echtversand.

## Berechtigungen und Freigabeweg

- Leserechte übernehmen den vorhandenen GKV-Mandanten-/Office-Abgleich.
- Schreibrecht verlangt zusätzlich eine aktive, zeitlich begrenzte Zuordnung
  als verantwortliche Pflegefachperson oder Vertretung in der privaten Tabelle
  `gkv_monthly_responsibilities`. Eine Abrechnungsberechtigung genügt nicht.
- Die Zuordnung wird noch nicht über eine Oberfläche verwaltet. Bei der späteren
  Bereitstellung muss eine Administration die fachliche Beauftragung prüfen und
  mit Begründung und verantwortlichem Akteur eintragen. Es gibt keine automatische
  Zuweisung an alle Administratoren oder Abrechnungskonten.
- Öffentliche Tabellen erlauben nur Lesen unter RLS. Mutationen laufen durch
  einen öffentlichen `SECURITY INVOKER`-Wrapper und eine private, erneut prüfende
  Funktion mit festem Suchpfad. Direkte Schreibrechte, private Tabellen und
  interne Hilfsfunktionen sind für öffentliche/angemeldete Rollen gesperrt.

Der SQL-Stand liegt als
[Review-Entwurf](sql/monthly-proofs-draft.sql) vor. Die vorhandene Umgebung hatte
keine Supabase-CLI; es wurde keine installiert und keine Migrationsnummer
erfunden. Vor Freigabe sind das tatsächliche Zielkatalogschema, die kanonischen
Quellprüfer, Rechte und Advisor-Befunde abzugleichen. Erst dann mit der bestehenden
CLI eine Migration erzeugen und über den regulären Freigabeweg einspielen.
Die neue Web-Repository-Anbindung meldet eine fehlende Erweiterung verständlich.

## Prüfstand

```bash
npm run verify:gkv:monthly-proofs
```

Für den Speicherstand `2c2b4fb` bestanden 19 PostgreSQL-Testmeldungen (18 fachliche Unterfälle und ein
zusammenfassender Hauptfall), dazu acht Vertrags-/RPC-Tests. Verwendet wurde
ausschließlich eine bereits vorhandene PGlite-Installation; keine neue
Software, kein Docker und keine produktiven Testdaten.

Die SQL-Tests führen den vollständigen Entwurf aus und prüfen echte Constraints,
RLS, Funktionsrechte, Transaktionen, eindeutige Quellenzuordnung, Korrektur und
Rollback. Der Web-RPC-Vertrag wird auch gegen diese SQL-Funktionen ausgeführt.
29 bestehende Quellen-, Prüfexport- und Katalogtests bestanden zusätzlich.
Die vollständige TypeScript-Prüfung (`tsc --noEmit --pretty false`, 8192 MiB
Heap) bestand mit den bereits vorhandenen Projektabhängigkeiten.
Der vorhandene Office-Quellverifizierer und die Sitzungs-/Berechtigungsermittlung
sind ausdrücklich Vertragsdoubles. PGlite serialisiert Anfragen: konkurrierende
Kennungen und Versionskonflikte sind geprüft, echte Mehrverbindungs-Rennen im
Ziel-PostgreSQL noch nicht. Das ersetzt keine Supabase-Auth-/Storage-Abnahme.

Für die neue Webanbindung bestehen lokal 27 Vertrags-/Wiederholungstests und
29 Quellen-/Prüfexport-/Katalogregressionen. Die SQL-Suite wurde um fünf Fälle
für Übersicht, Rollen, Quellenauswahl, Auftragsklärung und Seitenanker erweitert.
Zehn React-Prüfabläufe testen die tatsächliche Komponente und Office-Navigation
mit synthetischen API-/Auth-Grenzen, einschließlich StrictMode, Doppelaktionen,
Verbindungsabbruch, Korrektur, Leserechten und Mandantenwechsel.

Der aktuelle Lauf am 29.10.2026 besteht mit 27 Vertragsfällen, 24 bisherigen
SQL-Testmeldungen, 20 Originaldatei-Testmeldungen, 15 Host-Testmeldungen und
15 React-Bedienabläufen. Die folgenden Angaben dokumentieren den vorherigen
Speicher-/Webstand mit zehn React-Abläufen und noch ohne Hostverbindung.
Der letzte SQL-Unterfall benötigte eine Korrektur seiner Testdatenvorbereitung:
derselbe UUID-Parameter wird vor der Umwandlung in einen JSON-Textwert ausdrücklich
als UUID typisiert. Dadurch entfällt PostgreSQL `42P08`; die Seitennavigationsprüfung
bleibt vollständig erhalten. Verwendet wurden vorhandene Projektabhängigkeiten
in den Lockfile-Versionen (PGlite 0.3.15, React/React DOM 19.2.3, happy-dom 20.14.0
und esbuild 0.28.2). Keine Paketdownloads, Versionsänderungen oder neuen Testdienste.
Die Prüfung bleibt Teil des bestehenden Webbuilds. Für `46536b6` besteht auch
`npm run build:web:production` vollständig: App-Typcheck, alle 14 weiteren
Release-Gates (3.795 Vitest-Fälle sowie zusätzliche SQL-/Validatorprüfungen),
Expo-Webexport und abschließende Dateiaudits. Der Vercel-Preview-Build im Projekt
`repository` ist für denselben Commit mit `READY` bestätigt; Metadaten und
Abschlussprotokoll stehen im [Prüfprotokoll](verification.md). Das ist keine
Produktionsfreigabe und kein pauschaler Nachweis anderer Projektumgebungen.
DOM-Prüfungen ersetzen weder die echte Supabase-Anmeldung noch eine visuelle
Abnahme. Breite/schmale Darstellung, vergrößerte Schrift und Tastaturfokus im
gerenderten Browser sind für diese Ansicht noch nicht belegt.

### Bindung der Speicherantwort und Auftragsklärung

Eine Nachweis-ID allein bestätigt keinen erfolgreich zugeordneten Auftrag.
Sofortantworten, Wiederholungen und rein lesende Auftragsklärung prüfen gemeinsam
Klient, Monat und Leistungsart beim Anlegen, Vorgänger bei Korrekturen sowie
mindestens die durch den Auftrag entstandene Revision. Ein frischer Quellenabgleich
muss genau die ausgewählten Quellkennungen zurückgeben; deren Reihenfolge darf
abweichen. Spätere legitime Quellenänderungen bleiben bei der Auftragsklärung
zulässig. Die endgültige Bestätigungsart und der Inhaltshash bleiben dagegen
unveränderlich; eine Unterschriftsbestätigung muss außerdem den angeforderten
privaten Prüfbeleg zurückgeben. Ein Ausnahmeabschluss ersetzt keine Unterschrift.

Bei widersprüchlichen Antworten bleibt der ursprüngliche Auftrag samt Kennung
offen. Es gibt keinen automatischen Neuversuch und keine vorzeitige Entsperrung.
Sechs neue Negativprüfungen reproduzierten die bisherige Annahmelücke vor der
Korrektur; zusammen mit drei weiteren Positiv-/Wiederherstellungsprüfungen bestehen
jetzt alle 27 Vertragsfälle. Auch nachträglich entwertete Originale und später
bearbeitete offene Fassungen können weiterhin korrekt wiedergefunden werden.

## Persönliche Originalanzeige und Unterschrift

Die [Host-/App-Anbindung](monthly-host.md) ist implementiert: Original-PDF öffnen,
ausdrücklich prüfen, im vorhandenen Web-Zeichenfeld neu unterschreiben und mit
einem getrennten Auftrag endgültig bestätigen. Der Browser prüft die PDF-Bytes;
Gateway, mTLS-Host und SQL-Brücke prüfen persönliche Anmeldung, Sitzung und
Hostfreigabe. Verlorene Erfassungs- und Abschlussantworten werden lesend geklärt.
Archivoriginale bleiben nach Korrekturen mit dem aktuellen Status erreichbar.
Die SQL-Entwürfe, Schlüssel und Hostkonfiguration sind noch nicht aktiviert.

## Nächste Umsetzung

1. Zielrechte, fünf SQL-Entwürfe, Hostschlüssel und Zertifikate vor einer
   gesonderten Aktivierung prüfen. Tatsächliche Anmeldung, Sitzungswiderruf und
   Parallelität gegen die Zielumgebung nachweisen.
2. Den implementierten PDF-/Unterschriftsablauf breit/schmal mit echten
   Zeichenereignissen, Schriftvergrößerung und Tastaturfokus abnehmen.
   Vertreterprüfung mit tatsächlichen Unterlagen vorführen; Druck-/Scan-Pfad mit echten Geräten und Personen abnehmen.
3. Verantwortliche Pflegefachpersonen/Vertretungen administrativ verwalten und
   deren Entzug gegen laufende Bestätigungen prüfen.
4. Gemischte Leistungsarten innerhalb eines Einsatzes fachlich aufteilen,
   gemeinsame Leistungen und Beschäftigtennummern bis ins XML verfolgen.
5. Fach-XML, XSD- und komponentenbezogene CMS-Prüfung sowie die gebundene
   Übergabe der aktuellen finalen Fassung an die Abrechnung ergänzen.
6. Danach die ITSG-Fälle am tatsächlichen Ablauf mit persönlichen Testkonten
   und breiter/schmaler Darstellung ausführen.
