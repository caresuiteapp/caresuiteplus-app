# Pflegedienst Ambulant – Umsetzung und Freigabestatus

Stand: 02.10.2026. Grundlage: main 543e51693ec637aa4ca9e017de06078ba7fe6e84.

## Ergebnis

Der bestehende Pflegebereich erhält einen zusammenhängenden ambulanten Kernablauf:

1. Aktive Pflegekraft und aktive Pflegefälle des eigenen Mandanten auswählen.
2. Strukturierte Einsätze mit Leistung und gültigen, geordneten Zeitfenstern planen.
3. Tour atomar speichern und freigeben. Überschneidungen derselben Pflegekraft werden beim Freigeben und Starten serverseitig geprüft.
4. Ankunft und Versorgung je Einsatz bestätigen. Nur eine Versorgung derselben Pflegekraft kann gleichzeitig laufen.
5. Durchführung dokumentieren oder einen Ausfall begründen. Der Abschluss erzeugt einen Eintrag in der bestehenden Pflegedokumentation.
6. Verknüpften Leistungsnachweis aus den tatsächlichen Zeiten und der gespeicherten Dokumentation erzeugen. Wiederholungen liefern denselben Nachweis.
7. Unterschrift über die vorhandene Vollbild-Erfassung aufnehmen. Bild, Name, Zeitpunkt, erfassende Person und Nachweis werden gemeinsam gespeichert.
8. Nachweis durch eine zweite Person prüfen; Freigabe erzeugt über die vorhandene Abrechnungskette den Abrechnungsfall.
9. Tour erst nach dokumentiertem Abschluss bzw. begründetem Ausfall sämtlicher Einsätze abschließen.

Touränderungen erhalten einen serverseitigen Verlauf mit Person und Zeitpunkt. Optimistische Statusprüfung schützt vor veralteten Aktionen. Ein Anfragebezeichner verhindert doppelte Touren bei Wiederholung derselben Speicheranfrage. Datenabfragen paginieren, damit das API-Zeilenlimit keine Stopps abschneidet.

Die Navigation benennt den Bereich als „Pflegedienst Ambulant“. Die Startseite zählt Toureneinsätze, laufende Versorgungen, offene Pflegedokumentationen, Berichte, Wundfälle, Übergaben, Assessments und auffällige Vitalmessungen aus vorhandenen Daten. Medikations- und Vitalwertfälligkeiten bleiben ausdrücklich „Nicht ermittelt“, solange keine verlässliche Berechnung dieser Zeitpläne eingebunden ist. Fehlende Berechtigungen werden nicht als bestätigte Nullzahl dargestellt.

## Datenbankänderung

`supabase/patches/ambulatory_care_tour_workflow.sql` enthält den geprüften SQL-Releasepatch, noch keine registrierte Migration. Er wurde zweimal in einer isolierten PostgreSQL-Umgebung angewendet. Vor einer Veröffentlichung muss er über die bestehende Migrationspipeline registriert und in Staging angewendet werden. Es wurde keine neue Supabase-CLI oder Testinfrastruktur eingerichtet.

Der Patch ergänzt Touren, Stopps, Änderungsverlauf und Unterschriftennachweise. Direkte Schreibrechte auf Touren, Stopps und neue Nachweistabellen werden entzogen. Öffentliche RPC-Einstiegspunkte verwenden SECURITY INVOKER; privilegierte Implementierungen liegen im nicht exponierten Schema `care_private` und prüfen Authentifizierung, Mandant und Berechtigungen. `care_private` darf nicht in die exponierten Data-API-Schemata aufgenommen werden.

Die vorhandene Funktion `advance_pfleger_service_proof` wird intern verschoben und durch einen validierenden öffentlichen Einstiegspunkt mit derselben Signatur ersetzt. Neue Signaturaktionen benötigen ein gespeichertes Unterschriftenbild. Eigene bzw. selbst erfasste Unterschriftennachweise dürfen nicht selbst geprüft werden. Bestehende signierte Altnachweise bleiben lesbar; für ihre ursprünglichen Signaturreferenzen wird durch diesen Patch kein nachträglicher Echtheitsnachweis behauptet.

Historische Touren ohne Klienten-/Mitarbeiterverknüpfung bleiben lesbar. Sie können nicht als neue valide Tour freigegeben werden; vor Nutzung sind sie abzusagen und mit aktiven Zuordnungen neu anzulegen. Direkte SQL-/API-Schreibintegrationen müssen vor Freigabe auf die neuen RPCs umgestellt werden.

## Verifikation

