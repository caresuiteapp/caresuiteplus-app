# CareSuite Desktop und Web – Arbeitsstand vom 07.09.2026

Die Änderungen liegen im separaten Arbeitsverzeichnis `C:\Users\Kevin Reinhardt\CareSuite-Desktop-20260907`, Branch `feature/desktop-platform-support-20260907`. Ausgangsstand ist `c5c6eb162e535b91bbf65b7c55aec83e5795b2f8`.

**Status: Implementierung vorbereitet, noch nicht veröffentlicht. Die vollständige Sichtprüfung im Browser steht aus.**

## Umfang

- Desktop-Raster passt seine Spaltenzahl an die tatsächlich verfügbare Breite und Textgröße an. Bilder behalten ihre Proportionen, Navigation und Inhalte können unabhängig scrollen.
- Web-Arbeitsflächen erhalten ein gemeinsames helles Farbsystem mit passenden Text-, Eingabe- und Fokusfarben. Der äußere Desktop behält seine dunkle Gestaltung.
- Die Startseite bietet die kostenlose Unternehmensregistrierung an. Der Ablauf enthält keine Modulauswahl; neue Unternehmen erhalten den vorgesehenen vollständigen kostenlosen Funktionsumfang.
- Die Unternehmensverwaltung enthält Suche, Status- und Umgebungsfilter, Registrierungsdatum und Seitennavigation. Filter werden vor der Datenbank-Paginierung angewendet. Die Web-Oberfläche zur einzelnen Modulaktivierung entfällt.
- Mandanten erhalten Support-Tickets mit Chat und privaten Dateianhängen. Die Plattform erhält die zugehörige Support-Zentrale.
- Zusätzlicher Support-Zugriff benötigt eine ausdrückliche Bestätigung der berechtigten Unternehmensverwaltung. Er gilt für einen benannten Mitarbeiter, ein Ticket, ausgewählte Rechte und eine begrenzte Dauer. Widerruf, Ablauf und Ticketabschluss sperren weitere Zugriffe serverseitig.
- Freigegebene Bearbeitung ist auf Unternehmensstammdaten und interne Einsatznotizen begrenzt. Einsatzstatus, Unterschriften und medizinische Daten werden darüber nicht geändert.

## Abgrenzung zur fertigen Android-App

Die bestehenden nativen Bildschirmdateien wurden unverändert belassen. Die überarbeiteten bestehenden Oberflächen liegen in `.web.tsx` beziehungsweise `.web.ts`-Varianten. Ein gesonderter Vergleich von 15 bestehenden Bildschirm- und Layoutdateien bestätigt unveränderte native Ausgangsdateien. Android-Konfiguration, `app-portal`, Android-Projekt, EAS-Konfiguration und Paketversionen wurden für diesen Auftrag nicht geändert. Es wurde kein neuer Android-Build gestartet.

Der gemeinsame Registrierungstyp erhielt nur ein optionales Zustimmungsfeld. Die Registrierung auf dem Server erhält eine atomare Anlage des Unternehmens; der fertige Android-Portalumfang enthält diesen Registrierungsablauf nicht.

## Nachgewiesene Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| Quellcode-Audit der gemeinsamen Seitenrahmen | 606 Produktrouten erfasst; keine fehlenden gemeinsamen Rahmen im Audit |
| Portal-, Cache- und Startintro-Regressionsprüfung | 103 Tests bestanden |
| Einsatzabläufe einschließlich Unterschriften | Vollständiger Testlauf erfolgreich; 326 Tests |
| Neue Raster- und Registrierungstests | 16 Tests bestanden |
| Support-Interaktion | 4 Tests bestanden: Entwurfserhalt, Wiederholung nach Sendefehler, Eingabesperre und ergänzter Anhang nach Sendefehler |
| Datenbankprüfung in isoliertem PostgreSQL/PGlite | 13 Prüfungen bestanden; echte neue Migrationen, synthetische Daten |
| TypeScript | Abschlusslauf erfolgreich, Exit-Code 0 |
| Vollständiger Expo-Web-Export | Abschlusslauf erfolgreich, Exit-Code 0 |

