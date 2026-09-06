# CareSuite Portal-Update mit Startintro, Benachrichtigungen und Gerätespeicher

Stand: 6. September 2026. Basis ist der ausgelieferte Stand `5dbcecbb55ce43812867db6d73b9d7089b6af364` (AAB 34, App 0.3.6). Änderungsbranch: `fix/portal-start-intro-20260906`.

Die Änderungen sind im Quellcode umgesetzt und lokal geprüft. Die unten beschriebene Serverinstallation und ein neuer produktiver Android-AAB sind noch erforderlich. Dieses Paket veröffentlicht nichts bei Google Play und hat keine produktiven Daten oder Zugangsdaten verändert.

## Enthaltene Änderungen

| Bereich | Verhalten im neuen Stand |
| --- | --- |
| Startintro | Bei jedem vollständigen App-Neustart acht Sekunden CareSuite Health OS mit neuem Ton; sechs Smartphone-/Tablet-Formate lokal eingebunden. Biometrie und Dialoge folgen danach. |
| Gerätespeicher | Kontogebundene Einsatzlisten und bereits geladene Details auf Android im geschützten nativen Speicher. Häufig gelesene Ansichten erhalten zusätzlich einen begrenzten Arbeitsspeicher-Cache. |
| Schnellere Einsätze | Gespeicherte Ansichten zuerst anzeigen, parallel den Server abfragen; dieselbe laufende Anfrage zusammenfassen. Die nächsten Mitarbeitendeneinsätze werden verzögert vorgeladen, damit die aktuelle Ansicht Vorrang hat. |
| Klienten-Vorschau | Basisdaten erscheinen vor einer langsameren GPS-Zusatzabfrage. Alte gespeicherte GPS-Positionen werden nicht als aktuelle Position ausgegeben. |
| Hintergrund | Android-Hintergrundauftrag für die Liste und bis zu zwei kommende Einsatzdetails; gültige Portal- und Serversitzung erforderlich. Keine automatische Änderung von Zeiten, Unterschriften oder Dokumentation durch diesen Auftrag. |
| Entwürfe | Aktualisierungen ersetzen keine laufenden Eingaben. Auch ein absichtlich geleertes Dokumentationsfeld bleibt leer. Beim Wechsel des Einsatzes wird die Eingabeansicht für den neuen Einsatz aufgebaut. |
| Nachrichten | Gemeinsamer Navigationskontext für Gesprächsliste und Chat, korrekte Gesprächszuordnung und Öffnung der neuen Nachricht. Kontowechsel verwirft den vorherigen Gesprächskontext. |
| Tastatur | Tastaturgerechte Scrollansichten für Login, Formulare, Modale, Chats und Einsatzansichten; fokussierte Eingaben sollen im verfügbaren Bildschirmbereich bleiben. |
| Klientenansichten | Lesbare dunkle Überschriften, normale Wortumbrüche, korrigierte Portalbezeichnungen, weniger doppelt reservierter Platz unterhalb der Inhalte. |
| Erklärungen | Gefüllte Hilfebereiche und ein Roboter mit Info-Schaltfläche: Erklärung erst nach Antippen. |
| Offene Unterschriften | Gemeinsame Hinweise für Leistungsnachweise und Dokumentenanfragen: Anzahl, dauerhafter Einstieg, Popup und direkter Weg zur offenen Unterschrift. Popup-Schließen erledigt keine Unterschrift. |
| Anmeldung merken | Freiwillig gespeicherte Anmeldung im geschützten Gerätespeicher. Entsperren über die vom Gerät unterstützte Systembiometrie. Kein eigenes Gesichtserkennungssystem. |
| Automatische Pushs | Serverwarteschlange für sichtbare Einsatzänderungen, empfangene Nachrichten, freigegebene Nachweise/Dokumentenanfragen und explizit als verfügbar markierte Play-Updates. Antippen öffnet das passende Portalziel nach der Anmeldung. |
| Kontentrennung | Cache, späte Serverantworten, Benachrichtigungsziele und vorgemerkte Aktualisierungen sind an Konto/Mandant gebunden. Abmelden stoppt Vorladen und Hintergrundregistrierung und räumt den Offline-Speicher auf. |