- 29 neue Prüfungen: 14 Eingabe-/Workflowprüfungen, 11 PostgreSQL-Prüfungen und 4 Prüfungen der operativen Dashboardzahlen.
- PostgreSQL prüft atomaren Rollback bei fremdem Pflegefall, Zeitüberschneidungen, Schreibrechte, Rollenprüfung, parallele/veraltete Statusanfragen, dokumentationspflichtigen Abschluss, klinischen Dokumentationseintrag, Wiederholung derselben Touranfrage, verknüpften Nachweis, Unterschriftenspeicherung, zweite prüfende Person und Entstehung eines abrechnungsfähigen Falls.
- 59 vorhandene Pflegeprüfungen wurden erfolgreich ausgeführt. Diese sind überwiegend Quelltext-/Vertragsprüfungen und ersetzen keinen Live-Nachweis.
- DOM-Bedienprüfung des tatsächlichen Tourenbildschirms mit kontrollierten Auth-/Daten-/Shell-Ersatzkomponenten: Abschluss ohne Dokumentation gesperrt, Dokumentation löst Speicheraktion aus, Toureneditor öffnet sich, Einsätze lassen sich hinzufügen/entfernen, Änderungsverlauf ist erreichbar. Keine produktiven Daten.
- ESLint für die betroffenen TS-/TSX-Dateien und `git diff --check` wurden ausgeführt.
- Projektweiter TypeScript-Check: Fehler in anderen Projektdateien verhindern einen grünen Gesamtcheck. Die betroffenen Dateien sind auf eigene Diagnosen zu prüfen. Die unveränderte Web-Unterschriftenkomponente hat beispielsweise bereits einen Typfehler für `position: 'fixed'`.
- Browserlayout noch nicht geprüft: kein Chromium/Edge/Chrome in dieser Umgebung. Das mitgelieferte Prüfskript unterstützt 1440, 390 und 320 Pixel über einen vorhandenen Browser (`LIQUID_COMMAND_BROWSER_EXECUTABLE`). Der DOM-Modus ist ausdrücklich kein visueller Nachweis.

Reproduzierbare Prüfungen:

```bash
npx vitest run src/__tests__/pflege/ambulatoryCareTourWorkflow.test.ts src/__tests__/pflege/ambulatoryCareTourDatabase.test.ts src/__tests__/pflege/ambulatoryCareDashboard.test.ts
node scripts/verify-ambulatory-care-ui.mjs --dom
node scripts/verify-ambulatory-care-ui.mjs
```

## Noch offene Produktivabnahme

Dieser Stand ist ein implementierter und isoliert geprüfter Kernablauf, keine vollständige Produktivfreigabe des gesamten ambulanten Pflegemoduls.

- SQL in Staging registrieren/anwenden; echte Rollen, Mandantenfunktionen und Bestandsdaten prüfen. Die PostgreSQL-Tests verwenden kontrollierte Auth-/Mandantenhelfer und ersetzen diese Prüfung nicht.
- Touren-, Dokumentations- und Nachweisoberflächen einschließlich Vollbild-Unterschrift in breiter und schmaler Browserdarstellung prüfen.
- Angemeldeten Gesamtweg mit freigegebenen Testfällen prüfen: Aufnahme → Pflegeplanung/SIS → Tour → Dokumentation → Unterschrift → zweite Prüfung → Abrechnungsfreigabe → Rechnungsgrundlage.
- Vitalwert- und Medikationsfälligkeiten anhand individueller Zeitpläne vollständig anbinden.
- Dokumentkorrektur, Signaturvertretung und Wiederaufnahme zurückgewiesener Nachweise fachlich abnehmen. Bereits abgeschlossene Einträge werden durch diesen Stand nicht nachträglich überschrieben.
- Offline-Erfassung, direkte Mitarbeiterportal-Zuweisung, automatische Tourenoptimierung und Kostenträgerexport sind durch diese Änderung nicht als Ende-zu-Ende-fertig belegt.
- eMP/TI-Anbindung und automatischer DTA-/Kassenversand sind externe Integrationen; ihre Verfügbarkeit wird nicht durch UI-Seiten oder erfolgreiche lokale Tests hergestellt.

Kein Merge nach main, keine Produktionsmigration und kein Deployment wurden vorgenommen.

## Erweiterter Stand dieser Lieferung