Die Datenbankprüfungen umfassen insbesondere Unternehmensanlage und Rollback, Wiederholbarkeit, Mandantentrennung, Zugriffsdauer und Widerruf, Bindung an den anfordernden Support-Mitarbeiter, erlaubte Felder, Konflikterkennung bei Änderungen sowie private Anhänge und konkurrierendes Senden/Entfernen.

Ein alter Quellcode-Test erwartete nur die frühere einzelne Sperrbedingung bei der Unterschriftenerfassung. Seine Erwartung wurde an die bereits vorhandene, stärkere Sperrbedingung der fertigen App angepasst. Der getestete App-Code wurde dabei nicht geändert.

## Noch offen

1. Browser-Sichtprüfung bei mehreren Bildschirmbreiten und Textgrößen; Anmeldung, Registrierung und Support-Endabläufe in einer Testumgebung. Der Quellcode-Audit ist **keine** Sichtprüfung aller 606 Seiten.
2. Die auf dem Laptop erstellte Support-Vorschau verwendet die echten neuen UI-Komponenten und ausschließlich fiktive Daten. Der Nutzer hat die Übertragung zur Browserprüfung ausdrücklich freigegeben. Die Vorschau wurde erneut erstellt und vollständig übertragen (572.373 Byte JavaScript). Die Cloud-Browser-URL-Richtlinie blockiert jedoch das Öffnen der lokalen HTTP-Adresse und des synchronisierten Dateipfads. Die automatisierte Browser-Sichtprüfung bleibt dadurch blockiert. Die Unternehmensansicht wurde inzwischen anhand der vom Nutzer bereitgestellten Screenshots beurteilt; der konkrete Umfang und die verbleibenden Prüfungen stehen im Abschnitt zur Sichtprüfung. Eine erneute Übertragungsfreigabe ist nicht erforderlich. Für die Sichtprüfung werden Screenshots der lokalen Vorschau benötigt. Auf dem Laptop ist sie über `%LOCALAPPDATA%\Temp\caresuite-support-preview\index.html` erreichbar.
3. Produktive Registrierung, Uploads und Support-Zugriffe sind noch nicht mit den neuen Serverfunktionen live getestet. Es wurden keine echten Mandanten zu Testzwecken angelegt oder verändert.
4. Der wiedergefundene Implementierungsstand ist lokal mit Commit `79dc2f2b1515771242550fc7141b1a89b982222f` auf `feature/desktop-platform-support-20260907` gesichert. Änderungen sind weder gepusht noch veröffentlicht. Nach abgeschlossener Prüfung ist eine ausdrückliche Veröffentlichungsfreigabe erforderlich; die lokale Projektregel untersagt automatische Deployments. Ein Push auf `main` kann bereits eine Veröffentlichung auslösen.

## Sichtprüfung anhand des Nutzerscreenshots – Support-Layout R2

Der bereitgestellte Screenshot zeigt die geladene Unternehmensansicht der ursprünglichen Support-Vorschau. Sichtbar waren abgeschnittene Statusfilter und ein großer Leerraum zwischen Filtern und Ticketliste.

Ursache: Der horizontale React-Native-Web-ScrollView verwendet standardmäßig `flexGrow: 1` und beanspruchte damit Höhe neben der eigentlichen Ticketliste. Die Filter liegen jetzt in einer normal hohen, umbrechenden Leiste; die Ticketliste behält ihren eigenen Scrollbereich.

