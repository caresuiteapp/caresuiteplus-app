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
2. Die auf dem Laptop erstellte Support-Vorschau verwendet die echten neuen UI-Komponenten und ausschließlich fiktive Daten. Der Nutzer hat die Übertragung zur Browserprüfung ausdrücklich freigegeben. Die Vorschau wurde erneut erstellt und vollständig übertragen (572.373 Byte JavaScript). Die Cloud-Browser-URL-Richtlinie blockiert jedoch das Öffnen der lokalen HTTP-Adresse und des synchronisierten Dateipfads. Die visuelle Prüfung ist daher weiterhin offen; keine Bildschirmgröße oder Browserinteraktion gilt dadurch als geprüft. Eine erneute Übertragungsfreigabe ist nicht erforderlich. Für die Sichtprüfung werden Screenshots der lokalen Vorschau benötigt. Auf dem Laptop ist sie über `%LOCALAPPDATA%\Temp\caresuite-support-preview\index.html` erreichbar.
3. Produktive Registrierung, Uploads und Support-Zugriffe sind noch nicht mit den neuen Serverfunktionen live getestet. Es wurden keine echten Mandanten zu Testzwecken angelegt oder verändert.
4. Der wiedergefundene Implementierungsstand ist lokal mit Commit `79dc2f2b1515771242550fc7141b1a89b982222f` auf `feature/desktop-platform-support-20260907` gesichert. Änderungen sind weder gepusht noch veröffentlicht. Nach abgeschlossener Prüfung ist eine ausdrückliche Veröffentlichungsfreigabe erforderlich; die lokale Projektregel untersagt automatische Deployments. Ein Push auf `main` kann bereits eine Veröffentlichung auslösen.

## Sichtprüfung anhand des Nutzerscreenshots – Support-Layout R2

Der bereitgestellte Screenshot zeigt die geladene Unternehmensansicht der ursprünglichen Support-Vorschau. Sichtbar waren abgeschnittene Statusfilter und ein großer Leerraum zwischen Filtern und Ticketliste.

Ursache: Der horizontale React-Native-Web-ScrollView verwendet standardmäßig `flexGrow: 1` und beanspruchte damit Höhe neben der eigentlichen Ticketliste. Die Filter liegen jetzt in einer normal hohen, umbrechenden Leiste; die Ticketliste behält ihren eigenen Scrollbereich.

Die vier bestehenden Support-Interaktionstests wurden nach der Änderung erneut erfolgreich ausgeführt. Auch die vollständige TypeScript-Prüfung wurde mit Exit-Code 0 abgeschlossen. Die Vorschau wurde neu erstellt und ist oben mit **Support-Layout R2** gekennzeichnet. Eine visuelle Bestätigung der korrigierten Ansicht, des geöffneten Tickets und der Support-Zentrale steht noch aus.

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
