# Vollständige native HealthOS-App bauen

## Windows-Rechner mit Git Bash

Der aktuelle lokale Einstieg ist `bash scripts/build-healthos-full-gitbash.sh` im
geprüften nativen Releaseordner. Das bereitgestellte Git-Bash-ZIP importiert den
vollständigen Quellstand und ruft genau dieses Skript auf. Es startet keinen
GitHub- oder EAS-Cloud-Build. Unter Windows läuft der native Gradle-Wrapper
`gradlew.bat :app:bundleRelease`; EAS `build --local` wird dort nicht verwendet.

Die Vorprüfung benötigt die bereits vorhandenen Werkzeuge Git Bash, Node.js ab
20.19, npm, EAS CLI, ein vollständiges JDK 17, 21 oder 25 und Android SDK mit API 36,
Build-Tools 36.0.0, NDK 27.1.12297006 und CMake 3.22.1. Git-Bash-GNU-tar und unzip
werden mit ihren tatsächlichen Windows-Pfaden verwendet. Fehlende Werkzeuge
stehen gemeinsam in `.healthos-gitbash/PREFLIGHT.json`; das Skript richtet keine
zusätzliche Software ein und ändert in diesem Fall auch keine EAS-Version.
Die Suche prüft bestehende Java-Herstellerverzeichnisse, Android Studio und
Benutzer-JDK-Caches sowie mehrere SDK-Pfade. Ein vollständiges SDK wird vor
einem unvollständigen gefundenen Ordner ausgewählt. PREFLIGHT.json zeigt
öffentliche Suchpfade, erkannte Java-/SDK-Versionen und genaue fehlende
Paketkennungen; Signierdaten und Tokens werden dabei nicht ausgegeben. Bei
NDK und CMake werden auch Compiler, Toolchain und Ninja geprüft.
Gradle 9.3.1 aus der geprüften Expo-57.0.20-Vorlage kann JDK 25 verwenden.
React Native und Expo verlangen für ihre nativen Plugins jedoch ausdrücklich
`jvmToolchain(17)`. Die Vorprüfung ermittelt deshalb Gradle-Laufzeit und
vorhandene JDK-17-Compiler-Toolchain getrennt, einschließlich bestehender
Benutzer- und Projekt-Gradle-Caches. Vor dem Compiler wird der tatsächliche
Wrapper erneut geprüft. Nicht freigegebene JDK-Nachinstallationen sind durch
`org.gradle.java.installations.auto-download=false` abgeschaltet; der bekannte
JDK-17-Pfad wird ausdrücklich an Gradle übergeben.

`node scripts/prepare-healthos-local-sdk.mjs --plan` zeigt den begrenzten
Ergänzungsplan. Es installiert keine Werkzeuge. Nur nach ausdrücklicher Freigabe
kann `--setup-build-tools` die fehlende JDK-17-Compiler-Toolchain als offizielles
Eclipse-Temurin-Windows-x64-ZIP im Benutzerprofil ergänzen. Archivgröße, SHA-256,
Zielpfade sowie tatsächliche java-/javac-Version werden überprüft. Vorhandene
JDK-Verzeichnisse werden erhalten; Registrierung und globale Umgebungsvariablen
werden nicht geändert. Bereits vorhandene JDK-17-Toolchains werden verwendet.

Danach werden beim bereits vorhandenen SDK-Manager ausschließlich die fehlenden
Pakete `platforms;android-36`, `build-tools;36.0.0` und `ndk;27.1.12297006`
angefordert. SDK-Manager, CMake und andere Programme werden nicht heruntergeladen.
Abweichende SDK-Ziele oder teilweise angelegte Paketordner stoppen den Vorgang.
Lizenzfragen bleiben interaktiv. Die Einschränkung zur vorhandenen
Arbeitsumgebung in AGENTS.md gilt bis zur ausdrücklichen Freigabe dieser
konkreten Ergänzung weiter. Ein erfolgreicher Windows-Compilerlauf wird erst
durch das tatsächlich erzeugte und geprüfte signierte AAB belegt.

Mindestens 6.400 MiB Gesamtspeicher sind erforderlich. Der nachgewiesene
GitHub-Build nutzte 6 GiB Java-Heap auf einem 16-GiB-Runner; kleinere lokale
Speicherbudgets sind kein Nachweis für einen bereits erfolgreichen Windows-Build.