Die vier bestehenden Support-Interaktionstests wurden nach der Änderung erneut erfolgreich ausgeführt. Auch die vollständige TypeScript-Prüfung wurde mit Exit-Code 0 abgeschlossen. Die Vorschau wurde neu erstellt und ist oben mit **Support-Layout R2** gekennzeichnet. Die drei anschließend bereitgestellten Nutzerscreenshots bestätigen die korrigierte Unternehmensansicht: alle sechs Statusfilter sind vollständig sichtbar, die Ticketliste beginnt direkt unter den Filtern, und der getrennte rechte Scrollbereich zeigt Ticketkopf, Nachrichten, Eingabe, Zugriffsfreigabe sowie Zugriffsprotokoll ohne erkennbare Überlagerung. Die Screenshots zeigen dieselbe Unternehmensansicht bei unterschiedlichen Scrollpositionen. Die drei später bereitgestellten Screenshots mit `?platform=1` bestätigen auch die Support-Zentrale in R2.1 bei der gezeigten Fenstergröße: Unternehmenszuordnung, Ticketübernahme und Abschluss, Nachrichten, Anfragegrund, Berechtigungen, Zeitwahl und Zugriffsprotokoll sind lesbar und über den rechten Scrollbereich erreichbar. Das doppelte Absenderpräfix ist sichtbar beseitigt. Andere Bildschirmbreiten und Textgrößen bleiben visuell ungeprüft. Die Bilder belegen die Darstellung mit fiktiven Daten, nicht die produktive Speicherung oder Berechtigungsprüfung.

In R2.1 entfällt außerdem das doppelte CareSuite-Präfix vor bereits entsprechend benannten Support-Absendern. R2.2 korrigiert die rollenabhängigen Hinweistexte: Die Support-Zentrale fordert Datenzugriff an; ausschließlich die berechtigte Unternehmensverwaltung bestätigt ihn. Auch der Hinweis beim Nachrichtenfeld unterscheidet jetzt Unternehmen und Plattform. Es handelt sich um Beschriftungsänderungen; die Berechtigungslogik wird nicht verändert.

Die Sichtprüfung der in den sechs aktuellen Screenshots gezeigten Support-Bereiche ist damit dokumentiert. Diese Prüfung umfasst keine reale Speicherung, Uploads, bestätigte Freigaben, andere Bildschirmgrößen oder die übrigen Desktop-/Web-Seiten.

## Angewendete Korrekturen für Registrierung und Unternehmensverwaltung – Web-Prüfung R3

Der Nutzer hat die Rückübertragung, Anwendung, Tests und Erstellung der lokalen Vorschau ausdrücklich freigegeben. Der Patch wurde auf ChristianLaptop im Projekt `CareSuite-Desktop-20260907` erfolgreich angewendet. Die zuvor blockierte Übertragung ist damit erledigt. Ausgangspunkt war `cbde8a81`; die Ausgangsdateien wurden zuvor über ihre Git-Blob-IDs abgeglichen.

Angewendet sind folgende Änderungen ausschließlich an Web-Bildschirmen:

- Registrierung wartet auf die Entwurfsladung, bevor Eingaben möglich sind. E-Mail, Website und Feldlängen werden im zugehörigen Schritt geprüft; der kostenlose Einstieg ist auch im Hauptbereich sichtbar. Passwortlängenhinweis und Kontrast des Datenschutzlinks sind korrigiert. Während der Registrierung ist die Schrittleiste gesperrt.
- Die Unternehmensliste beendet auch bei unerwarteten Ladefehlern ihren Ladezustand und bietet eine Wiederholung an.
- Unternehmensdetails werden bei einem Wechsel der ID neu initialisiert. Verspätete Antworten können die aktuelle Akte nicht überschreiben. Fehlende IDs und Verbindungsfehler werden angezeigt.
- Abgelehnte Sperrungen und Entsperrungen erscheinen nicht mehr als erfolgreiche Audit-Aktion. Mehrfaches gleichzeitiges Bestätigen ist gesperrt.
- Eine bisher ungeklärte Datenklassifizierung erfordert eine ausdrückliche Auswahl, bevor die Akte gespeichert werden kann.

