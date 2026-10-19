# Beratungsarbeitsplatz – erster Implementierungsstand

Stand: 19.10.2026. Der gemeinsame interne Web-Ablauf ist implementiert und mit isolierten Daten geprüft. Dies ist noch keine Produktionsfreigabe des gesamten Beratungskonzepts.

## Enthalten

- Verwaltungsarbeitsplatz `/beratung/arbeitsplatz` und Mitarbeiterportal `/portal/employee/beratung`, einschließlich direkter Links auf Fall und Besuch.
- Eine persistierte Fallakte mit getrennten Besuchen für § 37 Abs. 3 und häusliche Schulungen nach § 45 SGB XI. Klienten und Mitarbeitende stammen aus den vorhandenen Stammdaten.
- Fallanlage, Folgebesuche, Terminplanung, persönliche Zuweisung, Überschneidungsprüfung innerhalb des neuen Beratungsarbeitsplatzes und Freigabe der Qualifikation je Leistungsart.
- Übergabe mit Lesebestätigung, tatsächlicher Beginn und Ende aus der Serverzeit, anschließend weiter bearbeitbare Dokumentation.
- Teilnehmende, beide Perspektiven, Pflegesituation, Belastung, Beratungsthemen, Sicherstellung, Handlungsbedarf und veranlasste Hilfe. § 45 ergänzt Lernziele, Anleitung, praktische Durchführung, Lernergebnis und Materialien.
- Empfehlungen mit Zuständigkeit, Termin und Ergebnis, Wiedervorlage, Entscheidung zur Weitergabe von Erkenntnissen. Eine Ablehnung verhindert die interne Besuchsbestätigung nicht.
- Zwei personenbezogene elektronische Bestätigungen, Einreichung, gezielte Rückgabe nach Abschnitt, erneute Unterschriften auf die korrigierte Fassung, fachliche Freigabe durch eine andere berechtigte Person.
- Versionierte, für API-Nutzer unveränderbare Dokumentationsfassungen mit SHA-256-Prüfsumme; interne Ansicht und Browser-Druck. Das ist kein kassenspezifischer Nachweis und keine qualifizierte elektronische Signatur.
- Ereignisverlauf, aktenbezogene Nachrichten, Absage und Nichtantreffen mit Begründung, Such- und Statusfilter.
- Serverbestätigungen, Frist für ausbleibende RPC-Antworten, Schutz vor doppeltem Absenden, idempotente Wiederholungen, konkurrierende Änderungen mit Feldabgleich. Der zu bestätigende Inhalt und die Versionsnummer werden beim Öffnen der Unterschrift festgehalten.
- Ungespeicherte Formulare bleiben bei internen Routenwechseln im Speicher derselben Identität erhalten. Kein Health-JSON in LocalStorage/SessionStorage. Neuladen/Schließen warnt bei offenen Änderungen; nach Neuladen ist nur der gespeicherte Serverstand verfügbar. Speicherentwürfe laufen nach einer Stunde ab und werden bei Identitätswechsel oder Abmeldung gelöscht.
- ORBIT-Farben, transparente Flächen, angepasste Formulare für schmale Inhaltsbereiche, Schriftvergrößerung, Tastaturfokus, Dialoge mit Fokusbindung und reduzierte Bewegung.

## Rechte und Datengrenzen

Neue Tabellen verwenden RLS und gewähren `authenticated`/`anon` keine direkten Tabellenrechte. Zwei öffentliche SECURITY-INVOKER-RPCs rufen private Implementierungen mit überprüfter Identität, Mandant, Modulfreigabe und Berechtigung auf.

Die Verwaltung benötigt `beratung.cases.view` und `office.clients.view_sensitive`. Planung, Prüfung und Qualifikationsverwaltung sind getrennte Rechte. Vorhandene Rollenlisten, individuelle Denies und Datenbeschränkungen bleiben maßgeblich. Nicht zuordenbare eingeschränkte Unternehmens-/Beratungsbereiche werden abgewiesen; eine feinere fallbezogene Scope-Zuordnung ist noch offen.

Im Mitarbeiterportal werden nur aktive, authentifizierte Portalkonten mit aktiver Personalzuordnung akzeptiert. Zugriff besteht ausschließlich auf persönlich zugewiesene Besuche. Durchführung erfordert außerdem eine gültige Freigabe der jeweiligen Leistungsart. Die Portalansicht erhält keine allgemeine Klienten- oder Mitarbeiterliste. Manipulierbare `user_metadata` begründen keine Berechtigung.

Bestehende Beratungs- und Assist-Tabellen werden nicht umgeschrieben. Die bisherigen Beratungsseiten bleiben von dieser Freigabe ausgenommen. Neue native Routen sind lediglich erforderliche Fallback-Weiterleitungen; Android-Funktionen und die geschützte Assist-Durchführung werden nicht erweitert.

## Nachweis der Prüfung

`npm run verify:consultation:release` ist Bestandteil von `build:web:production` und führt aus:

