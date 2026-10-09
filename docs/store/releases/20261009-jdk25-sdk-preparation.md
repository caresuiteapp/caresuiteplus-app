# Getrennte Gradle-Laufzeit und native JDK-17-Toolchain – Buildvorbereitung

Der Nutzer hat den Aufgabenfix erfolgreich importiert: nativer Gesamtstand
4501022e. Die Windows-Diagnose bestätigt ein vollständiges Android-Studio-JDK
25, CMake 3.22.1 und ein vorhandenes Benutzer-SDK, dem die vom Release verlangten
API-36-/Build-Tools-36.0.0-/NDK-27.1.12297006-Pakete fehlen.

## Tatsächlich erforderliche Java-Konfiguration

Die gesicherten Pakete Expo 57.0.20 und React Native 0.86.3 liefern Gradle 9.3.1.
Gradle unterstützt JDK 25 als Laufzeit ab 9.1. Eine pauschale Aussage, JDK 25 sei
mit dem vorhandenen Gradle inkompatibel, ist daher falsch. Daraus folgt jedoch
nicht, dass die vollständige native App mit ausschließlich JDK 25 gebaut werden
kann: Die tatsächlichen Settings-/React-Native-Plugins und ExpoModulesCorePlugin
setzen ausdrücklich `jvmToolchain(17)`. Die Compiler-Toolchain 17 muss vorhanden
sein. Auch eine vorhandene Gradle-Laufzeit 21 ersetzt diese Toolchain nicht.

Die Vorprüfung ermittelt beide Voraussetzungen getrennt. Bereits vorhandene
JDK-17-Toolchains in Hersteller-, Benutzer- und Gradle-Caches werden verwendet.
Nach dem Prebuild muss der tatsächliche Wrapper weiterhin Gradle 9.3.1 enthalten
und zur bestätigten JDK-Laufzeit passen. Gradle wird nicht aktualisiert.
SDK- und JDK-Nachinstallationen durch Gradle sind ausdrücklich abgeschaltet;
der bestätigte JDK-17-Compilerpfad wird an Gradle übergeben.

## Konkreter, bislang nicht freigegebener Ergänzungsumfang

| Komponente | Ziel |
| --- | --- |
| Portable JDK-17-Compiler-Toolchain, falls nach erneuter Suche weiterhin fehlend | Benutzerprofil unter .jdks/caresuite-temurin17-ARCHIVHASH/JDKORDNER |
| platforms;android-36 | Vorhandenes Benutzer-SDK |
| build-tools;36.0.0 | Vorhandenes Benutzer-SDK |
| ndk;27.1.12297006 | Vorhandenes Benutzer-SDK |

Das vorhandene Benutzer-SDK liegt unter
`C:\Users\Kevin Reinhardt\AppData\Local\Android\Sdk`.
CMake 3.22.1 mit Ninja ist bereits bestätigt. Andere installierte SDK-Versionen
werden erhalten; sie ersetzen die drei genauen Release-Pakete nicht.

AGENTS.md schränkt zusätzliche Software ausdrücklich ein. Deshalb ist die
Einrichtung vollständig vorbereitet, ihre Ausführung steht bis zur konkreten
Freigabe aus. `--plan` zeigt die vorhandenen Voraussetzungen und verändert keine
installierten Werkzeuge. `--setup-build-tools` ist ausschließlich nach Freigabe
der vier genannten Komponenten vorgesehen.

Das JDK wird als offizielles Windows-x64-JDK-17-Archiv von Eclipse Temurin
bezogen. Nur passende offizielle Metadaten und der offizielle Temurin-17-
Download werden akzeptiert. Größe und SHA-256 werden vor dem Entpacken geprüft.
Archivpfade, tatsächliche java-/javac-Version 17 sowie keytool/jarsigner werden
kontrolliert. Es wird ein neuer Benutzerordner verwendet; bestehende JDKs,
Registry und globale Umgebungsvariablen werden nicht verändert.

Beim vorhandenen SDK-Manager werden anschließend exakt die drei fehlenden
Paketkennungen angefordert. SDK-Manager, CMake und andere Programme werden nicht
neu geladen. Lizenzfragen bleiben interaktiv. Bereits unvollständig vorhandene
Zielordner führen zum Abbruch statt zum Überschreiben. Ist kein SDK-Manager
vorhanden, stoppt das Skript vor der Ergänzung. Nach Freigabe können die drei
Pakete im vorhandenen Android-Studio-SDK-Manager ergänzt werden; das Skript
verwendet anschließend die vorhandenen Dateien. Die bestehende Signierung wird
weiterhin erst im vollständigen Produktionsbuilder angefasst.

## Nachweise und Grenzen

Die Tests kontrollieren die tatsächlich gesicherte Expo-Gradle-Vorlage und die
Toolchain-17-Angaben der tatsächlichen nativen Build-Plugins. Ergänzungsabläufe
werden mit isolierten Dateien und kontrollierten Aufrufen simuliert, einschließlich
Prüfsummenfehler, falscher Provider/Version, ungültiger Archivpfade, erhaltener
eigener Dateien, nicht erteilter Freigabe und erfolgloser Teilinstallationen.
Es wurde keine Windows-Installation ausgeführt und noch kein neues AAB gebaut.
Die App-Laufzeitquellen, Paketversionen, Medien und Signierung des Aufgabenfixes
werden nicht verändert. Die 946 früheren vollständigen App-/Buildtests und der
Android-Export mit 700 Routen bleiben historische Nachweise. Der echte Build
führt die vollständige Prüfkette erneut aus.

Primärquellen:
- https://docs.gradle.org/current/userguide/compatibility.html
- https://docs.gradle.org/9.1.0/release-notes.html
- https://developer.android.com/tools/sdkmanager
- https://developer.android.com/studio/projects/install-ndk
- https://adoptium.net/installation/archives
