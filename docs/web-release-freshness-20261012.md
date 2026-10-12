# Veraltete Ansicht in einem bereits geöffneten Webfenster

## Tatsächliche Beobachtung

Die Produktionsdomain war am 12. Oktober dem Commit `f7326c838d90159b83af82a7e40c9717a112cec5` und dem bereiten Deployment `dpl_BT6quykq1bjiznVFt6gtbYAmFX3u` zugeordnet. Das inzwischen angemeldete Prüffenster zeigte dennoch das Logo unter Uhr/Wetter und führte `entry-21482a9b77e86c82a1e976541fa85825.js` aus.

Nach vollständigem Neuladen führte derselbe Browser `entry-2e473c9b81ae0788dd40303fd51ef33e.js` aus. Der angemeldete Desktop zeigte das Logo oberhalb der gemeinsamen Informations- und Bedienzeile. Die vorhandene Anmeldung und die gespeicherte Widget-Auswahl blieben erhalten. Beobachtete Fenstergröße: 1363 × 936. Das belegt die Versionsabweichung in diesem Prüffenster; es ist keine pauschale Aussage über jeden Nutzerbrowser.

## Korrektur

- Die Webanwendung vergleicht ihren initial geladenen Expo-Bundle-Namen mit dem aktuellen öffentlichen `index.html`. Prüfung nach Startabschluss, bei Rückkehr ins Fenster und regelmäßig während sichtbarer Nutzung. Parallelaufrufe werden vermieden, Zeitüberschreitungen abgebrochen und Listener beim Abbau entfernt.
- Bei einer abweichenden Version erscheint ein verständlicher Hinweis mit einer Aktion zum Neuladen. Es erfolgt kein automatisches Neuladen, keine Abmeldung und kein Löschen lokaler Einstellungen. Die vorhandenen Schutzmechanismen für ungespeicherte Eingaben bleiben wirksam.
- HTML und SPA-Einstiegsadressen werden revalidiert. Unveränderliche Cache-Regeln für die bestehenden statischen Ressourcen bleiben bestehen.
- Offlinezustände, HTTP-Fehler, fremde Skripte, mehrdeutige Bundles und HTML ohne CareSuite-Bundle lösen keinen Updatehinweis aus. Der Versionsabruf übermittelt keine Sitzungscookies.

## Grenzen

Diese Korrektur betrifft die Auslieferung bereits veröffentlichter Änderungen. Sie ergänzt kein neues Desktopdesign und aktiviert keine offenen Fachfunktionen. Der Dokumentenkatalog aus PR #52 ist weiterhin nicht integriert bzw. produktiv aktiviert; die anderen offenen PRs werden dadurch nicht als erledigt ausgegeben. Bodymap und Modulauswahl werden entsprechend dem späteren Nutzerauftrag nicht wiederhergestellt. Android-Code und produktive Geschäftsdaten werden nicht geändert.

## Nachweise

- Bestehende angemeldete Produktivansicht vor und nach dem vollständigen Neuladen tatsächlich betrachtet; Headerreihenfolge und Bundle-Namen unterschieden sich.
- Sieben Node-Prüfungen der produktiven Erkennungslogik bestehen: gleiche/geänderte Versionen, öffentliche Abrufe, Fremd-/Schutzantworten, Abbruch und mehrdeutige Quellen. Diese Prüfungen belegen keine React-Darstellung und kein Browserlayout.
- JSON-Syntax, Vercel-Befehlslängen und sauberer Diff sind lokal geprüft. Die vollständige bestehende Vercel-Konfigurationsprüfung benötigt das hier nicht installierte `expo-router`; sie wird im vorhandenen Produktionsbuild ausgeführt. Es wird keine zusätzliche lokale Software installiert.
- Web-Build sowie abschließende Prüfung der tatsächlich zugewiesenen Produktionsdomain stehen beim Erstellen dieses Berichts noch aus. Der Updatehinweis selbst wurde noch nicht über einen zukünftigen Versionswechsel im Browser ausgelöst.
