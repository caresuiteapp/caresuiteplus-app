# Google Workspace: Web/Desktop, 11.09.2026

Die generische Integrationsseite zeigte keinen verlässlichen Kontostatus und bot
keinen Arbeitsbereich. Die bisherige separate Google-Seite bestand überwiegend
aus Beschreibungen. Beide bisherigen Detailzugänge führen nun zum gleichen
Google-Arbeitsplatz.

## Verhalten

- Tatsächlicher Verbindungsstatus, Konto, freigegebene Dienste, letzter erfolgreicher
  Abruf und Aktivitäten. Ein konfigurierter Anbieter gilt nicht als verbundenes Konto.
- Gmail: Postfachsuche, Klartextansicht direkt am Eintrag, gelesen markieren,
  Nachricht senden, Entwurf speichern und vollständige Nachricht in Gmail öffnen.
- Kalender und Meet: Zeitraumfilter, Termine anzeigen, Termin mit optionaler
  Einladung und Meet-Konferenz erstellen, Kalender/Meet direkt öffnen.
- Drive: Dateisuche, Pagination, Ordner und binärtreue Uploads bis 5 MB.
  Docs, Sheets und Slides: Dateien finden, neu erstellen und im Google-Editor öffnen.
- Tasks: Listenwahl, offene/erledigte Aufgaben, Erstellen, Abschließen und Wiederöffnen.
  Kontakte: Lesen/Anlegen. Chat: Spaces lesen und Nachrichten an ausgewählten Space senden.
- Fünf Widgets im vorhandenen Apps-&-Widgets-Katalog: Workspace, Gmail, Kalender,
  Drive und Tasks. Vorhandene Desktop-Plätze werden nicht automatisch ersetzt.
- Gemeinsamer Datenabruf mit Cache pro Benutzer, Betrieb, Rolle und Google-Verbindung.
  Sichtbare Arbeitsansichten aktualisieren ungefähr alle zwei Minuten; Änderungen
  invalidieren passende Daten. Keine automatische Übernahme in CareSuite-Klientenakten.
- Schreiben erfordert eine ausdrückliche Aktion. Formulare sperren doppelte Absenden-
  Versuche und behalten Eingaben bei Fehlern. Keine automatischen Schreib-Retries.
- Google-Dienste sind für Geschäftsführung und Verwaltung dieses Betriebs freigegeben;
  Portalrollen können das betriebliche Postfach nicht über den Proxy lesen.

## OAuth und Server

OAuth-State wird atomar beansprucht. Die abschließende Datenbankfunktion prüft den
State und die Rolle erneut und sperrt den State gegen gleichzeitiges Trennen.
Refresh-Tokens werden nur beim gleichen Google-Subject wiederverwendet. Es werden
nur tatsächlich zurückgemeldete Scopes aktiviert. Refresh und Statusaktualisierungen
können eine neuere Kontoverbindung nicht überschreiben. Ein widerrufener Refresh-Grant
fordert eine neue Google-Freigabe an. Provider-Fehlertexte mit möglichen Inhalten
werden nicht in das Audit übernommen.

## Verifikation

- 40 Vitest-Prüfungen bestanden (Anfragen, Uploadbytes/-grenze, IDs, Pagination,
  Zeitraumvalidierung, E-Mail-Injektion/Unicode, sichere Links, Rollen, Navigation).
- Browserprüfung mit realen Web-Komponenten, Hooks, Datenadaptern und Formularen;
  ausschließlich die Auth-/Transportgrenze verwendet synthetische Testdaten.
- 1440 px, 390 px und 900 px mit 150 % Schrift: keine horizontale Überbreite;
  Übersicht und Formulare als Screenshots separat visuell kontrolliert.
- E-Mail lesen/senden, Doppelklickschutz, Aufgabenabschluss, ausgewählte Aufgabenliste,
  Eingabeerhalt nach Fehler, binärer Upload, Meet-Termin, gezielter Chat-Versand,
  Bestätigung vor Trennen und keine Datenabrufe ohne Verbindung erfolgreich geprüft.
- Beide Edge Functions als ESM gebündelt; Diff-Prüfung bestanden.
- Der vollständige Repository-Typecheck ist bereits durch bestehende Web/native-
  Typkonflikte blockiert. Die neuen Workspace-Komponenten und Datenadapter erzeugten
  in der Prüfung keine Typdiagnosen; eine vollständige globale Typecheck-Freigabe
  wird nicht behauptet.

## Noch kontobezogen nachzuweisen

Die Produktionsprüfung fand die Google-Secret-Namen und beide bereitgestellten
Functions, aber keine Google-Verbindung für AVENTA. Es wurden keine Zugangsdaten
extrahiert, keine echte Nachricht verschickt und keine Google-Testdaten angelegt.
Die echte Google-Freigabe, die Aktivierung der APIs im zugehörigen Cloud-Projekt,
den kontobezogenen Datenfluss und einen Refresh nach Tokenablauf kann erst eine
abgeschlossene Kontoverbindung belegen. Secret-Namen allein belegen keine gültige
Google-Konfiguration. Der nächste Schritt im Produkt ist „Google-Konto verbinden“.

## Veröffentlichung

Die automatische Freigabeprüfung hat das Anwenden der Produktionsmigration, die
Registrierung der Migration und das Deployen der zwei Edge Functions abgelehnt,
weil eine ausdrückliche Freigabe dieser Produktionsänderung fehlt. Der Aufruf
wurde vor Ausführung blockiert; eine erfolgreiche Live-Veröffentlichung wird
nicht behauptet. Die Änderung liegt zur Durchsicht auf dem separaten Feature-Branch.
