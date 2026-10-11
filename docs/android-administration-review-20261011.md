# Android-Verwaltung: Überarbeitung und Prüfnachweise

Basis: `release/android-0.4.0-20261009`, Commit `78e6f2c14b613271f044977b35f14b32bd8ee3c0`.
Änderungen: PR #49. Stand: 11. Oktober 2026. **Keine vollständige Geräte- oder Releasefreigabe.**

## Behobene gemeinsame Ursachen

- Zwei Desktop-Widgets pro Reihe bei normalen Handybreiten von 320 bis 480 Punkten; bei stark vergrößerter Schrift eine Spalte. Keine Skalierung der gesamten Arbeitsfläche.
- Kompakter Desktop-Kopf und Karten. Explizite lesbare Kartenfarben. Gespeicherte Auswahl, Reihenfolge und Mandantentrennung bleiben erhalten.
- Android-Status- und Navigationsleisten werden im zentralen Seitenrahmen berücksichtigt. Der schmale obere Rahmen stapelt Marke und Seitentitel und wächst mit der Systemschrift. Die Schließen-Aktion hat mindestens 44 Punkte.
- Native Arbeitsflächen und ihre Seitenköpfe verwenden den hellen Kontext der bestehenden Verwaltungs-Komponenten; der dunkle Web-Vertrag bleibt bestehen. Kein wirkungsloser übergeordneter Farbmodus, der durch untergeordnete Provider überschrieben würde.
- Eingebettete native Seiten bekommen die tatsächliche verfügbare Höhe. Die zusätzliche äußere Scroll- und Höhenberechnung entfällt. Nachrichteneditoren erhalten keine zweite geschätzte Mindesthöhe.
- Native Detailbereiche und Hauptaktionen bleiben auch auf dem Handy erreichbar; schmale Seiten stapeln den Zusatzbereich unter dem Hauptinhalt.
- Schmale Seitenköpfe geben Aktionen eine eigene Reihe. Native Buttons können mit langen Beschriftungen und größerer Systemschrift wachsen. Doppelte Anwendung der Android-Schriftvergrößerung entfällt.
- Modale Höhen berücksichtigen beide sicheren Bildschirmränder. Dialogtitel können auf Android umbrechen.
- Assist-Klientenfilter und Zeilen, Abrechnungsmodule, Klientenakten, Personalakte, Austrittsablauf, Monatsabrechnung und Kalendereinstellungen verlieren überbreite feste Mindestgrößen. Akten-Zusammenfassungen stehen auf schmalen nativen Flächen untereinander.
- Kalender startet auf einem schmalen nativen Bildschirm bei einer Monats-Voreinstellung mit der lesbaren Agenda. Die Monatsansicht bleibt wählbar. Kalenderlegenden, Planbarkeitsanzeigen und Profilinformationen erhalten größere native Beschriftungen. Profile werden vertikal statt in überhohen Reihen angeordnet.
- `/office/messages/[id]` verbindet die alte Nachrichtenliste mit ihrem zugehörigen bestehenden Detailpanel. Nachrichten-IDs werden nicht als IDs neuer Chat-Threads fehlinterpretiert.
- „Rechnung erstellen“, „Einsatz planen“, „Einsatzplan“, „Touren“ und „Verfügbarkeit“ erhalten konkrete passende Seitenziele. Verweise auf das nicht existierende relative Portal führen zum vorhandenen Angehörigenbereich; dessen Bereichsauswahl wird unterstützt.
- Schnellaktionen ohne hinterlegtes Ziel erscheinen deaktiviert und mit „nicht verfügbar“, statt einen wirkungslosen Klick anzubieten.

## Automatische Nachweise und Grenzen

- Native Bedienung und Navigationsmodell: **100/100 Tests bestanden**, darunter Klicks auf **43 tatsächliche native Menüeinträge**, Menüsuche, Schließen nach Navigation, Modulauswahl, Rechtefilter, Fehlerwiederholung, Mandantenwechsel, Speicherung und Widget-Geometrie mit mehreren Breiten und Schriftgrößen.
- Native Navigation, Speicherverhalten, Personalakte und Austritt zusammen: **123/123 bestanden** (überlappt mit den 100 oben, keine zusätzlichen 123 Tests).
- Zusätzliche Kalender-, Dashboard- und Routentests: **76/76 bestanden**.
- Breite vorhandene Prüfung: **1.148/1.155 Tests bestanden** in 156 Dateien. Sieben fehlgeschlagene Erwartungen und eine nicht ladbare Web-Testdatei sind mit der unveränderten Releasebasis verglichen und dort ebenfalls vorhanden. Keine Behauptung eines vollständig grünen Gesamtprojekts.
- TypeScript: vollständiger `tsc --noEmit` mit 6 GB Heap; Endprüfung unten im PR dokumentiert.
- Android-Export: Hermes-Bundle erstellt; endgültiger Exportstatus unten im PR dokumentiert. Dies ist kein signiertes AAB und kein Gerätetest.
- React-Prüfung: Hooks bleiben bedingungslos, neue Effekte haben vollständige Abhängigkeiten, bestehende Daten-/Berechtigungskontexte werden verwendet, Speicheroperationen bleiben nach Konto und Mandant getrennt, native Textgrößen werden nicht doppelt skaliert.

