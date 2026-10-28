# Android: Navigation und Portale nach Gerätebefund zu Code 55

## Gerätebefund und Abgrenzung

Der neue Samsung-Fehlerbericht weist die installierte Version 0.7.1 mit
Versionscode 55 aus. Nach deren Aktualisierung enthält er einen neuen Absturz:

`Invariant Violation: View config getter callback for component style must be a function`

Der Komponentenstack führt über `OfficeAssignmentProfileCalendarPlanner`
und `CalendarWorkspace` zum Assist-Kalender. Die archivierte Hermes-Datei und
die tatsächlich signierte AAB stimmen bytegenau überein; ihre Source-Map enthält
die unbedingte `createElement('style', ...)`-Anweisung des Planners. Die alten
Structured-Clone- und Text-Radius-Abstürze im Bericht gehören zu früheren
Installationen. Sie wurden nicht als neue Code-55-Abstürze gezählt.

Der Nutzer meldet darüber hinaus direkte Fehlleitung nach Office, einen
Fahrtenbuch-Abbruch und erhebliche Portalprobleme. Vier neue Geräteaufnahmen
belegen insbesondere eine unerwünschte Pflegetouren-Sektion auf „Heute“,
zusammengedrückte Startseiteninhalte, überhohe Klientenkarten und einen Kalender
ohne seine vorgesehenen Layoutregeln. Die späteren Portalaufnahmen liegen
außerhalb des Zeitfensters des Fehlerberichts. Für den Fahrtenbuch-Abbruch
liegt darin kein aktueller Stacktrace vor.

## Korrigierte Ursachen

- Der native Generator überträgt auch importierte React-`createElement`-Aufrufe
  mit HTML-Tags auf die vorhandenen nativen Komponenten. Ein symbolgebundener
  AST-Check verhindert verbliebene HTML-Hosts in erzeugten Laufzeitmodulen und
  Seiten. Reine HTML-Dokumentausgabe bleibt gesondert behandelt.
- CSS erreicht den umgebenden nativen Komponentenbaum auch bei geklammerten
  JSX-Returns und JSX-Ausdruckspfeilfunktionen. Sechs reine Stylesheet-Komponenten
  und eine zusammengesetzte Stylesheet-Komponente stellen ihre statischen Regeln
  den tatsächlichen Verbrauchern zur Verfügung. Komponentenlokale CSS-Werte
  werden nicht in den Modulbereich verschoben; Elementschlüssel bleiben erhalten.
- Der Modulnavigator bleibt beim Wechsel zwischen Desktop und Fachseite
  montiert. Die wechselnde Darstellung sitzt innerhalb der bestehenden Szene.
- Erhaltene Anmeldeseiten dürfen nur bei eigenem Fokus und eigener Auth-Route
  navigieren oder den Android-Zurückknopf übernehmen. Späte Auth- und
  Plattformprüfungen dürfen nach Fokusverlust keine fremde Seite ersetzen.
  Lade-, Rollen-, Passwort-, Session- und Produktsperren bleiben wirksam.
- Die erhaltene native Verwaltungs-Szene prüft außerdem ihren eigenen Bereich
  anhand der bestehenden Rollenregistry. Der gerade aktive Portalpfad darf
  nach einem Rollenwechsel keine Verwaltungs-Kinder erneut freigeben.
  Blockierende Lade- und Fehlermeldungen aus inaktiven, weiterhin gesperrten
  Szenen werden nicht als globale Modal-Überlagerung eingeblendet;
  autorisierte Inhalte bleiben bei einem normalen Fokuswechsel montiert.
- Die gemeinsamen deklarativen Meldungs-Komponenten `StateViews`, `InfoBanner`
  und `WorkflowToast` registrieren ihre nativen Overlay-Meldungen nur bei
  tatsächlichem Seitenfokus. Ein Hintergrundfehler kann dadurch nicht mehr
  die Meldung der aktiven Seite verdrängen. Das Entfernen betrifft nur die
  eigenen Meldungskennungen; direkte globale Vorgänge, Startup außerhalb
  der Navigation, Inline-Anzeigen und das bisherige Webverhalten bleiben
  erhalten. Die Fokusänderung entfernt keine autorisierten Seitenkinder.
