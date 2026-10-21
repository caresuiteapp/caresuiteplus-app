# Beratungsarbeitsplatz

Stand: 21.10.2026. Der gemeinsame interne Web-Ablauf ist produktiv verfügbar. Die Erweiterung um Standardbausteine, Teamvorlagen, Schnellauswahlen und Aufgaben ist im vorliegenden Code implementiert; die zugehörige Datenbankmigration ist produktiv angewendet. Ihr Web-Veröffentlichungsstand ist getrennt vom bereits veröffentlichten Kernablauf zu prüfen. Das gesamte Beratungskonzept einschließlich Kassenversand und Abrechnung ist damit noch nicht vollständig umgesetzt.

## Fortsetzung: Teamvorlagen und Nachverfolgung

- Mandantenbezogene Teamvorlagen mit editierbarem Entwurf, ausdrücklicher Teamfreigabe mit Prüfvermerk, unveränderbaren Fassungen und Archivierung. Änderungen am Entwurf ersetzen die veröffentlichte Fassung erst bei erneuter Freigabe. Vorlagen lassen sich aus den Standardbausteinen oder aus vorhandenen Fassungen kopieren.
- Das Mitarbeiterportal erhält nur veröffentlichte, nicht archivierte Inhalte; keine Entwürfe oder Freigabehistorie. Vorlagen erscheinen in Bibliothek, Vorbereitung und Schulungszielen. Bereits übernommene Besuchsinhalte ändern sich nicht nachträglich.
- Offene Empfehlungen und datierte Wiedervorlagen werden beim fachlichen Freigeben atomar als eigenständige Aufgaben angelegt. Quelle ist die neueste unterschriebene Fassung. Bereits erledigte Empfehlungen werden nicht erneut geöffnet. Für früher freigegebene Besuche gibt es eine ausdrückliche, wiederholbare Übernahme ohne Duplikate.
- Verwaltung und zugewiesene Mitarbeitende sehen offene, fällige, erledigte und entfallene Aufgaben. Rückmeldungen, Terminänderungen und Wiedereröffnung ergänzen den Aktenverlauf. Aufgaben haben eigene Versionsnummern: Besuchsstand, Antworten, Signaturen und Prüfsummen bleiben unverändert. Die Besuchsfilter verwenden nach Freigabe die aktuellen offenen Aufgaben und zeigen erledigte Aufgaben nicht weiter als fällig an.
- Gleichzeitige Änderungen werden abgefangen; der lokale Entwurf bleibt bei Konflikten geöffnet. Eine Vorlagenfreigabe bezieht sich auf die beim Vorbereiten festgehaltene Fassung. Idempotente Wiederholungen und erneut geprüfte Rechte verhindern Duplikate und Zugriffe nach Entzug einer Zuweisung.
- Die neue Erweiterung verwendet `supabase/migrations/20261021063230_consultation_followups_templates.sql`, am 21.10.2026 produktiv angewendet und auf Zugriffsgrenzen geprüft. In Umgebungen ohne diese Serverfähigkeiten bleiben die neuen Funktionen ausgeblendet; der bestehende Besuchsablauf und die Standardbausteine bleiben nutzbar. Nachweise, Rollout und Rücknahme sind in `supabase/changes/consultation_followups_templates.md` beschrieben.
- Keine Anbindung an zentrale Aufgaben, globale Kalender oder automatische Erinnerungen. Die geprüfte allgemeine Aufgabenimplementierung verwendet noch einen lokalen Store. Diese Erweiterung speichert Aufgaben ausschließlich im Beratungsarbeitsplatz.

## Erste Erweiterung vom 20.10.2026