Nach erfolgreicher Vorprüfung wird die bestehende Expo-Anmeldung geprüft. Falls
`credentials.json` fehlt, im vorhandenen EAS-Dialog **healthos-full-aab** auswählen,
dann **credentials.json → Download credentials from EAS to credentials.json**.
Nur die bestehende Android-Signierung herunterladen. Kein neuer Schlüssel und
kein Uploadschlüssel-Reset. Alternativ kann `CARESUITE_CREDENTIALS_FILE` auf eine
bereits vorhandene lokale Datei im offiziellen EAS-Format zeigen. Keystore,
Alias und beide Passwörter bleiben lokal; Zertifikat und privater Schlüssel werden
vor der Kompilierung gegen die bestätigte Uploadidentität geprüft. Die privaten
Dateien sind von Git und EAS-Archiven ausgeschlossen.

Der aktuelle Android-Code wird aus EAS gelesen. In der folgenden EAS-Abfrage
exakt den vom Skript genannten nächsten Code eingeben. Lauf 13 hat Code 42
reserviert; ohne weiteren Build wäre der nächste Code 43. Maßgeblich ist die
frisch abgefragte Basis. Ein Wiederholungsaufruf verwendet die geprüfte lokale
Reservierung; ein inzwischen höherer EAS-Code führt zum Abbruch statt zur
Wiederverwendung einer fremden Version. Keine parallelen Produktionsbuilds
starten, während dieser lokale Build läuft.

Die vorhandene EAS-Umgebung **production** liefert die Live-Konfiguration.
Projektpakete werden mit `npm ci` aus dem unveränderten Lockfile geladen;
abweichende vorhandene Pakete werden nicht als Releasegrundlage übernommen.
App-Prüfungen, Export und Prebuild laufen im separaten, ignorierten Git-Worktree
`.healthos-gitbash/source`. Gradle-Cache und Ausgaben bleiben im gleichen lokalen
Arbeitsbereich erhalten. Ein erneuter Aufruf desselben Startbefehls nutzt sie.
Gradle darf die zuvor geprüften SDK-Komponenten nicht automatisch installieren.

Erst nach erfolgreicher Kompilierung und Prüfung erscheint
**AAB FERTIG UND GEPRÜFT**. Die Datei liegt dann unter
`.healthos-gitbash/release/CareSuiteHealthOS-0.4.0-codeNN.aab`, zusammen mit
`BUILD-INFO.json`, `SHA256SUMS.txt`, tatsächlichem R8-Mapping/Regeln und den
Compiler-/Schlüsselnachweisen. Paket, Version, Signatur, fünf native Kennungen,
alle sechs Originalvideos und die Originalschrift werden aus der tatsächlichen
AAB geprüft. Das externe R8-Mapping muss bytegenau zum signierten Mapping in
der AAB passen. Windows-Kompilierung und Gerätefreigabe sind erst durch ihren
tatsächlichen Durchlauf belegt.