1. PostgreSQL/PGlite: beide Leistungsarten, Mandantentrennung, zugewiesene Personen, aktive Konten, Qualifikationen, Überschneidungen, negative Einwilligung, Pflichtfelder, Versionskonflikte, Request-Wiederholung, unveränderbare alte Fassungen, Rückgabe, Freigabe, Modulabschaltung, individuelle Denies und beschränkte Datenbereiche.
2. Fachmodell: Halbjahreszeiträume, optionale Quartale bei PG 4/5, ungültige Kalendertage, getrennte Dokumentationspflichten und Identitätsgrenzen der Speicherentwürfe.
3. Echte Web-Komponenten und echter RPC-Client in Happy DOM gegen die isolierte Datenbank: Freigabe → Fall → Zuweisung → Portal → Durchführung → Speichern → Routenwechsel mit Entwurf → Ende → Einreichung → Rückfrage → Korrektur → Freigabe. Ein zweiter Schreibvorgang während der Unterschriftensammlung wird abgewiesen. Geometrie und Canvas-Zeichnung sind in diesem Test simuliert.
4. Freigabeschalter, tatsächliche Desktop-/Apps-Kataloge, Rollen-/Modulfilter und Direktrouten: nur der neue Arbeitsplatz wird im Web sichtbar. Altrouten, andere gesperrte Module und native Einstiege bleiben geschützt.
5. Generierte Web-Routen und erforderliche Plattform-Fallbacks.

Der gezielte TypeScript-Check für die neuen Oberflächen und gemeinsamen Fachtypen ist zusätzlich erfolgreich. Der vollständige Expo-Build und die vollständige Testsuite wurden in dieser Arbeitsumgebung nicht ausgeführt; die vollständigen Expo-Abhängigkeiten stehen hier nicht bereit.

**Visuelle Abnahme offen:** Playwright ist vorhanden, sein Chromium-Binary fehlt. Der vorhandene Cloud-Browser erreicht den lokalen Testserver nicht (`ERR_CONNECTION_REFUSED`). Gemäß AGENTS.md wurde kein zusätzlicher Browser und keine neue Testinfrastruktur installiert. Die DOM-Prüfung bestätigt keine Layoutqualität, Touch-Geometrie oder Druckdarstellung. Vor Freigabe müssen echte Browser bei 320/390/768/1024/1440 px, geöffneter Navigation und vergrößerter Schrift geprüft werden; außerdem reale Supabase-Anmeldung, RLS/RPC, Netzwerkunterbrechung, Unterschriften und Druck.

## Freigabe und weitere Umsetzung

Der Einstieg bleibt standardmäßig geschlossen. `EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED=true` ist erst nach erfolgreicher Abnahme zu setzen. Serverseitig muss `tenant_has_platform_module('consulting', tenant_id)` ausdrücklich `true` liefern. Fehlende Modulzuordnungen gewähren keinen Zugriff.

Die neue Migration `20261019202713_consultation_workspace.sql` setzt das vorhandene Company-Access-/Scope-System und die aktiven Portalidentitäten voraus. Produktions- und Staging-Schema unterscheiden sich; deshalb keine pauschale Anwendung aller älteren, vorbereiteten Beratungsmigrationen. Die Migration wurde am 19.10.2026 nach ausdrücklicher Freigabe produktiv angewendet. Die vom Migrationsdienst vergebene Version `20261019202713` wird unverändert auch im Repository geführt. Die sechs Tabellen, RLS, fehlende direkte Tabellenrechte, die beiden SECURITY-INVOKER-RPCs und die Abweisung nicht authentifizierter Aufrufe wurden in Produktion geprüft. Es wurden keine produktiven Testfälle angelegt. Der vollständige Produktionsbuild und die Veröffentlichung folgen getrennt.

Vor einer operativen Komplettfreigabe fehlen insbesondere:

- Vertrags- und Kassenprofile mit Leistungsberechtigung, konkreten Nachweisvorlagen, akzeptiertem Signaturverfahren, Versandkanal und dokumentierter Empfangsbestätigung.
- Echte Überleitung in Abrechnung/DTA, Preis- und Vertragsregeln, Storno- und Korrekturverfahren. Eine fachliche Freigabe löst aktuell keine Rechnung aus.
- Automatische Anspruchs-/Pflegegeld- und Fristensteuerung, Vertretungs- und Sonderfälle, insbesondere verweigerte/nicht mögliche Unterschrift und nachträgliche Abweichungen.
- Integration der Termine, Maßnahmen und Wiedervorlagen in den globalen Kalender, Aufgaben, Benachrichtigungen sowie qualifizierte Vertretung. Überschneidungen mit anderen Modulen werden noch nicht geprüft.
- Geschützter dauerhafter Offline-Betrieb, Anhänge, Videoverfahren, mehrsprachige Beratungshilfen und die weiteren Komfort-/Analysefunktionen des Konzepts.
- Aufbewahrung/Löschung der neuen Gesundheitsdaten, Exporte für Betroffenenrechte, Übernahme vorhandener Fälle und Skalierung der Listen mit serverseitiger Suche/Paginierung.

Bis dahin bleibt dies ein prüfbarer Entwicklungsstand des gemeinsamen Kernablaufs, kein vollständig freigegebenes Abrechnungs- oder Kassenmodul.