- 14 durchsuchbare Vorlagen mit Kategorien und Vorschau: sechs Beratungsanlässe und acht häusliche Schulungsbausteine. Vorbereitung lässt sich ausdrücklich ergänzen, ohne vorhandene Notizen zu ersetzen; Schulungsbausteine erzeugen anpassbare Lernziele.
- 20 auswählbare Beratungsthemen, acht Teilnehmerrollen, sechs Anleitungsmethoden, fünf Materialarten und acht Empfehlungen. Verantwortlichkeit und Datum bleiben individuell anpassbar; Methoden und Materialien werden nur durch ausdrückliche Auswahl dokumentiert.
- Fristen und Wiedervorlagen in 7/14/28 Tagen, Besuchsdauer 30/45/60/90 Minuten. Kalenderdaten berücksichtigen Europe/Berlin; die Terminmaske prüft zusätzlich Dauer und Qualifikation über den gesamten gewählten Zeitraum. Die verbindliche serverseitige Berechtigungs- und Überschneidungsprüfung bleibt bestehen.
- Schnellfilter für heute, ungeplante Besuche, offene Dokumentation und fällige Wiedervorlagen. Kombinierbar mit Person, Terminzeitraum, Leistungsart, Suchbegriff und Sortierung. Offene Besuche und Rückfragen werden konsistent gezählt.
- Strukturierte Nachweiserfassung mit Unterlagenart, Fundstelle, Stelle und Prüfdatum. Neue Qualifikationen sind zunächst inaktiv; die berechtigte Person bestätigt die Freigabe ausdrücklich. Zeichenlimit und Gültigkeitszeitraum entsprechen den vorhandenen Datenbankgrenzen.
- Kompaktere Kennzahlen, gestalteter HealthOS-Kopfbereich, Glasflächen, Zustandsfarben, dezente Übergänge und Kartenreaktionen. Reduzierte Bewegung, Tastaturfokus und schmale Inhaltsbereiche werden berücksichtigt. Fortschritt zeigt vollständige Pflichtabschnitte; gesperrte Dokumentationsfelder erläutern den nächsten Schritt.
- Technische Fall-IDs erscheinen nicht mehr als Fenstertitel; unbekannte Pflegegrade erhalten eine verständliche Beschriftung. Schnelle Änderungen verschiedener Eigenschaften desselben Lernziels oder derselben Empfehlung werden zusammengeführt.
- Verwaltung und Mitarbeiterportal verwenden dieselben Komponenten und dasselbe Antwortformat. Für diese Standardbausteine ist keine neue Datenbankmigration erforderlich; die obige Fortsetzung hat einen eigenen Datenbankbedarf. Vorlagen setzen keine Befunde, Einwilligungen, Lernergebnisse, Erledigungsstände oder Unterschriften.

Die priorisierte Restprüfung steht in [AUDIT-2026-10-20.md](AUDIT-2026-10-20.md).

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
- HealthOS-Farben in Navy, Electric Blue und Weiß, transparente Flächen, angepasste Formulare für schmale Inhaltsbereiche, Schriftvergrößerung, Tastaturfokus, Dialoge mit Fokusbindung und reduzierte Bewegung.

## Rechte und Datengrenzen

Neue Tabellen verwenden RLS und gewähren `authenticated`/`anon` keine direkten Tabellenrechte. Zwei öffentliche SECURITY-INVOKER-RPCs rufen private Implementierungen mit überprüfter Identität, Mandant, Modulfreigabe und Berechtigung auf.

Die Verwaltung benötigt `beratung.cases.view` und `office.clients.view_sensitive`. Planung, Prüfung und Qualifikationsverwaltung sind getrennte Rechte. Vorhandene Rollenlisten, individuelle Denies und Datenbeschränkungen bleiben maßgeblich. Nicht zuordenbare eingeschränkte Unternehmens-/Beratungsbereiche werden abgewiesen; eine feinere fallbezogene Scope-Zuordnung ist noch offen.

Im Mitarbeiterportal werden nur aktive, authentifizierte Portalkonten mit aktiver Personalzuordnung akzeptiert. Zugriff besteht ausschließlich auf persönlich zugewiesene Besuche. Durchführung erfordert außerdem eine gültige Freigabe der jeweiligen Leistungsart. Die Portalansicht erhält keine allgemeine Klienten- oder Mitarbeiterliste. Manipulierbare `user_metadata` begründen keine Berechtigung.

