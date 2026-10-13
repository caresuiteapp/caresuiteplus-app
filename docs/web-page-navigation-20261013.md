# Webnavigation, 13.10.2026

Die Aufnahme und die angemeldete Produktionsansicht bestätigen drei Fehler: Eine geöffnete Klientenakte änderte die Adresse nicht. Ihr Zurück-Pfeil wechselte in eine Vorschau. Das zentrale Schließen ersetzte den Verlauf durch den Desktop. Direkte Seitenaufrufe konnten außerdem während des verzögerten Navigatoraufbaus auf die Startseite fallen.

## Umsetzung

- Der ursprüngliche Dokumentaufruf einschließlich Query und Fragment wird vor dem Navigatoraufbau erfasst und bei verlorenem Startziel einmal wiederhergestellt. Authentifizierungs- und Rollenweiterleitungen behalten Vorrang.
- Die Web-Zurück-Funktion wird an sämtlichen bestehenden Router-Zurück-Aufrufen verwendet. Der nach Person, Rolle und Mandant getrennte Browserverlauf bleibt nach dem Neuladen verwendbar. Native Aufrufe werden unverändert an Expo weitergegeben.
- Zentrales Schließen kehrt zur vorherigen Seite zurück. Ohne Vorgänger wird die nächste vorhandene übergeordnete Seite aus allen 651 aktuellen Routenmustern ermittelt. Der Build prüft diesen Bestand gegen die tatsächlichen Routendateien.
- Klienten- und Mitarbeitendenakten erhalten wiederherstellbare Adressen. Verdeckte Listen können keine eigenen Detailfenster über die aktive Seite legen.
- Die registrierten Fenster erhalten einen im Tab gespeicherten Stapel mit Konten- und Mandantentrennung. Ihre Adresse verweist auf die passende Fassung des Stapels. Verdeckte Fenster bleiben montiert; Browser-Zurück und Schließen stellen den vorherigen Eintrag wieder her.
- Weitere Arbeitsbereiche, Reiter, Bearbeitungsabschnitte und adaptive Detailauswahlen speichern ihre Auswahl in der Adresse. Das betrifft unter anderem Personal, Rechnungen, Dokumente, Einsätze, Fahrten, Pflege, Beratung und Einstellungen.
- Die Web-Portalmenüs öffnen Seiten mit erhaltenem Verlauf. Die Rückkehr aus der Einsatzansicht verwendet denselben Vertrag.

## Prüfung

Die gezielten Navigationsprüfungen und die neuen React-Interaktionstests bestehen. Der Fenstertest verwendet tatsächliche React-Eingaben und belegt den Erhalt eines ungespeicherten Inhalts beim Verdecken und Wiederanzeigen. Er ist keine Layoutprüfung.

Der breitere Lauf meldete 3.836 bestandene Prüfungen. Zehn Fehlschläge wurden identisch im unveränderten Ausgangsstand a3e09440 reproduziert: neun ältere Desktop-Erwartungen und eine überholte Scroll-Strukturerwartung. Weitere Läufe wurden durch den vollen lokalen Datenträger sowie Worker-Zeitlimits beeinträchtigt. Die betroffenen Tests wurden gezielt wiederholt; ein breiter vollständig grüner Lauf wird deshalb nicht behauptet.

Ein erster TypeScript-Lauf mit ausgelassener Prüfung der Abhängigkeitstypen bestand. Der lokale Produktionsbuild brach bei der Bereitstellung vorhandener Sprachressourcen wegen ENOSPC ab. Der verbindliche Buildnachweis und die angemeldete Browserabnahme folgen über Vercel.

Produktive Testdatensätze, Uploads, Nachrichten oder Signaturen wurden für die Navigationsprüfung nicht erzeugt.

## Nachtrag: Schließen nach Neuladen

Die initiale URL-Wiederherstellung gilt einmal pro Browserdokument. Ein erneutes
Mounten des Routenbaums beim Zurückgehen darf die Einstiegsseite nicht erneut
öffnen. Explizites Zurück/Schließen und Browser-Back brechen eine noch ausstehende
Start-Wiederherstellung ab. Die Erstprüfung der URL erfolgt nach den Effekten der
Navigatoren und ihres Browserverlaufs, damit ein zunächst noch korrekter Link
nicht vorzeitig als wiederhergestellt gilt.

Regressionen prüfen den späteren Browserverlaufs-Commit, das erneute Mounten nach
Neuladen und den Vorrang von Browser-Back. Die angemeldete Produktionsprüfung
dieses Nachtrags steht bis zur Veröffentlichung noch aus.