Die breite Prüfung enthält bestehende Vertragsprobleme: Web-Popup-CSS-Komponentenliste, Personal-Web-Kontrastvertrag, veraltete Arbeitszeit-/Composer-Quelltext-Erwartungen und `__DEV__` beim Web-Testimport. Diese sind keine neuen Regressionen dieser Änderung und bleiben offen.

## Seitenverknüpfungen

Der wiederholbare Prüflauf `node scripts/audit-administration-routes.cjs <optionale-json-datei>` verwendet die TypeScript-Syntaxbäume, Expo-Gruppenrouten und dynamische Routensegmente. Er startet beim Android-Verwaltungskatalog und verfolgt lokale Imports, Exports und erkennbare Navigationsziele.

- 82 Katalogeinträge.
- 1426 erfasste Verweisstellen inklusive Katalogziele; 0 davon ohne passendes Expo-Routenziel.
- 2 Pfadfamilien mit variabler Portalart passen zu vorhandenen Client-/Mitarbeitendenrouten.
- 153 Router-Aufrufe enthalten Variablen oder Funktionsaufrufe, die der statische Prüfer nicht auswertet. Sie sind ausdrücklich **nicht** als vollständig geprüft markiert.

Ein vorhandenes Routenziel beweist weder die inhaltlich richtige Aktion noch Berechtigungen, eine funktionierende Datenspeicherung oder optische Fehlerfreiheit. Die native Menüprüfung deckt die tatsächlichen Menü-Klickziele ab, nicht sämtliche Aktionen innerhalb jeder Seite.

## Offene Abnahme für den finalen Abschluss

1. Native Sichtprüfung aller unten aufgeführten Seiten auf Android: 320/360/390/412 Punkte, Tablet, größere Systemschrift, Status-/Navigationsleisten und offene Tastatur. Aktuell fehlt in dieser Umgebung ein Gerät oder Emulator; auch ein ausführbarer Browser steht nicht zur Verfügung. Ein vorbereiteter Browseraufbau wird deshalb nicht als Sichtprüfung gezählt.
2. Alle dynamischen Router-Aufrufe und die seiteninternen Abläufe mit vorbereiteten Testkonten und Daten durchgehen: Liste → Detail → Bearbeiten → Speichern/Abbrechen → Zurück, Filter, Dialoge, Datumsauswahl, Fehlerrückmeldung. Keine Tests an produktiven Mandantendaten.
3. Bestehende Platzhalterseiten für Monatsabschluss, Rechnungsläufe, Zahlungseingänge und Mahnwesen (`OfficeInvoiceExtensionScreens.tsx`) enthalten noch keine ausgeführten Fachabläufe. Ein vorhandener Seitenpfad macht diese Funktionen nicht fertig. Das bleibt ein eigener offener Befund.
4. Nach dieser Abnahme signiertes Android-Paket und Veröffentlichungsschritt vorbereiten. Es wurde kein AAB erstellt und nichts im Play Store veröffentlicht.

## Kataloginventar

„Ziel vorhanden“ bedeutet ausschließlich statische Routenexistenz. Die native Sicht- und Fachablauf-Abnahme bleibt für jeden Eintrag offen.