Referenzen: [Direkter nativer Android-Release-Build](https://docs.expo.dev/guides/local-app-production/),
[Lokale EAS-Zugangsdaten](https://docs.expo.dev/app-signing/local-credentials/),
[Unterstützte lokale EAS-Buildsysteme](https://docs.expo.dev/build-reference/local-builds/).

## Vorhandener GitHub-Workflow

Der Workflow **CareSuite Android AAB** baut die vollständige native App 0.4.0 mit
Verwaltung, Desktop, Widgets, Registrierung und beiden Portalen. Das Profil ist
**healthos-full-aab**, der Router **app**, das Paket weiterhin **app.caresuitehealthos**.
Der durch den App-Inhaber belegte bisherige Play-Stand ist 0.3.7 mit Code 40.
Der neue tatsächlich gebaute AAB muss einen höheren Code haben.

## Geprüften Quellstand bereitstellen

Der Releasezweig heißt release/android-0.4.0-20261009. Ein normaler Push auf
diesen Zweig startet den Workflow automatisch. Änderungen auf main lösen
diesen Release-Build nicht automatisch aus. Für einen manuellen Start muss der
Workflow auf dem Standardzweig vorhanden sein; anschließend den gewünschten
veröffentlichten Releasezweig auswählen.

Wenn der Quellstand als Release-ZIP vorliegt, das gesamte Paket entpacken und
den darin enthaltenen Installer in der vorhandenen Bash-/Git-Bash-Shell mit
dem Pfad zum bestehenden CareSuite-Projekt starten. Er überprüft Projekt,
Prüfsumme, Commit und frisch abgerufenen Hauptzweig. Er importiert in ein
separates Arbeitsverzeichnis und erhält Änderungen im bestehenden Checkout.
Bei neueren Hauptzweig-Änderungen stoppt er für einen erneuten Abgleich.

## Bestehende Zugänge verwenden

Das vorhandene Repository-Secret **EXPO_TOKEN** muss Zugriff auf das bisherige
Expo-Projekt und dessen verwaltete Uploadsignierung haben. Das Projekt bleibt
567bda34-8356-4de8-9349-a0de3143567e. Die produktiven Servervariablen werden aus
der bestehenden Expo-Umgebung production gelesen und vor dem Build geprüft.
Ein fehlender Zugang oder eine fehlende Live-Konfiguration führt zum Abbruch.
Tokens gehören in die bestehenden Secrets, niemals in Quellcode oder Chat.

Der Build nutzt **eas build --local --freeze-credentials** auf dem GitHub-Runner.
Der Compiler läuft auf GitHub; es wird kein EAS-Cloud-Build gestartet. Die
bisherige Uploadsignierung wird verwendet. Ein Schlüsselwechsel ist kein
Bestandteil dieses Updates.

## Prüfen, bauen und herunterladen

Der Workflow führt TypeScript-, Android-, Portal-, Workflow- und
Aufgabenprüfungen aus. Anschließend prüft er API 36, Bild-/R8-Konfiguration und
einen frischen Android-Export gegen die aktuellen Quellen. Die erreichbaren
App-Routen müssen die nativen Implementierungen enthalten; eingebettete
WebView-/iframe-Oberflächen werden abgewiesen. Originalvideos und Schrift
werden anhand ihrer tatsächlichen Exportdateien geprüft.

Vor dem Build wird die zentrale EAS-Versionsbasis gelesen. Sie muss mindestens
40 sein. Das Profil erhöht den Versionscode; der AAB-Prüfer verlangt anschließend
einen Code über 40 und über der vor dem Build gelesenen EAS-Basis. Parallele
Produktionsbuilds werden durch den Workflow serialisiert.

Nach einem erfolgreichen Lauf unter
[CareSuite Android AAB](https://github.com/caresuiteapp/caresuiteplus-app/actions/workflows/android-aab.yml)
das Artefakt **CareSuite-HealthOS-AAB-…** herunterladen. Es enthält:

- CareSuite-HealthOS.aab;
- SHA256SUMS.txt für den AAB;
- BUILD-INFO.json mit Commit, Manifestversion, tatsächlicher Signatur und Medienprüfung;
- EAS-VERSION-BASELINE.json mit der vor dem Build gelesenen Version;
- R8-build-artifacts.tar.gz mit Mapping und tatsächlich zusammengeführten Regeln.

Der AAB wird gegen das bestätigte Uploadzertifikat
2D:44:96:38:4E:A1:60:C5:EB:6C:F1:86:2F:48:70:C1:CE:18:5C:8E:98:0C:8D:73:7C:34:E5:71:BF:A0:F5:B0
geprüft. Das davon getrennte Play-App-Signaturzertifikat und die vorbereiteten
App-Link-Dateien stehen in docs/store/android-signing-identity.json und
public/.well-known/assetlinks.json.

Die Artefakte bleiben sieben Tage verfügbar. Der Workflow reicht die App
nicht bei Google Play ein. Die historischen Portal-Skripte und Profile sind
kein Nachweis für den vollständigen 0.4.0-Build.

## Java-Speicher für den vollständigen R8-Build

Der tatsächliche Lauf 37871940756 hat alle 107 Portal-, 363 Android- und 376
Workflow-Prüfungen sowie den frischen Android-Export bestanden. Die native
Kompilierung erreichte R8, das mit 2 GiB Java-Heap und 512 MiB Metaspace wegen
`Java heap space` abbrach. `NODE_OPTIONS` vergrößert den Java-Heap nicht.

Der Workflow trennt jetzt App-Prüfung, Speicher-Einrichtung und Kompilierung.
Die Kompilierung verlangt die erfolgreiche Prüfung desselben unveränderten
Git-Commits. Ein eigener temporärer Gradle-Benutzerordner erhält das Budget:
6 GiB Heap bei mindestens 12 GiB verfügbarem Gesamtspeicher, andernfalls
4 GiB; cgroup-Grenzen werden berücksichtigt. Metaspace ist auf 1 GiB begrenzt,
der Parallel-GC aktiviert und maximal zwei Worker erlaubt (ein Worker auf
kleineren Runnern). Parallele Projektkompilierung ist ausgeschaltet. Zu kleine
Runner stoppen vor dem Build. Diese Limits betreffen den Compiler auf GitHub,
nicht das RAM-Budget der installierten App.

Ein Gradle-Init-Skript liest die tatsächlichen JVM-Flags und die effektiven
Worker-Einstellungen direkt im Compilerprozess. Ein ignoriertes Budget wird
vor der nativen Kompilierung abgewiesen. `BUILD-MEMORY.json` und
`GRADLE-MEMORY-VERIFIED.json` dokumentieren Planung und tatsächlichen Prozess;
die Daten werden auch bei einem späteren Buildfehler als Diagnose aufbewahrt.
Alle R8-, Ressourcen-, Signatur- und Medienprüfungen bleiben aktiv.

Die Konfiguration folgt den dokumentierten Gradle-Benutzereinstellungen und
Android-Empfehlungen zu Heap, Metaspace und Garbage Collector:
https://docs.gradle.org/9.3.1/userguide/build_environment.html
https://developer.android.com/build/optimize-your-build

Lauf [37878272375](https://github.com/caresuiteapp/caresuiteplus-app/actions/runs/37878272375)
mit Commit `ec438d8396eaab2ddbd9910e7d99cf58208f7fa1` hat danach den vollständigen
nativen Gradle-/R8-Build abgeschlossen: **BUILD SUCCESSFUL in 33m 11s**, 778
Tasks, tatsächlicher Heap 6.144 MiB, Metaspace 1.024 MiB und zwei Worker.
Die AAB wurde erstellt; JAR-Signatur und bisheriges Uploadzertifikat wurden
bestätigt. Die abschließende Artefaktprüfung brach jedoch ab: Das tatsächliche
Mapping war 125 MB groß, der bisherige Prüfer ließ nur 50 MiB zu. Zudem ersetzte
die Android-spezifische EAS-Artefaktliste den übergeordneten Wildcard und nahm
die erforderliche `configuration.txt` nicht mit.

Der korrigierte Prüfer liest Mapping-Dateien bis 512 MiB in begrenzten Blöcken,
prüft UTF-8/R8-Kennung und SHA-256 gegen das eingebettete AAB-Mapping. Die
Android-Artefaktliste übernimmt nun alle tatsächlichen Release-R8-Ausgaben.
Der primäre AAB wird durch EAS separat gesammelt. Fehlende, doppelte oder die
Optimierung abschaltende Regeln bleiben Fehler. Zehn Python-Artefaktprüfungen
und die entsprechenden Node-Prüfungen decken auch ein Mapping über 125 MB ab.
Im abgeschlossenen fehlerhaften Lauf wurde das Release-Artefakt nicht
hochgeladen. Seine AAB ist daher nicht zum Download verfügbar; aufbewahrt sind
nur die Compiler-Speichernachweise. Der lokale Build erstellt eine neue AAB.

## Geräte- und Play-Freigabe

Ein erfolgreicher Export belegt keinen signierten AAB und keine optische
Gerätefreigabe. Nach dem echten Build zuerst die bisherige 0.3.7-Installation
im internen Play-Test aktualisieren. Telefon/Tablet, beide Ausrichtungen,
große Systemschrift, Tastatur und die betroffenen nativen Abläufe prüfen.
Speicherverhalten und neuer Play-Vorabbericht müssen am tatsächlichen AAB
kontrolliert werden.

Der konkrete Quell-/Exportnachweis und die offenen Punkte stehen in
docs/store/releases/20261009-healthos-native-update.md. Zum Zeitpunkt seiner
Erstellung sind eine vollständig abgenommene und verfügbare Release-AAB,
Geräteprüfung und Play-Einreichung offen.
