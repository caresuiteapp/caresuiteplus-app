# Google Play – Update 0.3.1

**App:** CareSuite HealthOS

**Paket-ID:** `app.caresuitehealthos`

**Build:** Portal-only AAB

**Target:** Android 16 / API 36

**Stand:** 2026-09-02

## Unveränderliche Identität

- [ ] Der bestehende Play-Eintrag verwendet exakt `app.caresuitehealthos`.
- [ ] App-Signierung und Upload-Key gehören zum bestehenden Play-Eintrag.
- [ ] EAS-Projekt: `567bda34-8356-4de8-9349-a0de3143567e`.
- [ ] Nutzer-Version: `0.3.1`.
- [ ] EAS `appVersionSource` bleibt `remote`; der Remote-`versionCode` wird durch `autoIncrement` erhöht.
- [ ] Niemals einen zweiten Play-Eintrag mit `app.caresuiteplus` anlegen.

## Inhalt dieses App-Updates

- [ ] Portal-only: nur Mitarbeitenden- und Klient:innenportal, keine Office-/Business-/Admin-Oberflächen.
- [ ] Überarbeiteter mobiler Einsatzablauf ohne verdeckten Scroll-/Touchbereich.
- [ ] Geführter Einsatztag mit Mobilitätsauswahl, Anfahrt, Zwischenfahrten, Rückfahrt und Fahrtenbuch.
- [ ] Robuste GPS-Aufzeichnung mit Offline-Warteschlange und Wiederaufnahme.
- [ ] Dokumentation und Unterschrift bleiben Pflicht; Aufgaben sind optional.
- [ ] Klientenunterschrift kann zur Nachholung direkt ins Klient:innenportal gegeben werden.
- [ ] Foto-, Video- und Datei-Upload inklusive direkter Kameraaufnahme und Android-Wiederherstellung.
- [ ] Push-Mitteilungen mit neutralem Sperrbildschirmtext.
- [ ] Sicherheits-, Stabilitäts- und Portal-Isolationsprüfungen bestanden.

## Berechtigungen und Play-Erklärungen

- [ ] `POST_NOTIFICATIONS`: nur nach bewusster Aktion; wichtige Einsatzänderungen und Mitteilungen.
- [ ] `CAMERA`: direkte dienstliche Foto-/Video-Dokumentation.
- [ ] `RECORD_AUDIO`: Ton bei Videoaufnahme und freigegebene Sprachfunktionen.
- [ ] `ACCESS_COARSE_LOCATION` / `ACCESS_FINE_LOCATION`: Einsatz-, Ankunfts- und Fahrtennachweis.
- [ ] `ACCESS_BACKGROUND_LOCATION`: nur während einer vom Mitarbeitenden gestarteten dienstlichen Tages-/Fahrtaufzeichnung.
- [ ] `FOREGROUND_SERVICE` / `FOREGROUND_SERVICE_LOCATION`: sichtbare laufende GPS-Aufzeichnung.
- [ ] Play-Formular „App-Zugriff“ mit funktionierendem Reviewer-Demokonto ausfüllen.
- [ ] Play-Berechtigungserklärung für Hintergrundstandort ausfüllen.
- [ ] Kurzes Review-Video hinterlegen: Mobilität wählen → Fahrt starten → Systemdialog → sichtbare GPS-Mitteilung → Fahrt/Tag beenden.
- [ ] Prominente In-App-Erklärung vor der Android-Systemabfrage im Testvideo zeigen.
- [ ] Datenschutzerklärung verlinken und mit `privacy-data-map.md` abgleichen.

## Data Safety

- [ ] Personen-/Kontodaten, Gesundheits-/Versorgungsdaten und Nutzerkennungen angeben.
- [ ] Präzisen Standort sowie App-Aktivitäten/Einsatzereignisse angeben.
- [ ] Fotos, Videos, Audiodaten und Dokumente als nutzerinitiierte Uploads angeben.
- [ ] Push-Token/Device-Kennung angeben.
- [ ] Verschlüsselung bei Übertragung: ja.
- [ ] Zweck je Datentyp: App-Funktionalität, Sicherheit/Compliance und Kontoverwaltung – keine Werbung.
- [ ] Teilen/Weitergabe anhand der tatsächlichen Auftragsverarbeiter und Play-Definition final juristisch bestätigen.
- [ ] Lösch-/Auskunftsprozess und gesetzliche Aufbewahrungspflichten korrekt angeben.

## Technische Freigabe

- [ ] `npm ci`
- [ ] `npm run typecheck`
- [ ] `npm run portal-only:audit`
- [ ] `npm run android:api36:audit`
- [ ] `node scripts/store-readiness-check.mjs`
- [ ] Kritische Portal-, Workflow-, GPS-, Fahrtenbuch-, Medien- und Signaturtests ausführen.
- [ ] Portal-only Export erstellen und auf ausgeschlossene Office-/Business-Quellen prüfen.
- [ ] AAB mit Profil `portal-only-aab` bauen.
- [ ] Zuerst in den internen Track mit Profil `portal-only-internal` übertragen.

## Geräteabnahme vor Produktion

- [ ] Android Smartphone: Einsatzliste, alle Schaltflächen und Scrollbereiche.
- [ ] Android Tablet: Portrait und Landscape; kein leerer/deaktivierter Bereich oberhalb der Bottom-Navigation.
- [ ] App im Hintergrund/Display aus: GPS läuft mit sichtbarer Systemmitteilung weiter.
- [ ] Kein Standortzugriff vor Nutzerstart und nach Abschluss des Einsatztages.
- [ ] Flugmodus/Netzwechsel: GPS-Punkte und Medien werden nach Verbindung sicher fortgesetzt.
- [ ] Kamera, Galerie, Video mit Ton und Datei-Upload testen; dauerhaft verweigerte Rechte verständlich behandeln.
- [ ] Unterschrift direkt sowie über Klient:innenportal testen.
- [ ] PKW und Nicht-PKW-Mobilität testen; Fahrtenbuch nur im passenden Modus.
- [ ] Update-Installation über bestehender Store-Version ohne Datenverlust testen.

## Rollout

- [ ] Interner Track erfolgreich installiert und Smoke-Test dokumentiert.
- [ ] Pre-Launch-Report ohne Blocker prüfen.
- [ ] Erst danach Produktion mit gestuftem Rollout beginnen.
- [ ] Crash-, ANR-, Login-, GPS-, Upload- und Abschlussfehler beobachten.