Aufgaben bleiben freiwillig. Dokumentation und Unterschrift vor Ort beziehungsweise die Freigabe an das Klientenportal bleiben der Abschlussweg. Die Body Map ist kein Teil des Einsatzprozesses.

## Was bereits geprüft wurde

- Gesamter Vitest-Lauf des vorherigen Standes `659cc334`: **6.530 bestanden, 0 fehlgeschlagen, 3 ausgelassen**. Die drei ausgelassenen Tests benötigen einen Live-Supabase-Zugang; hier wurden keine Zugangsdaten eingesetzt.
- Nach dem Austausch auf Intro 1.3: 103 gezielte Portal-/Intro-Prüfungen bestanden, darunter 16 Introtests einschließlich aller Formate und des Übergangs zur Biometrie.
- Alle sechs neuen Videodateien werden im Android-Export gegen das Manifest der Fassung 1.3 geprüft. Die Quelle ist die aktuelle achtsekündige HTML-Vorschau; die gleichzeitig gelieferte ZIP enthielt noch die alte Fassung.
- TypeScript erneut bestanden; ESLint der geänderten Codebereiche erneut bestanden. Der vorherige vollständige ESLint-Lauf war ebenfalls erfolgreich.
- Zusätzliche PostgreSQL-Prüfung der Push-Migration in einer isolierten PGlite-Datenbank: **10 bestanden**, einschließlich Kontenzuordnung, Zustellung, Wiederholungen und Rechteabgrenzung.
- Android-API-36-Audit und bestehendes Android-Sicherheitsaudit bestanden.
- Aktueller Android/Hermes-Portalexport und Exportaudit bestanden: 29,5 MB Laufzeitdateien, alle sechs neuen Videos nachgewiesen und keine alten Sechs-Sekunden-Videos enthalten. Verwaltungsquellen und Desktop-Assets ausgeschlossen.
- Der Offline-Abgleich mit den installierten Expo-SDK-Abhängigkeiten meldet passende Versionen. Expo Doctor konnte in dieser Umgebung seine Online-Prüfung nicht abschließen; dafür wird kein bestandener Online-Lauf behauptet.
- Die neuen Serverfunktionen wurden zusätzlich gegen lokal vorhandene Supabase-Typen geprüft. Die Prüfung mit den entfernten Deno-Import-URLs war durch den Netzwerkzugriff blockiert.

Diese Prüfungen ersetzen keinen Gerätetest über Google Play: Gesicht/Fingerabdruck, Tastatur, FCM-Zustellung, Hintergrundbedingungen und der vollständige reale Einsatzabschluss müssen mit dem neuen AAB geprüft werden.

Details zum Intro und dessen Gerätetest stehen zusätzlich in `STARTINTRO.md` im Paket beziehungsweise `docs/store/releases/20260906-app-start-intro.md` im Projekt. Das Intro benötigt wegen der neuen nativen Video-Abhängigkeit einen neuen AAB; es wird nicht durch eine reine Web-Aktualisierung installiert.

## 1. Quellcode übernehmen

Bei Verwendung des Änderungspakets dessen `installieren.sh` mit **bash** ausführen. Es importiert das Git-Bundle über `FETCH_HEAD`, damit kein bereits ausgecheckter Branch überschrieben wird. Der bestehende Produktbranch bleibt erhalten. Das Bundle enthält den vollständigen Änderungsstand einschließlich des Startintros. Es kann sowohl auf den ausgelieferten AAB-34-Quellstand als auch auf das vorherige Portal-Update `144cd259` oder die ältere Intro-Einbindung `659cc334` angewendet werden. Das ältere Paket muss nicht zusätzlich installiert werden.

Im Projektordner danach:

```bash
npm ci
npm run audit:portal-update
npm run audit:portal-push:db
```

Die Befehle sind für Git Bash. JavaScript-Auszüge gehören nicht direkt in den Bash-Prompt. Die mitgelieferten Skripte werden mit `bash scripts/NAME.sh` ausgeführt, nicht mit `source`.

## 2. Push-Server installieren

Das Startintro, die App-Bedienung und der Gerätespeicher benötigen keine neue SQL-Migration. Bereits erfolgreich abgeschlossene Push-Einrichtung muss nicht wiederholt werden. Der automatische Push-Versand benötigt die folgenden Schritte im **Supabase-Projekt `euagyyztvmemuaiumvxm`**.