Bestehende Beratungs- und Assist-Tabellen werden nicht umgeschrieben. Die bisherigen Beratungsseiten bleiben von dieser Freigabe ausgenommen. Neue native Routen sind lediglich erforderliche Fallback-Weiterleitungen; Android-Funktionen und die geschützte Assist-Durchführung werden nicht erweitert.

## Nachweis der Prüfung

`npm run verify:consultation:release` ist Bestandteil von `build:web:production` und führt aus:

1. PostgreSQL/PGlite: beide Leistungsarten, Mandantentrennung, zugewiesene Personen, aktive Konten, Qualifikationen, Überschneidungen, negative Einwilligung, Pflichtfelder, Versionskonflikte, Request-Wiederholung, unveränderbare alte Fassungen, Rückgabe, Freigabe, Modulabschaltung, individuelle Denies und beschränkte Datenbereiche.
2. Fachmodell: Halbjahreszeiträume, optionale Quartale bei PG 4/5, ungültige Kalendertage, getrennte Dokumentationspflichten und Identitätsgrenzen der Speicherentwürfe.
3. Echte Web-Komponenten und echter RPC-Client in Happy DOM gegen die isolierte Datenbank: Freigabe → Fall → Zuweisung → Portal → Durchführung → Speichern → Routenwechsel mit Entwurf → Ende → Einreichung → Rückfrage → Korrektur → Freigabe. Zusätzlich vollständiger §45-Ablauf mit strukturiertem Nachweis, Vorlagenbibliothek, Dauer, unvollständigem Lernziel ohne erfundenes Ergebnis, tatsächlicher Übung, Material, Empfehlung, Unterschriften und Freigabe. Ein zweiter Schreibvorgang während der Unterschriftensammlung wird abgewiesen. Geometrie und Canvas-Zeichnung sind in diesem Test simuliert.
4. Freigabeschalter, tatsächliche Desktop-/Apps-Kataloge, Rollen-/Modulfilter und Direktrouten: nur der neue Arbeitsplatz wird im Web sichtbar. Altrouten, andere gesperrte Module und native Einstiege bleiben geschützt.
5. Teamvorlagen: Entwurf, Veröffentlichung, unveränderte freigegebene Inhalte bei Entwurfsänderung, Archiv, Versionsverlauf, Mandant/Denies, wiederholte Übertragung. Aufgaben: atomare Übernahme bei Freigabe, Rückmeldung, Wiedereröffnung, Konflikte, Import ohne Duplikate, unveränderte Signaturen und Besuchsversion, entzogene Zuweisung. Der DOM-Ablauf erstellt und veröffentlicht eine Teamvorlage, nutzt sie im Portal und bearbeitet eine Aufgabe aus zwei Sitzungen mit einem Versionskonflikt.
6. Generierte Web-Routen und erforderliche Plattform-Fallbacks.

Am 20.10.2026 bestanden 15 Fachmodell-, Navigations- und PostgreSQL-Prüfungen sowie beide beschriebenen DOM/RPC-Abläufe und die Prüfung der 674 Web-Routen; diese Prüfungen wurden am 21.10.2026 erfolgreich wiederholt. Der strenge TypeScript-Check der geänderten Beratungsoberflächen und abhängigen Fachtypen ist erfolgreich. Dafür wurden vorhandene Projektabhängigkeiten verwendet, keine Software installiert. Der erste Erweiterungsstand `aeb1ace656b3f032403a2fcaab4dcc08f0154fd8` hat einen erfolgreichen vollständigen Preview-Build (`dpl_DJkMmeZoSmvwRFjHPspC31rM4hAK`). Der folgende Build scheiterte an veralteten Desktop-Testmocks; deren Korrektur ist mit 280 Tests und 20 isolierten Datenbankprüfungen bestätigt. Der abschließende Web-Build wird in PR #137 dokumentiert.

