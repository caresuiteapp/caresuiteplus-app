# Monatsnachweise: gespeicherte Quellen und Korrekturkette

Stand: 23.10.2026. Dieser Baustein implementiert den serverseitigen Speichervertrag
und dessen Web-Repository. Er ist lokal gegen PostgreSQL/PGlite geprüft, **noch
nicht in einer verbundenen Datenbank aktiviert und noch kein bedienbarer
Monatsnachweis mit Unterschrift oder XML-Ausgabe**. Die ITSG-Fälle bleiben offen.

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

## Bestätigung und Vertrauensgrenze

Die private Tabelle `care_security.gkv_monthly_confirmation_receipts` nimmt
Belege eines zukünftigen, gesondert geprüften Originaldatei-Verifizierers auf.
Sie bindet Nachweis, Bearbeitungsstand, Inhalts-Hash, Erfassungskennung,
verantwortliche Sitzung, Unterzeichnerrolle und gegebenenfalls Vollmachtreferenz
an unveränderliche Original- und Unterschriftsobjekte samt Version und SHA-256.
Die Prüfung lehnt fremde Pfade, alte Erfassungen, abgelaufene Belege,
wiederverwendete Belege und identische bereits verwendete Unterschriftsbytes ab.

**Dieser Verifizierer ist noch nicht implementiert oder berechtigt.** Es gibt
keinen öffentlichen Erzeuger und keine Freigabe für `service_role`. Ohne einen
solchen privaten Beleg kann `confirm` nicht erfolgreich sein. In lokalen Tests
legt allein der Fixture-Administrator synthetische Belege an; das ist kein
Nachweis einer tatsächlichen Unterschrift, Vertreterprüfung, PDF-Komposition
oder Speicherung von Originalbytes. Bestehende Einsatzunterschriften werden
nicht als Monatsbestätigung hochgestuft.

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

## Ausgeführte lokale Prüfung

```bash
npm run verify:gkv:monthly-proofs
```

19 PostgreSQL-Testmeldungen bestanden (18 fachliche Unterfälle und ein
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

## Nächste Umsetzung

1. Den Speichervertrag mit der Web-/Desktop-Ansicht für Monatsauswahl,
   Leistungsart, Vergleich der Fassungen und protokollierte Korrektur verbinden.
2. Originalansicht, frische Unterschrift pro Leistungsart, Vertreterberechtigung
   und Druck-/Scan-Pfad bauen. Originaldateien unveränderlich speichern,
   tatsächlich zurücklesen und ihre Bytes prüfen, bevor ein Beleg entsteht.
3. Verantwortliche Pflegefachpersonen/Vertretungen administrativ verwalten und
   deren Entzug gegen laufende Bestätigungen prüfen.
4. Gemischte Leistungsarten innerhalb eines Einsatzes fachlich aufteilen,
   gemeinsame Leistungen und Beschäftigtennummern bis ins XML verfolgen.
5. Fach-XML, XSD- und komponentenbezogene CMS-Prüfung sowie die gebundene
   Übergabe der aktuellen finalen Fassung an die Abrechnung ergänzen.
6. Danach die ITSG-Fälle am tatsächlichen Ablauf mit persönlichen Testkonten
   und breiter/schmaler Darstellung ausführen. Für diesen Speicherbaustein
   wurde keine neue Oberfläche erstellt oder als visuell geprüft behauptet.