1. Im Supabase-SQL-Editor den vollständigen Inhalt von `supabase/migrations/20260906160000_portal_automatic_push.sql` **einmal** ausführen. Die Migration läuft in einer Transaktion und lässt den automatischen Versand zunächst ausgeschaltet. Keine alten Migrationen erneut ausführen.
2. `scripts/sql/verify_portal_push_installation.sql` ausführen. Die erste Ergebniszeile soll nur `true` enthalten. `versand_aktiv` und `dienst_geschuetzt` dürfen vor der Aktivierung noch `false` sein.
3. In Git Bash im Projektordner die drei Serverfunktionen installieren:

```bash
bash scripts/deploy-portal-push-functions.sh
```

Das setzt eine vorhandene Supabase-CLI-Anmeldung voraus. Falls nötig, einmal `npx --yes supabase@2.116.0 login` ausführen. Es werden nur `portal-push-dispatch`, `portal-push-register` und `office-push-send` in das oben benannte Projekt installiert.

4. Die Android-Push-Konfiguration im zugehörigen EAS-Projekt prüfen: FCM-v1-Dienstkonto und passende `google-services.json`. Bestehende funktionierende Konfiguration weiterverwenden. Der Google-Play-Signierschlüssel kann sich vom Upload-Schlüssel unterscheiden. Anleitung: [Expo: FCM-Zugangsdaten](https://docs.expo.dev/push-notifications/fcm-credentials/). Bei aktivierter zusätzlicher Expo-Push-Zugriffssicherung benötigt der Worker außerdem `EXPO_ACCESS_TOKEN` als **Supabase-Serversecret**. Keine Dienstkontoschlüssel oder Service-Role-Keys in `EXPO_PUBLIC_*` eintragen.
5. Erst nach erfolgreicher Funktionsinstallation den Inhalt von `scripts/sql/enable_portal_push_dispatch.sql` im SQL-Editor ausführen. Dieser Schritt **aktiviert echte automatische Benachrichtigungen** an berechtigte registrierte Geräte. Ein interner Schlüssel wird in Vault erzeugt, nicht ausgegeben. Alle drei Abschlusswerte sollen `true` sein.

Die Migration legt keine neuen Geschäftsdaten oder Benutzer an. Ereignisse ab der Migration können in der Warteschlange stehen; beim Versand werden Zuordnung, Sichtbarkeit und Ablaufdatum erneut geprüft. Bereits offene Unterschriften erscheinen auch ohne historische Push-Nachlieferung im Portal als Hinweis/Popup.

Wenn die Migration manuell erfolgreich ausgeführt und geprüft wurde, die lokale Migrationshistorie nachtragen. Bei fehlender Verknüpfung zuerst das bekannte Projekt verknüpfen:

```bash
npx --yes supabase@2.116.0 link --project-ref euagyyztvmemuaiumvxm
npx --yes supabase@2.116.0 migration repair 20260906160000 --status applied --linked
```

`migration repair` führt kein SQL aus und darf deshalb nicht an die Stelle von Schritt 1 treten. Kein pauschales `db push` über ungeprüfte ältere Migrationsstände verwenden.

Für eine Pause des automatischen Versands `scripts/sql/pause_portal_push_dispatch.sql` ausführen. Bereits an Expo übergebene Benachrichtigungen lassen sich dadurch nicht zurückrufen. Die Geschäftsdaten bleiben erhalten.

## 3. Produktiven AAB bauen, ohne Veröffentlichung

```bash
cd "$HOME/CareSuite-Expo57" && bash scripts/build-portal-update-aab.sh
```

Das Skript prüft den sauberen Commit, TypeScript, die gezielte Portal-/Intro-Prüfung und den Android-Export einschließlich aller sechs lokalen Videos und startet ausschließlich `portal-only-aab` mit EAS CLI 23.2.0. Die App-Version bleibt 0.3.6; EAS erhöht den entfernten Android-`versionCode`. Die tatsächliche neue Nummer steht im Buildbericht.

Der Build läuft bei EAS weiter, auch wenn Git Bash geschlossen wird. Mit der angezeigten Build-ID prüfen:

```bash
npx --yes eas-cli@23.2.0 build:view BUILD-ID
```

Nach `finished` herunterladen:

```bash
bash scripts/download-portal-update-aab.sh BUILD-ID
```

Das Downloadskript prüft Profil, Android-Plattform, Status und Commit und schreibt den fertigen AAB nach Downloads. Bei `IN_PROGRESS` später denselben Downloadbefehl wiederholen; keinen zweiten Build starten. Der Download veröffentlicht nichts. Den AAB anschließend selbst in Google Play zum gewünschten Test bereitstellen.

## 4. Auf dem Google-Play-Gerät prüfen

Zuerst die App vollständig beenden und zweimal neu öffnen: bei jedem Neustart das achtsekündige Intro mit Ton; Biometrie und Portal-Hinweise erst danach. Auch im Flugmodus und in beiden Ausrichtungen prüfen. Wechsel in den Hintergrund beendet den Ton; normales Zurückkehren startet das Intro nicht erneut.

1. Im Mitarbeiterportal einen eigenen Einsatz öffnen, verlassen und erneut öffnen; gespeicherte Ansicht und spätere Aktualisierung prüfen. Bei gedrosseltem Netz darf der Inhalt beim Aktualisieren nicht ständig verschwinden.
2. Dokumentation ändern, auch vollständig leeren, dann eine Aktualisierung auslösen. Die Eingabe muss erhalten bleiben. Zum nächsten Einsatz wechseln: kein Text des vorherigen Einsatzes darf übernommen werden.
3. Im Klientenportal Einsatzvorschau, Hilfe, lesbare Überschriften und den freien unteren Bildschirmbereich prüfen; große Schrift und kleine Bildschirmbreite einschließen.
4. In beiden Portalen Login, Passwort, neue Nachricht, bestehendes Gespräch und längere Formulare mit offener Tastatur bedienen. Nachrichten aus Liste und Push müssen im richtigen Chat öffnen.
5. Anmeldung-Merken freiwillig einschalten, App neu starten und Systembiometrie prüfen. Abbrechen, gespeicherte Anmeldung entfernen und normal anmelden müssen weiterhin möglich sein.
6. Push erlauben, App in den Hintergrund legen und mit einem eigenen Testkonto einen Einsatz beziehungsweise eine Nachricht freigeben. Empfänger prüfen; interne oder fremde Inhalte dürfen nicht erscheinen. Push auch bei zuvor geschlossener App antippen.
7. Dem Kliententestkonto einen Leistungsnachweis und eine Dokumentenanfrage freigeben: Anzahl, Hinweis, Popup, Push und jeweilige Signaturansicht prüfen. Nach erfolgreicher Unterschrift muss der erledigte Punkt verschwinden. Dokumentation und Abschluss unverändert vollständig durchspielen.
8. Zwischen zwei Testkonten wechseln und abmelden: keine Vorschau, Nachricht oder Push-Navigation aus dem vorherigen Konto übernehmen.

Der Hintergrundauftrag fordert mindestens 30 Minuten Abstand an. Android plant den tatsächlichen Zeitpunkt; Batteriesparen, erzwungenes Beenden, fehlendes Netz oder eine abgelaufene Sitzung können ihn verschieben oder verhindern. Die Aktualisierung in der geöffneten App bleibt davon unabhängig. [Expo: BackgroundTask](https://docs.expo.dev/versions/latest/sdk/background-task/)

## Benachrichtigung über ein später verfügbares Play-Update

Ein erfolgreicher AAB-Build ist noch kein verfügbares Play-Update. Erst wenn das Update für die vorgesehenen Nutzer bei Google tatsächlich erhältlich ist, kann ein Administrator in `portal_app_releases` einen Android-Datensatz mit der **wirklichen** `version_code`, `version_name` und `available_on_play=true` eintragen. Dadurch wird ein Updatehinweis an registrierte ältere Geräte erzeugt. Der native Buildcode wird bei der Geräteregistrierung gelesen; die lokale App-Konfigurationsbaseline wird dafür nicht verwendet.

Keine Updatefreigabe beim bloßen Bauen setzen. Bei einem begrenzten Play-Testkreis die Freigabe nicht global aktivieren, solange andere registrierte Nutzer das Update nicht erhalten können.
