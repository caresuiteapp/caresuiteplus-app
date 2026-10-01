# CareSuite HealthOS: Landingpage, Web/TV und QR-Anmeldung

Stand: 1. Oktober 2026. Dieses Änderungspaket ist lokal vorbereitet, nicht live veröffentlicht.

Basis des kumulativen Patches: `0d615418eb88dc87f005d7310ab8d69a4ec9b873` im Repository `caresuiteapp/caresuiteplus-app`.

## Enthaltene Änderungen

- Vollständige Landingpage unter `/landingpage`, einschließlich editierbarer Quelle, vorgerendertem HTML, interaktiver Darstellung und vorhandenen authentischen Demo-Aufnahmen. Link im Footer der Zugangsauswahl neben „Über CareSuite“.
- Web-Intro mit sichtbarer, fokussierbarer Startaktion für Maus, Touch, Tastatur und TV-Fernbedienung. Bestehende Videos bleiben im Bildformat erhalten. Medienfehler bieten einen Rückweg zur Anmeldung; interne Navigation startet das Intro nicht erneut.
- Größere Zugangskarten, Schrift und Schaltflächen für große Web-Fenster; sichtbarer Tastaturfokus und erreichbare Inhalte durch Scrollen.
- TV-Anmeldung unter `/device/tv`, erreichbar über „TV-Ansicht · mit dem Handy anmelden“. Drei Zugangsarten: Verwaltung, Mitarbeitende und Klient:innen. Pro Auswahl wird eine eigene kurzlebige Geräteanfrage erstellt.
- Handy-Freigabe unter `/device/confirm?code=…`. Nach der normalen Anmeldung für die gewählte Rolle wird die Kontrollnummer verglichen und der TV ausdrücklich freigegeben. Konto- und Passwort-Ersteinrichtung behalten Vorrang.
- Einmalige Ausstellung einer unabhängigen TV-Sitzung. Bei Portalen werden sowohl die Portal- als auch die Supabase-Sitzung angelegt. Abmeldung der markierten TV-Sitzung verwendet ausschließlich den lokalen Supabase-Scope.
- Web-spezifische Komponenten und Redirects; native Fallbacks öffnen die vorhandene Anmeldung. Die bestehende native Abmeldeweise bleibt erhalten.

## Bereitstellung

Das Paket enthält alle gegenüber der Basis geänderten Dateien sowie einen kumulativen Git-Binärpatch. Der Patch ist für das bestehende Repository bestimmt, kein eigenständiges App-Repository. Vor Anwendung den aktuellen Branch prüfen; neuere Änderungen bei Bedarf regulär zusammenführen. Keine bestehenden Arbeiten überschreiben.

1. Patch im bestehenden Repository mit `git apply --check` prüfen, anschließend übernehmen und reviewen. `package.json` und Lockdatei enthalten `qrcode-generator@2.0.4` als Laufzeitabhängigkeit. Die vorhandene CI führt die übliche Installation aus; es ist keine neue Testinfrastruktur vorgesehen.
2. `supabase/sql/tv_device_login.sql` über den bestehenden Migrationsprozess anwenden. Die Datei ist vorbereitet, hier aber ausdrücklich noch nicht angewandt. Sie legt ausschließlich die zwei neuen Pairing-Tabellen und zwei eng begrenzten Service-RPCs an.
3. Edge Function `tv-device-login` mit den vorhandenen `_shared`-Abhängigkeiten veröffentlichen. `supabase/config.toml` enthält ihre erforderliche JWT-Gateway-Konfiguration; Authentifizierung der Handyfreigabe erfolgt innerhalb der Funktion. Einzelheiten stehen in `supabase/functions/tv-device-login/README.md`.
4. Vorhandene Auth-Konfiguration auf gleichzeitig erlaubte Sitzungen prüfen. Der beabsichtigte Ablauf setzt voraus, dass eine neue TV-Sitzung die Handysitzung nicht durch eine projektweite Einzelsitzungsregel beendet. Diese Einstellung wurde hier nicht verifiziert oder geändert.
5. Web-App über den vorhandenen Vercel-/Git-Prozess bereitstellen. Ziel: `https://www.caresuiteplus.app/`; Landingpage: `https://www.caresuiteplus.app/landingpage`. Die Landingpage-Ausgabe liegt bereits in `public/landingpage`; der normale Expo-Build benötigt keinen zusätzlichen Marketing-Build.
6. Mit freigegebenen Testkonten alle drei Rollen zwischen Handy und TV vollständig prüfen: Anmeldung, richtige Rolle, Kontrollnummer, ausdrückliche Freigabe, Ablauf, Ablehnung, Zurück-Navigation und TV-Abmeldung. Außerdem Desktop/Full-HD/4K und schmales Handyfenster visuell prüfen.