Zusätzlich implementiert: mandantengebundene Aufnahme mit Vertrags-/Kosteninformationsreferenz, Aktivierung/Pause/Beendigung; unveränderliche Tarifversionen mit Gültigkeitszeitraum und Cent-Berechnung; Aufgaben mit Zuständigkeit und Abschlussbegründung; Verordnungsfreigabe mit Genehmigungsreferenz; Dienstplanung mit Pausen, Monatsverfügbarkeit, Abwesenheit und Standardruhezeit; Versorgungsgesamtübersicht; tarifgebundene Tourennachweise; PDF-Nachweis mit Unterschrift; Rechnungsgrundlagen-Detail und CSV-Export. Die Einstellungen verlinken tatsächlich bearbeitbare Fachbereiche.

Zweiter SQL-Patch: `supabase/patches/ambulatory_care_operations.sql`, nach dem Tourenpatch anzuwenden. Beide bleiben nicht registrierte Releasepatches, wurden nicht produktiv ausgeführt. Neue Tabellen sind über RLS lesbar, Änderungen nur über validierende RPCs. Preise/Kostenträger werden serverseitig aus dem gültigen Katalog und der Aufnahme übernommen. SGB-V-Nachweise brauchen die passende genehmigte Verordnung. Freigegebene Dienste mit zugehöriger laufender Tour können nicht einfach abgesagt werden.

Prüfstand: alle 42 Pflege-Testdateien / 322 Tests erfolgreich. Darunter 62 neue Prüfungen (21 isolierte Datenbankprüfungen, 34 Domain-/Workflowprüfungen, 4 Dashboardprüfungen, 3 Exportprüfungen). Die Operations-Datenbankprüfung wendet den zweiten Patch zweimal an. DOM-Tourenbedienprüfung erfolgreich; ausdrücklich keine Layoutprüfung.

### Rechtliche Zuordnung und Grenzen

