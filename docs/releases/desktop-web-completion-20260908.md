# Desktop/Web: Abschlussstand vom 8. September 2026

Die Veröffentlichung erfolgt auf ausdrücklichen Nutzerauftrag ohne Testläufe,
Browserprüfung, Lint oder Typecheck. Der Web-Export ist ein notwendiger
Veröffentlichungsschritt. Die funktionale und gestalterische Abnahme erfolgt
durch den Auftraggeber nach dem Deployment. Dieser Stand ist keine Bestätigung
einer fehlerfreien Nutzung auf allen Geräten.

## Gemeinsame Web-Oberflächen

- Einheitliche, lesbare Seitenköpfe mit umbrechenden Aktionen.
- Tabellen verwenden für Kopf und Zeilen dieselben Spaltendefinitionen.
  Bei zu wenig Platz entstehen beschriftete Karten statt versetzter Spalten.
- Größere Schrift in Plattform-Navigation, Formularen und Statusanzeigen;
  vorhandene Einstellungen zur Textgröße bleiben wirksam.
- Bestätigungen bleiben auf niedrigen Bildschirmen scrollbar. Während des
  Speicherns verhindern sie mehrfaches Absenden und unbeabsichtigtes Schließen.
- Unternehmenssuche mit Ergebnisbereich und gemeinsamem Zurücksetzen der Filter.

## Registrierung und Unternehmen

- Die fünf Registrierungsschritte, kostenlose Bereitstellung und vorhandene
  atomare Serverfunktion werden weiterverwendet; keine Modulauswahl.
- Kompakter Fortschritt oberhalb des Formulars bei geringer Breite.
- Jeder Schritt startet am Formularanfang; alte Fehler verschwinden beim Wechsel.
- Vollständigere Zusammenfassung von Organisation, Kontakt und Administration.
- Entwurfs-Schreibvorgänge werden geordnet. Nach Erfolg wird der Entwurf erst
  nach Abschluss vorheriger Schreibvorgänge entfernt; Passwörter werden nie gespeichert.
- Unternehmensstammdaten schützen ungespeicherte Änderungen auch beim Tabwechsel.
- Vertrags-, Berechtigungs-, Rechnungs-, Zahlungs-, Guthaben-, Rabatt- und
  Freigabeaktionen zeigen Serverfehler. Bestätigung und Begründung bleiben bei
  fehlgeschlagenem Speichern erhalten. Zahlungsänderungen aktualisieren die Ansicht.
- Fehlgeschlagene Benutzer- und Protokollabrufe erscheinen als Fehler.

## Support

- Ältere Tickets, Beschreibungen, Lösungen und freigegebene Nachrichten werden
  direkt aus den bestehenden Tabellen gelesen. Bestehende RLS bleibt maßgeblich;
  es werden keine alten Datensätze migriert oder Berechtigungen erweitert.
- Archivsuche und seitenweises Nachladen. Geschützte Anhänge werden nur über
  authentifizierten Storage-Zugriff heruntergeladen, nicht über beliebige Alt-URLs.
- Die frühere Web-Oberfläche für separate Support-Sitzungen führt zur zentralen
  Ticket- und Einwilligungsoberfläche.
- Ungesendete Nachrichten und Bearbeitungen werden beim Entfernen der Route und
  beim Neuladen geschützt. Lokale Ticketwechsel behalten den bestehenden Schutz.
- Fehlgeschlagene Uploads versuchen ihren reservierten Upload-Platz freizugeben.
- Statusbezeichnungen benennen eindeutig, wessen Antwort noch aussteht.

## Einsatz und Unterschrift

- Web-Signaturabfragen haben eine abbrechbare Frist. Eine nicht erreichbare
  Abfrage bestätigt weder das Fehlen noch das erfolgreiche Speichern einer Signatur.
- Bei ausgebliebener INSERT-Antwort erfolgt ein gezielter Abruf nach Mandant,
  Einsatz und Signatur-ID. Nur passende gespeicherte Hashes bestätigen den Erfolg.
- Hochgeladene Signaturbilder werden bei unklarem INSERT-Ausgang nicht gelöscht;
  ein bereits gespeicherter Datensatz könnte auf sie verweisen.
- Bei der Wiederherstellung eines Start-Ereignisses wird eine vorhandene tatsächliche
  Startzeit verwendet. Fehlt sie für einen bereits gestarteten Einsatz, muss die
  tatsächliche Zeit über die vorhandene Zeitkorrektur angegeben werden.

## Bestehender Stand und Grenzen

Das vorher veröffentlichte Desktop-Raster, linke Menü, Wetter, gleich hohe
Kopfbereiche und der Web-Start mit den vorhandenen Intro-Videos bleiben erhalten.
Die native Android-Ausführung und Android-Artefakte werden nicht bearbeitet.
Für diesen Stand sind keine neuen Datenbankmigrationen erforderlich.

Die Ursache der ursprünglich gemeldeten Signaturfehler ist nicht rückwirkend
bewiesen. Die hier korrigierten Fehlerpfade sind konkrete Quellcodebefunde.
Fehlende historische Zeiten, GPS-Punkte und Signaturen werden nicht erfunden.
Alt-Anhänge ohne zuordenbaren geschützten Speicherpfad benötigen eine spätere
Zuordnung anhand ihres Originaldatensatzes; die Oberfläche zeigt das ausdrücklich an.
