# Windows Git Bash: bestehende Android-Werkzeuge zuverlässig erkennen

Ausgangspunkt: nativer Gesamtstand `944ec73510c394323877e4fc7e5e45a0db2973e2`.
Die vom Nutzer ausgeführte Prüfung fand Node 24.16, 15.973 MiB RAM und CMake
3.22.1, aber kein bestätigtes JDK 17/21 und keine bestätigten API-36-,
Build-Tools-36.0.0- oder NDK-27.1.12297006-Komponenten. Es wurde noch kein
lokales Release-AAB erzeugt. Diese Ausgabe belegt die ursprünglichen
Suchergebnisse; sie belegt nicht, dass andere Installationsverzeichnisse leer
sind.

## Korrektur

- Vorhandene Java-Verzeichnisse werden über JAVA_HOME, JDK_HOME,
  ANDROID_STUDIO_JDK, STUDIO_JDK, die bestehenden java/javac-PATH-Einträge,
  Android Studio, übliche JDK-Herstellerverzeichnisse sowie vorhandene
  Benutzer-JDK-Caches gesucht. Die Suche ist auf diese Verzeichnisse begrenzt.
- Java und javac werden mit `-version` tatsächlich abgefragt. java, javac,
  keytool und jarsigner müssen zusammen vorhanden sein. Ein ausdrücklich
  gesetztes, vollständiges JDK 17/21 bleibt bevorzugt; automatische Auswahl
  bevorzugt JDK 17. Andere Hauptversionen werden mit ihrem konkreten
  Ablehnungsgrund aufgeführt und nicht stillschweigend als releasegeprüft
  behandelt.
- SDK-Verzeichnisse werden aus ANDROID_HOME, ANDROID_SDK_ROOT, vorhandenen
  lokalen Projektpfaden, üblichen Windows-SDK-Pfaden und vorhandenen adb- bzw.
  sdkmanager-PATH-Einträgen ermittelt. Ein vollständig vorhandenes SDK gewinnt
  gegen einen früher gefundenen, unvollständigen Ordner.
- Die genaue vorhandene Versionsliste wird pro SDK aufgeführt. Die vier
  erforderlichen Paketkennungen sind `platforms;android-36`,
  `build-tools;36.0.0`, `ndk;27.1.12297006`, `cmake;3.22.1`.
- NDK erfordert außerdem den vorhandenen Compiler und die CMake-Toolchain;
  CMake erfordert auch Ninja. Ein leerer oder teilweise angelegter
  Versionsordner reicht nicht aus.
- PREFLIGHT.json zeigt die ausgewählten öffentlichen Pfade, alle gefundenen
  Java-Kandidaten, SDK-Versionen und genaue fehlende Bestandteile. Tokens,
  Signierpasswörter und Inhalte von credentials.json werden nicht gesammelt.
- Die ausgewählten Werkzeuge gelten für diesen Buildprozess. Windows-System-
  und Benutzerumgebungsvariablen werden nicht dauerhaft verändert. Keine
  JDK-, SDK-, NDK- oder andere Softwareinstallation wird ausgelöst.

## Weiterer Ablauf und Prüflücke

Der portable Importer akzeptiert den vorhandenen nativen Ordner auf dem
Ausgangsstand oder dem neuen geprüften Commit, schützt eigene Änderungen und
prüft den aktuellen main-/Release-Stand. Standardmäßig startet danach der
bestehende vollständige Windows-Git-Bash-Builder. `--check-only` prüft nur die
Werkzeuge, `--verify-only` nur den lokalen Quellimport.

Bei `ready: false` stoppt der Ablauf weiterhin vor EAS-Anmeldung,
Signierdaten-Download, Versionsreservierung und Paketladen. Eine vorhandene
unvollständige SDK-Installation wird nicht automatisch ergänzt. Bei
`ready: true` folgt der vollständige Produktions-Build mit vorhandener
Uploadsignierung und tatsächlichen AAB-/R8-Prüfungen.

Die 32 vorhandenen Build-/Signierungs-/R8-/Speicherprüfungen und 14 neue
Werkzeugsuch- und Abbruchprüfungen sind die gezielte Verifikation dieses
Updates. Die Suchfälle verwenden Windows-Dateistrukturen mit kontrollierten
Versionsabfragen; ein wirklicher Windows-Compilerlauf wird dadurch nicht
ersetzt. Die tatsächlichen Werkzeuge und das signierte AAB auf dem Laptop
bleiben bis zum erfolgreichen dortigen Build offen. Die App-Oberflächen,
nativen Routen, Medien, Registrierung und Backend-Anbindungen entsprechen
unverändert dem gesamten nativen Ausgangsstand; es wird keine Webansicht
ergänzt. Google Play wird nicht veröffentlicht.