**Visuelle Abnahme offen:** Playwright ist vorhanden, sein Chromium-Binary fehlt. Der vorhandene Cloud-Browser erreicht den lokalen Testserver nicht (`ERR_CONNECTION_REFUSED`). Gemäß AGENTS.md wurde kein zusätzlicher Browser und keine neue Testinfrastruktur installiert. Die DOM-Prüfung bestätigt keine Layoutqualität, Touch-Geometrie oder Druckdarstellung. Vor Freigabe müssen echte Browser bei 320/390/768/1024/1440 px, geöffneter Navigation und vergrößerter Schrift geprüft werden; außerdem reale Supabase-Anmeldung, RLS/RPC, Netzwerkunterbrechung, Unterschriften und Druck.

## Freigabe und weitere Umsetzung

Der Einstieg ist in Produktion mit `EXPO_PUBLIC_CONSULTATION_WORKSPACE_ENABLED=true` aktiviert. Serverseitig muss `tenant_has_platform_module('consulting', tenant_id)` ausdrücklich `true` liefern. Fehlende Modulzuordnungen gewähren keinen Zugriff.

Die Migration `20261019202713_consultation_workspace.sql` setzt das vorhandene Company-Access-/Scope-System und die aktiven Portalidentitäten voraus. Produktions- und Staging-Schema unterscheiden sich; deshalb keine pauschale Anwendung aller älteren, vorbereiteten Beratungsmigrationen. Die Migration wurde am 19.10.2026 nach ausdrücklicher Freigabe produktiv angewendet. Die sechs Tabellen, RLS, fehlende direkte Tabellenrechte, die beiden SECURITY-INVOKER-RPCs und die Abweisung nicht authentifizierter Aufrufe wurden in Produktion geprüft. Die gezielte Übernahme berechtigter Altfreigaben wurde am 20.10.2026 mit `20261020053957_consultation_legacy_access.sql` ergänzt und unter authentifizierter Rolle geprüft. Es wurden keine produktiven Testfälle angelegt. Der Produktionsbuild des Kernablaufs einschließlich dieser Zugriffsanpassung ist für Commit `8ccdd2874092e9c796b37c58d58073d4f2697128`, Deployment `dpl_2DUiajeXjqnqrrPMfjJ1JDBCpoCa`, als READY belegt. Der separat belegte erste Vorlagen-Preview-Build ist oben genannt; die produktive Veröffentlichung der neuen Erweiterungen ist damit nicht erfolgt.

Vor einer operativen Komplettfreigabe fehlen insbesondere:

- Vertrags- und Kassenprofile mit Leistungsberechtigung, konkreten Nachweisvorlagen, akzeptiertem Signaturverfahren, Versandkanal und dokumentierter Empfangsbestätigung.
- Echte Überleitung in Abrechnung/DTA, Preis- und Vertragsregeln, Storno- und Korrekturverfahren. Eine fachliche Freigabe löst aktuell keine Rechnung aus.
- Automatische Anspruchs-/Pflegegeld- und Fristensteuerung, Vertretungs- und Sonderfälle, insbesondere verweigerte/nicht mögliche Unterschrift und nachträgliche Abweichungen.
- Integration der Termine, Maßnahmen und Wiedervorlagen in den globalen Kalender, Aufgaben, Benachrichtigungen sowie qualifizierte Vertretung. Überschneidungen mit anderen Modulen werden noch nicht geprüft.
- Geschützter dauerhafter Offline-Betrieb, Anhänge, Videoverfahren, mehrsprachige Beratungshilfen und die weiteren Komfort-/Analysefunktionen des Konzepts.
- Aufbewahrung/Löschung der neuen Gesundheitsdaten, Exporte für Betroffenenrechte, Übernahme vorhandener Fälle und Skalierung der Listen mit serverseitiger Suche/Paginierung.

Bis dahin bleibt dies ein prüfbarer Entwicklungsstand des gemeinsamen Kernablaufs, kein vollständig freigegebenes Abrechnungs- oder Kassenmodul.