Die acht neuen Interaktionstests in `src/__tests__/platformConsole/desktopCompanyFlows.test.tsx` und die sechs bestehenden Tests zur atomaren Unternehmensanlage bestehen: **14 Tests erfolgreich**. Der vollständige TypeScript-Lauf ist mit **Exit-Code 0** beendet. Der zusätzliche Starttest der fertig gebauten Vorschau hat Registrierung, Unternehmensliste, Unternehmensakte und Support ohne JavaScript-Fehler geladen; **vier DOM-Startprüfungen erfolgreich**. Dies ist keine optische Browserprüfung.

Die lokale Vorschau **Web-Prüfung R3** liegt unter `%LOCALAPPDATA%\Temp\caresuite-company-preview\index.html`. Sie enthält die echten Web-Bildschirme, den tatsächlichen Plattformrahmen und die Provider für Farben und Textgröße. Dienste und Anmeldung sind durch fiktive Daten ersetzt. Es gibt 53 Beispielunternehmen für Suche, Filter und Paginierung. Registrierungen und Änderungen erfolgen nur im Speicher der Vorschau und werden beim vollständigen Neuladen zurückgesetzt. Weitere Verwaltungsregister und die Anmeldung sind ausdrücklich als nicht enthalten gekennzeichnet; beim Support gelten die bisherigen Grenzen des synthetischen Adapters. Produktions-APIs sind im Vorschau-Build ausgeschlossen, Netzwerkverbindungen durch die Vorschau-CSP gesperrt.

Reproduzierbar mit `node scripts/build-company-preview.cjs` und `node scripts/verify-company-preview.cjs`. Der Starttest arbeitet ausschließlich mit einem lokalen DOM-Modell, ohne Browsernavigation, Screenshots oder Netzwerkzugriff. Die nächste optische Prüfung erfolgt weiterhin anhand der Nutzerscreenshots. Es wurde nichts gepusht oder veröffentlicht.

Bei der Prüfung wurde außerdem kein eigener Link zu Nutzungsbedingungen im bestehenden Registrierungsablauf gefunden; vorhanden ist der Datenschutzlink. Es wurden keine Rechtstexte erfunden oder ergänzt.

## Bestandteile einer späteren Veröffentlichung

Die folgenden vier neuen Migrationen müssen in dieser Reihenfolge und zusammen mit der aktualisierten Serverfunktion und Web-Version veröffentlicht werden:

1. `20260907170000_atomic_free_company_registration.sql`
2. `20260907171000_support_tickets_and_consent.sql`
3. `20260907172000_support_attachments_and_workspace.sql`
4. `20260907173000_platform_company_directory.sql`

Serverfunktion: `supabase/functions/register-business-tenant/` einschließlich `provision.ts`.

Die neue Support-Oberfläche setzt diese Datenbankfunktionen und den privaten Storage-Bucket voraus. Eine alleinige Veröffentlichung des Frontends würde dafür nicht ausreichen. Die Migrationen wurden bisher ausschließlich in der isolierten Prüfdatenbank ausgeführt.

## Reproduzierbare lokale Prüfungen

Im separaten Desktop-Arbeitsverzeichnis:

```powershell
node node_modules/typescript/bin/tsc --noEmit --pretty false
node node_modules/vitest/vitest.mjs run src/__tests__/layout/desktopResponsiveGrid.test.ts src/__tests__/auth/businessRegistrationProvision.test.ts src/__tests__/support/supportWorkspaceInteraction.test.tsx
node scripts/verify-desktop-support.cjs
npm.cmd run audit:portal-update
npm.cmd run audit:assignment-workflow-gate
$env:EXPO_PUBLIC_DEMO_MODE='false'
$env:EXPO_NO_TELEMETRY='1'
npx.cmd --no-install expo export --platform web
```

Diese Befehle veröffentlichen nichts. Die Browser-Vorschau lässt sich mit `node scripts/build-support-preview.cjs` lokal erstellen; sie ist kein Ersatz für die Prüfung der echten angemeldeten Web-Anwendung.
