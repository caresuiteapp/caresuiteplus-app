# Native Portalrender: Beleggrenzen und offene Abdeckung

Der neue Auftrag betrifft Verwaltung/Business, Mitarbeitende und Klient:innen einschließlich tatsächlicher Family-/Akademievarianten. Ein erfolgreicher Build oder viele Bilder bedeuten keine vollständige Seitenabnahme.

## Bestehender Beleg #140

Quelle `d1a3c45a7052acbb55d79a88bf07404a74ed2a16`, Artefakt `12634275408`, ZIP-SHA256 `f749df92a486c74722ba7e4c2d2212c20326da6f5084300089b03bbe17601a13`: 483 Prüfdatensätze und 799 PNGs. Die bekannten Einsatzzeilen-, Kalenderwortumbruch-, Kartenhöhen- und Kontrastkorrekturen sind in den genannten Einzelbildern sichtbar.

Der Renderer verwendet React Native Web mit synthetischen Daten. Er mountet bisher weder die tatsächliche RootShell noch die LiquidPortalRouteLayout-Kette. Klient:innen-Startseite, Mitarbeitenden-Klientenliste und Kalender setzen ihre PageFrames im Fixture manuell zusammen. Der Mitarbeitenden-Home-Screen enthält seinen tatsächlichen PageFrame, aber ebenfalls keine vollständige äußere Shell. `client-appointment` und `employee-execution-card` sind einzelne Karten statt der Detail-/Durchführungsseite. `family-home` hat keine entsprechende erreichbare native Route und zählt nicht als Portalbeleg.

**Vollständige Shell-Abnahmen aus dieser Matrix: 0.** Gerätestart, native Navigation, produktive Berechtigungen, Datenbankbestand und bestätigte Schreibabläufe bleiben gesonderte Nachweise.

## Erweiterung

Die zentrale `native-portal-route-matrix.json` liefert tatsächliche Android-Seiten, Layouts, Aliasse und Sperren. Die ergänzende Rendermatrix verknüpft ihre IDs mit tatsächlichen importierten App-Routen, Zustand, Rolle und Interaktion. Bestehende Komponentenbilder dürfen eine fehlende echte Seite nicht ersetzen. Gesperrte oder browsergebundene Bereiche werden dokumentiert und bleiben gesperrt.

Neue Fälle verwenden die vorhandenen esbuild-/Playwright-/CI-Werkzeuge. Die Modulauflösung muss Metro entsprechen: pro Extension zuerst Android-, dann Native- und generische Datei; in diesem Repository steht `.ts` vor `.tsx`. Tatsächliche Guard- und Layoutkomponenten erhalten ausschließlich synthetische Identitäten und explizite lokale Transportverträge. Ungeplante Netz- und Schreibzugriffe sind keine erfolgreichen Prüfungen.

Die vollständigen maschinenlesbaren Beleggrenzen und die direkt betrachteten Dateien stehen in `native-portal-render-evidence.json`.

## Vorbereitete tatsächliche Routen-/Shell-Matrix

`node scripts/verify-native-portal-audit.mjs --prepare-only` lässt sich nun ohne Browserinstallation vollständig bündeln: **65 Fälle für 55 unterschiedliche ausgewählte Android-Seitendateien** (Klient/Familie:22 Fälle/15 Dateien; Mitarbeitende:34/33; Verwaltung:9/7). Das ist eine vorbereitete Teilmenge der 692-Seiten-Inventur, keine vollständig gerenderte oder abgenommene App.

Der Einstieg verwendet die wirkliche `RootShell`, tatsächliche übergeordnete App-Layouts, echte Rollen-/Anmeldeguards und die ausgewählten Standard-Routenkomponenten. Navigator, Authidentität, sichere Geräteabstände und Daten-/Hardwaretransporte sind ausdrücklich kontrollierte Bindungen. Die äußere Startup-/Biometrie-/Push-Kette der RootLayout ist nicht Bestandteil dieser Darstellungsprobe.

Der Runner unterscheidet interne Renderfehler, unerwartet fehlende/umgeleitete Empfänger, noch nicht eingerichtete Datenverträge und reine Aufnahmen ohne fallspezifische Abnahme. Die native Abrechnungsseite, verweigerte Finanzberechtigung, nicht verfügbare Leistungsnachweise und das Fahrtenbuch haben zusätzliche konkrete Empfangstext-Prüfungen. Auch ein bestandener Text-/Strukturfall braucht anschließend die Bildprüfung.

Die echten gemeinsamen UI-Exporte werden benutzt; fehlende Exporte wurden nicht durch leere Platzhalter ersetzt. Die Signatur-/Nachrichtenaufmerksamkeit hat separate explizite Zustände `pending-signature` und `unread-message`, damit die normale Seite nicht unbemerkt vollständig von einem künstlichen Hinweis überdeckt wird. Die Familienrolle kann ausdrücklich über den Runnerparameter gewählt werden; die Grundmatrix allein beweist noch keine vollständige Familienrollenabnahme.

**Lokaler Ausführungsstand: Bündelung bestanden; noch keine neue Browser-/Pixelabnahme.** Der vollständige Renderer benötigt den bereits vorhandenen CI-Browser. Es wurde kein Browser installiert, kein produktiver Datenaufruf ausgeführt und keine Veröffentlichung gestartet.

Die Importzeit-Anbindung nativer Gerätepakete ist ebenfalls explizit: Taskdefinitionen dürfen nur lokale Callback-Definitionen anlegen; GPS, Picker, Biometrie, Pushregistrierung und andere aktive Geräteaufrufe werden verweigert und als `blocked-device-boundary` protokolliert. SQLite-KV und AsyncStorage sind isolierte In-Memory-Prüfbindungen, Crypto verwendet Browser-WebCrypto und die Konnektivität ist ein kontrollierter Prüfwert. Das belegt weder Gerätestabilität noch echte SQLite-Persistenz oder native Kryptographie. Ein Geräteaufruf ist im Ergebnis keine bestandene Gerätefunktion.

Die vollständigen Routen- und Backend-JSON-Inventuren werden aus dem jeweiligen Quellstand erzeugt (`audit-native-portal-route-matrix.mjs --write`, danach `audit-native-backend-dependencies.mjs --write`). Die Routeninventur wird mit den CI-Prüfbelegen aufbewahrt; diese großen, reproduzierbaren Ausgaben sind keine manuell gepflegte Freigabeliste.