- „Heute“ im Mitarbeitendenportal zeigt keine Pflegetouren mehr und verwendet
  einen durchgehenden Scrollbereich. Portalrahmen innerhalb äußerer ScrollViews
  behalten ihre natürliche Inhaltshöhe. Klientenkarten füllen nicht mehr die
  gesamte verfügbare Höhe; ihre Aktionen stehen direkt beim Inhalt.
- Klient:innen-Anfrageformulare behalten ihre Eingaben beim Wechsel zwischen
  Handy- und Tabletbreite. Ein Wechsel der Person oder des Mandanten setzt den
  Zustand bewusst zurück; veraltete Antworten dürfen den neuen Kontext nicht
  verändern. Aktualisierungsfehler bei vorhandenen Daten bleiben sichtbar.
- Der bestehende reine Akademiezugang für Angehörige bleibt auf Android ein
  Browserzugang. Die native Darstellung mountet dafür keine Versorgungs- oder
  Signaturdaten-Hooks. Es werden keine Fachmodule oder Serverfreigaben aktiviert.
- Lesefehler im Arbeitszeitkonto erscheinen inline mit gezielter Wiederholung.
  Fehlende Vertrags-Sollzeiten werden nicht erfunden und Startbedingungen nicht
  geöffnet. CSS-Ausrichtung scrollbarer Inhalte wird auf dem Inhaltscontainer
  statt auf dem äußeren ScrollView gesetzt.

## Nachweis und verbleibende Grenzen

Die bisherigen Tests hatten viele Ziele nur als Callback-Adresse geprüft und
den Router durch leere Komponenten ersetzt. Diese Prüfung konnte weder den
Navigator-Neumount noch Hintergrund-Weiterleitungen nachweisen.

Neue Regressionen verwenden deshalb den installierten Expo-Router mit dem
tatsächlichen Android-Dateibaum, instrumentieren die echte Layout-Lebensdauer
und führen die tatsächlichen Auth-Guards aus. Weitere Tests rendern echte
Portal-, Kalender-, Formular- und Fahrtenbuch-Komponenten mit isolierten
Service- und Geräte-Schnittstellen. Die bestehende Bildprüfung verwendet jetzt
die tatsächlichen Portal-Seiten samt ihren Rahmen und prüft auch Suchvorgänge,
Ansichtswechsel, Scroll-Erreichbarkeit und konkrete Zieladressen.

Diese Nachweise ersetzen keine Geräteabnahme der neu gebauten AAB. Insbesondere
der vom Nutzer gemeldete Fahrtenbuch-Abbruch wird ohne passenden aktuellen
Gerätestack nicht als nachgewiesen behoben bezeichnet. Testdaten sind synthetisch;
es werden keine produktiven Einsätze, Arbeitszeiten, Nachrichten oder Google-
Transaktionen als Test geschrieben.

Die vier zuvor geprüften Produktions-Datenbankkorrekturen sind weiterhin
**nicht angewandt**. Die automatische Freigabeprüfung hat sie wegen fehlender
ausdrücklicher Zustimmung zu den konkreten dauerhaften Produktionsänderungen
abgelehnt. Diese Quellcodekorrekturen umgehen diese Sperre nicht.

Die zusätzliche Portalprüfung hat außerdem einen Vertragskonflikt im vierten
RLS-Entwurf aufgedeckt: Die dortige Own-Employee-Lesegrenze könnte neuere
Kolleg:innen-Statusprojektionen im Teamkalender und in Klientenhistorien
ausblenden. Das alte Viererpaket darf deshalb auch nach einer Zustimmung zu
seiner bisherigen Fassung nicht unverändert angewandt werden. Die gemeinsame
Überarbeitung von Status-Lesepfad und Servergrenze ist noch offen; der aktuelle
Produktionsstand wurde nicht verändert. Siehe
[Serververtragsprüfung](android-workflow-backend-review-20261026.md).
