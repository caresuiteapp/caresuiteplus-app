# CareSuite HealthOS Core – lokaler Android-Build

Diese Store-Edition enthält ausschließlich **Heute**, **Office**, **Assist**,
**Mehr**, das **Mitarbeitendenportal**, das **Klient:innenportal** und die
zugehörigen Anmeldewege. Ausgeschlossene Module werden in Navigation, Suche
und bei direkten Links blockiert.

## Voraussetzungen

- Windows 10/11 mit Git Bash
- Node.js und npm
- Android Studio
- JDK 17
- Android SDK Platform 35 und Android SDK Build-Tools

## Installierbare Test-APK ohne EAS

Im Repository aus Git Bash starten:

```bash
bash scripts/build-healthos-core-local-android.sh
```

Die APK wird anschließend hier abgelegt:

```text
release/android/CareSuite-HealthOS-Core-v0.1.1-code10-debug.apk
```

Die Debug-APK ist für Installation, Emulator, Smartphone und Tablet geeignet.
Sie ist nicht das Veröffentlichungsformat für Google Play.

## Veröffentlichung bei Google Play

Google Play benötigt ein signiertes Android App Bundle (`.aab`). Für die
bereits vorhandene Paketkennung `app.caresuiteplus` muss der bestehende
Upload-Schlüssel verwendet werden. Ein neu erfundener Schlüssel darf nicht
eingesetzt werden, weil Google Play das Bundle sonst zurückweist.

Der AAB-Build kann wahlweise über das vorhandene EAS-Profil
`healthos-core-aab` oder lokal nach sicherer Einbindung des bestehenden
Upload-Keystores erfolgen. Passwörter und Keystore-Dateien dürfen nicht in Git
eingecheckt oder im Chat übertragen werden.