Backend und Frontend zusammen ausrollen. Ohne Backend zeigt die neue Oberfläche einen Verfügbarkeitsfehler und keinen erfolgreichen QR-Zugang. Es wurden weder produktive Tabellen noch aktive Nutzersitzungen für Tests verändert.

## Sicherheitsgrenzen

QR-Codes enthalten ausschließlich den zufälligen öffentlichen Anforderungscode. Der separate Geräteschlüssel bleibt im TV-Browser; Zugangstoken erscheinen weder in QR/URL noch in der Pairing-Tabelle. Anforderungen gelten höchstens fünf Minuten und lassen sich nur einmal beziehen. Identität, Rolle, Mandant, Kontostatus und Ursprungssitzung werden serverseitig geprüft.

MFA-geschützte Konten einschließlich vorhandener App-MFA-Schalter werden für diesen QR-Transfer abgewiesen, damit die Ausstellung einer neuen Sitzung keine MFA-Vorgabe abschwächt. Für diese Konten bleibt die direkte Anmeldung erforderlich. Eine QR-Übernahme mit MFA ist nicht Bestandteil dieser Implementierung.

## Durchgeführte Prüfung

- 17 Backend-Tests: drei Rollen, ausdrückliche Zustimmung, falscher Geräteschlüssel, konkurrierende Freigabe/Übernahme, Ablauf, Ablehnung, Abbruch, widerrufene Ursprungssitzung, Ausstellungsfehler, Ratenbegrenzung, gesperrte Konten/Mandanten, MFA und Erstanmeldung.
- 8 Web-API-/Rückleitungs-Tests: nur interne kurzlebige Rücksprungziele, keine Tokens im QR, gültige Freigabe-Header, Fehler- und ungültige Antwortzustände.
- 8 Abmelde-Tests: Sitzung-ID-Bindung, lokale TV-Abmeldung, Token-Erneuerung, Reload, blockierter Speicher, andere Tabs und unverändertes natives Verhalten.
- TypeScript-Syntaxprüfung der betroffenen Dateien, bestehender Vercel-Konfigurationsaudit und `git diff --check`.
- Separater Landingpage-Build bereits erfolgreich geprüft; unveränderte erzeugte Ausgabe ist enthalten.

Die Backend-Tests verwenden injizierten Speicher und Issuer. Sie belegen nicht tatsächliche SQL-Rechte oder die Ausstellung durch GoTrue. Der vollständige Expo-Build, die vorhandene Vitest-Intro-Suite, die visuelle Prüfung der neuen TV-/Intro-/Handyansichten und der echte Zweigeräte-Ablauf sind noch offen. Zusätzliche Testinstallationen waren durch die Projektvorgabe ausgeschlossen.

## Veröffentlichungsblocker

Die verfügbare GitHub-Verbindung weist Schreibversuche für dieses Repository mit HTTP 403 zurück. Die bestehende Vercel-Verbindung hat ebenfalls keinen Zugriff auf den zugehörigen Team-Scope. Deshalb gibt es keinen neuen produktiven Deploy und keine angewandte Backend-Migration. Für die reguläre Veröffentlichung muss der bestehende Repository-Zugang mit den nötigen Schreibrechten verbunden werden; bei Git-basierter Vercel-Auslieferung reicht anschließend der vorhandene Deployment-Prozess.