| Seite | Ziel | Statischer Status |
|---|---|---|
| Gmail | `/business/connect/google-workspace?service=gmail` | Ziel vorhanden |
| Kalender | `/business/connect/google-workspace?service=calendar` | Ziel vorhanden |
| Google Meet | `/business/connect/google-workspace?service=meet` | Ziel vorhanden |
| Google Drive | `/business/connect/google-workspace?service=drive` | Ziel vorhanden |
| Google Docs | `/business/connect/google-workspace?service=docs` | Ziel vorhanden |
| Google Sheets | `/business/connect/google-workspace?service=sheets` | Ziel vorhanden |
| Google Slides | `/business/connect/google-workspace?service=slides` | Ziel vorhanden |
| Google Tasks | `/business/connect/google-workspace?service=tasks` | Ziel vorhanden |
| Kontakte | `/business/connect/google-workspace?service=contacts` | Ziel vorhanden |
| Google Chat | `/business/connect/google-workspace?service=chat` | Ziel vorhanden |
| Workspace-Aktivitäten | `/business/connect/google-workspace?service=activity` | Ziel vorhanden |
| Entscheidungen | `/?area=decisions` | Ziel vorhanden |
| Office | `/office` | Ziel vorhanden |
| Unternehmen | `/business/office/dashboard` | Ziel vorhanden |
| Klient:innen | `/business/office/clients` | Ziel vorhanden |
| Personal | `/business/office/employees` | Ziel vorhanden |
| Arbeitszeit | `/business/office/time-tracking` | Ziel vorhanden |
| Gehaltsstatistik | `/business/office/payroll` | Ziel vorhanden |
| Rechnungen | `/business/office/invoices` | Ziel vorhanden |
| Dokumente | `/business/office/documents` | Ziel vorhanden |
| Nachrichten | `/business/messages` | Ziel vorhanden |
| Portale & Zugänge | `/business/office/portals` | Ziel vorhanden |
| Inventar | `/business/office/inventory` | Ziel vorhanden |
| Audit | `/business/office/audit-log` | Ziel vorhanden |
| Assist | `/assist` | Ziel vorhanden |
| Klient:innen | `/assist/zugeordnete-klienten` | Ziel vorhanden |
| Einsätze | `/assist/einsaetze` | Ziel vorhanden |
| Kalender & Einsatzplanung | `/assist/kalender` | Ziel vorhanden |
| Live-Status | `/assist/live-status` | Ziel vorhanden |
| Nachweise | `/assist/nachweise` | Ziel vorhanden |
| Budgets | `/assist/abrechnungsquellen` | Ziel vorhanden |
| Portale | `/assist/portale` | Ziel vorhanden |
| Robotics | `/robotics` | Ziel vorhanden |
| Geräte | `/robotics?area=devices` | Ziel vorhanden |
| Aufgaben | `/robotics?area=tasks` | Ziel vorhanden |
| Telemetrie | `/robotics?area=telemetry` | Ziel vorhanden |
| Wartung | `/robotics?area=maintenance` | Ziel vorhanden |
| Sicherheitszonen | `/robotics?area=zones` | Ziel vorhanden |
| Übergaben | `/robotics?area=handover` | Ziel vorhanden |
| Einstellungen | `/settings` | Ziel vorhanden |
| Organisation | `/settings/tenant` | Ziel vorhanden |
| Rollen & Rechte | `/business/office/permissions` | Ziel vorhanden |
| Integrationen | `/business/integrations` | Ziel vorhanden |
| Datenschutz | `/settings/data-request` | Ziel vorhanden |
| Vorlagen | `/business/templates` | Ziel vorhanden |
| Branding | `/settings/appearance` | Ziel vorhanden |
| Dashboard | `/business` | Ziel vorhanden |
| Reporting | `/business/reporting` | Ziel vorhanden |
| Module & Lizenzen | `/business/modules` | Ziel vorhanden |
| Google Workspace | `/business/connect/google-workspace` | Ziel vorhanden |
| Connect & Integrationen | `/business/connect` | Ziel vorhanden |
| Abonnement | `/business/subscription` | Ziel vorhanden |
| InsightCenter | `/insight` | Ziel vorhanden |
| Qualitätsmanagement | `/business/qm` | Ziel vorhanden |
| Betrieb & Monitoring | `/business/ops` | Ziel vorhanden |
| Klient:innen | `/office/clients` | Ziel vorhanden |
| Mitarbeitende | `/office/employees` | Ziel vorhanden |
| Arbeitszeit | `/business/office/time-tracking/live` | Ziel vorhanden |
| Rechnungen | `/office/invoices` | Ziel vorhanden |
| Dokumente & Unterschriften | `/business/office/documents/signatures` | Ziel vorhanden |
| Dokumentenablage | `/office/documents` | Ziel vorhanden |
| Kataloge | `/office/catalogs` | Ziel vorhanden |
| Klient:innen-Nachrichten | `/office/messages?audience=clients` | Ziel vorhanden |
| Mitarbeitenden-Nachrichten | `/office/messages?audience=employees` | Ziel vorhanden |
| Nachrichten | `/office/messages?audience=employees&view=chats&chatAge=new` | Ziel vorhanden |
| Broadcasts | `/office/messages?audience=employees&view=broadcasts` | Ziel vorhanden |
| Vorlagen | `/office/messages/templates` | Ziel vorhanden |
| Einstellungen | `/office/messages/settings` | Ziel vorhanden |
| Qualitätsmanagement | `/business/office/qm` | Ziel vorhanden |
| Office Reporting | `/business/office/reporting` | Ziel vorhanden |
| Benutzer & Portale | `/business/office/access` | Ziel vorhanden |
| Modulzuordnungen | `/business/office/modules` | Ziel vorhanden |
| Einsätze | `/assist/assignments` | Ziel vorhanden |
| Durchführung | `/assist/durchfuehrung` | Ziel vorhanden |
| Aufgaben | `/assist/aufgaben` | Ziel vorhanden |
| Fahrten | `/assist/fahrten` | Ziel vorhanden |
| Touren | `/assist/touren` | Ziel vorhanden |
| Kalender | `/assist/calendar` | Ziel vorhanden |
| Qualität | `/assist/qualitaet` | Ziel vorhanden |
| Einstellungen | `/assist/einstellungen` | Ziel vorhanden |
| Profil | `/settings/profile` | Ziel vorhanden |
| Support & Hilfe | `/support` | Ziel vorhanden |
