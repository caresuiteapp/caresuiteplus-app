# Plattform & Module — Web-Überarbeitung

## Ausgangspunkt

Die bisherige Subscription-Seite verwendete auch im Livebetrieb `demoTenant` und eine Demo-Abonnementvorlage. Die Zahlen mischten aktive Hauptmodule, automatisch enthaltene Module und sechs allgemeine Plattformfunktionen. „Module verwalten“ führte über eine stillgelegte Route zurück zur Startseite; „Integrationen ansehen“ zeigte auf einen gesperrten Katalogbereich.

## Verhalten

- Eine Web-spezifische Ansicht ersetzt die wiederholten Preis-/Statuskarten. Native Android-Dateien bleiben unverändert.
- Titel und Popup heißen „Plattform & Module“. Die Übersicht zeigt das echte Unternehmen, die kostenlose Basisplattform, sechs Hauptmodule und sechs getrennt ausgewiesene Plattformfunktionen.
- Module zeigen „Freigeschaltet“, „Nicht freigeschaltet“, „Gesperrt“ oder „In Vorbereitung“ samt Erklärung. Globale Veröffentlichungssperren, administrative Sperren und zeitliche Plattformfreigaben bleiben wirksam.
- Suche und Statusfilter wirken auf die Modulkarten. Ein leerer Trefferbereich bietet das Zurücksetzen an. Freigegebene Module erhalten nur mit passender Rollenberechtigung und erlaubter Zielroute eine Öffnen-Aktion.
- „Apps & Widgets“ öffnet gezielt das vorhandene Apps-Fenster auf `/Desktop?center=apps`. Der Parameter wird einmal nach Wiederherstellung des angemeldeten Desktops verarbeitet und danach entfernt; die gespeicherte Bereichsauswahl bleibt erhalten.
- Externe Anbindungen werden als vorbereitet beschrieben. Die Seite aktiviert keine Module, verändert keine Freigaben und löst keine Bestellung aus.

## Daten und Fehlerverhalten

Der neue Lesedienst prüft authentifizierte Person, Profil und Mandant vor und nach dem Abruf. Er liest die aktuellen Rollenrechte, den Unternehmensnamen, `tenant_products`, `tenant_module_settings` und `tenant_list_platform_modules`. Er verwendet weder den Demo-Modulspeicher noch dessen automatische Initialisierung im Livebetrieb. Vorbereitete Plattformfunktionen sind keine zusätzlichen aktiven Hauptmodule.

Ein Konto- oder Mandantenwechsel blendet vorherige Daten sofort aus. Veraltete Antworten dürfen den aktuellen Zustand nicht überschreiben. Berechtigungs-/Identitätsfehler entfernen die Daten. Bei einem Verbindungsfehler während einer Aktualisierung bleibt der letzte erfolgreiche Stand mit Warnung und Zeitpunkt sichtbar; Navigation ist bis zum erfolgreichen erneuten Abruf deaktiviert. Erstes Laden, fehlender Zugang, Timeout und Wiederholen sind ausdrücklich behandelt.

Die bestehenden Berechtigungsdefinitionen bleiben maßgeblich. Es werden keine Datenbankmigrationen und keine produktiven Datenänderungen benötigt.

## Prüfung

Der Web-Produktionsbuild führt die neuen gezielten Tests zusätzlich zu den vorhandenen Release-Prüfungen aus. Die Tests behandeln Freigaberegeln, Live-/Demo-Trennung, Berechtigungen, veraltete Antworten und die einmalige Desktop-Navigation. Die tatsächliche Ausführung und Ergebnisse werden im Pull Request dokumentiert.

Layoutregeln berücksichtigen die Breite des eingebetteten Fensters, lange Namen und vergrößerte Schrift. Die Seite verwendet nur den Scrollbereich von `ScreenShell`, sichtbare Tastaturfokusse und reduzierte Bewegung nach Systemeinstellung. Eine Code-/DOM-Prüfung ist keine visuelle Abnahme. Die lokale Umgebung enthält keinen ausführbaren Browser; der Cloud-Browser blockiert lokale HTML-Dateien. Die Prüfung mit angemeldeten Konten und eine visuelle Kontrolle in breiten und schmalen echten Fenstern sind deshalb noch offen.