- [§ 120 SGB XI](https://www.gesetze-im-internet.de/sgb_11/__120.html): Aufnahme verlangt Vertrags- und Kosteninformationsreferenzen vor Aktivierung. Diese Referenzen sind manuelle Angaben; Dokumentinhalt und wirksame Unterzeichnung werden nicht automatisch geprüft.
- [HKP-Richtlinie des G-BA](https://www.g-ba.de/richtlinien/11/): Verordnungen und Genehmigungen werden strukturiert geführt. Keine vollständige automatische Prüfung aller Maßnahmen, Fristen und Sonderfälle.
- [§ 4 ArbZG](https://www.gesetze-im-internet.de/arbzg/__4.html), [§ 5 ArbZG](https://www.gesetze-im-internet.de/arbzg/__5.html): Standardpausen und elf Stunden zwischen freigegebenen Diensten werden geprüft. Geteilte Dienste, tarifliche Ausnahmen, Ausgleichszeiträume, mehrere Arbeitgeber und die durchschnittliche Arbeitszeit nach § 3 sind noch nicht vollständig modelliert. Keine Behauptung vollständiger Arbeitszeitkonformität.
- [§ 302 SGB V](https://www.gesetze-im-internet.de/sgb_5/__302.html): PDF und CSV sind Exporte, kein validierter elektronischer Kostenträgerdatenaustausch.
- [Neue ambulante Qualitätsprüfrichtlinien](https://www.medizinischerdienst.de/aktuelles-presse/meldungen/artikel/richtlinien-fuer-qualitaetspruefungen-in-ambulanten-pflegediensten-veroeffentlicht): bestehende Prüfindikatoren ersetzen weder die vollständige QPR ab Juli 2026 noch eine fachliche Qualitätsprüfung.

Weitere offene Punkte: direkte Mitarbeiter-/Klientenportal-Anbindung; Offlinebetrieb mit Konfliktlösung; Tarif-Sonderfälle und Kassenadapter; automatische Fälligkeiten; überprüfte Dokumentreferenzen; vollständige Datenschutz-/Aufbewahrungsabnahme. Die isolierte Datenbankprüfung ersetzt keine echte Anmeldung oder Produktionsmigration.

## Portal- und Benachrichtigungsfortsetzung

Mitarbeiterportal: eigene freigegebene Touren nach Tag anzeigen; eigene Tour starten/abschließen; Ankunft, Versorgungsbeginn, dokumentierter Abschluss und begründeter Ausfall. Abschluss schreibt einen klinischen Besuchseintrag und Verlauf atomar. Keine Freigabe, Umplanung oder Bearbeitung fremder Touren im Portal. Aufnahmestatus, Dienstdeckung und Verfügbarkeit bleiben durch die Operations-Trigger verbindlich.

Klientenportal: eigene bereitgestellte Nachweise, Zeiten, Leistung, Mitarbeitendenname, Durchführungsbericht, Betrag und Status; Unterschrift in der bestehenden Vollbild-Erfassung. Signatur, Status und Audit werden atomar gespeichert. Identische Wiederholung liefert denselben Datensatz. Eigene Signatur ist separat abrufbar, nicht Teil jedes Listenabrufs. Listen werden in Seiten von 25 Einträgen geladen. Vertretungs-/Angehörigenrechte werden nicht pauschal erteilt. Eine Verwaltungsprüfung bleibt nach der Unterschrift erforderlich.

Neue SQL-Patches: `ambulatory_care_portals.sql`, danach `ambulatory_care_notifications.sql`. Voraussetzung: bestehende Portalidentitätsmigrationen, Office-Mitteilungen und automatische Portal-Push-Pipeline. Öffentliche RPCs bleiben SECURITY INVOKER; private Helfer prüfen die serverseitige Portalidentität, Mandant und eigene Mitarbeiter-/Klientenverknüpfung. Es werden keine allgemeinen Pflegeberechtigungen an Portalrollen vergeben.

Eine Tourfreigabe erzeugt eine neutrale persönliche Mitteilung für die zugewiesene aktive Pflegekraft. Ein eingereichter Nachweis erzeugt eine neutrale Mitteilung für aktive verknüpfte Klientenportal-Zugänge. Kontodubletten und abgelaufene Zugänge werden berücksichtigt. Vorhandene Push-Outbox und Dispatcher bleiben zuständig. Die erlaubten Push-Ziele wurden um Mitarbeiterstartseite und Klientennachweise erweitert; Rollen-, Konto- und Mandantenbindung bleiben bestehen. Bei Statuswechsel werden offene alte Mitteilungen als erledigt markiert, sodass die vorhandene Sichtbarkeitsprüfung veraltete Zustellungen blockiert.

Prüfgrenze: 9 zusätzliche PostgreSQL-Portalprüfungen und 5 Benachrichtigungsprüfungen. Die Benachrichtigungsprüfung ersetzt den vorhandenen Queue-Trigger durch eine kontrollierte Testabbildung; weder Expo noch ein echtes Gerät wurden angesprochen. Der bestehende Push-Test prüft zusätzlich die neuen Ziele und verweigert Rollen-/Mandantenwechsel. DOM-Prüfung der tatsächlichen Portalpanels prüft Pflichtbericht, Signaturbezug und Schutz vor Doppelklick; Shell, Inputs, Auth und Daten sind kontrollierte Ersatzkomponenten. Keine visuelle Layoutfreigabe.

Diese Fortsetzung reduziert die frühere Portal-Lücke, ersetzt aber keine angemeldete Live-Abnahme. Weiter offen: zukünftige Pflegeeinsätze im Klientenkalender; Termin-/Überfälligkeitserinnerungen; Vertretungsrechte; Offline-Konfliktlösung; automatische Medikations-/Vitalfälligkeiten; vollständige Tarif-/Arbeitszeitsonderfälle; DTA/TI; Stagingmigration und visuelle Abnahme. Keine Veröffentlichung, Produktionsmigration oder tatsächliche Push-Zustellung ausgeführt.

Eigener PDF-Download ergänzt: Der Export-RPC liefert ausschließlich den eigenen bereitgestellten Nachweis und seine gespeicherte Signatur in einem konsistenten Lesevorgang. Interne Evidence-Payloads werden nicht ausgegeben. Der vorhandene PDF-Generator wird erst auf Abruf geladen. Fremde Nachweise und Entwürfe werden serverseitig abgewiesen.

Abschließende Prüfungen dieser Fortsetzung: Gesamtprüflauf mit 47 Dateien / 352 Tests erfolgreich, danach PDF-Erweiterung mit 9 Portal-Datenbank- und 3 Exportprüfungen erfolgreich. DOM-Portalbedienprüfung nach der PDF-Erweiterung erfolgreich. ESLint der geänderten Dateien ohne Warnungen. TypeScript-Gesamtcheck bleibt wegen vorhandener Projektfehler nicht grün; in den geänderten Portaldateien keine neue Diagnose.

Zusätzliche Push-Abgrenzung: Pflege-Nachweismitteilungen werden nicht nur an die Auth-ID, sondern an die passende Klientenidentität im aktiven Klientenportal gebunden. Bei mehreren Konten derselben Auth-ID dürfen andere Klienten- oder Mitarbeiterkonten diese Mitteilung nicht erhalten. Die bestehende `portal_push_event_visible`-Funktion wurde dafür gezielt um die Care-Metadatenbedingung ergänzt. Die fünfte Benachrichtigungsprüfung führt den tatsächlichen Notice-Zweig dieser Funktion mit kontrollierter Kontogültigkeit aus. Legacy-Pusharten bleiben erhalten.
