# Vollständige native HealthOS-App mit GitHub Actions bauen

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

## Geräte- und Play-Freigabe

Ein erfolgreicher Export belegt keinen signierten AAB und keine optische
Gerätefreigabe. Nach dem echten Build zuerst die bisherige 0.3.7-Installation
im internen Play-Test aktualisieren. Telefon/Tablet, beide Ausrichtungen,
große Systemschrift, Tastatur und die betroffenen nativen Abläufe prüfen.
Speicherverhalten und neuer Play-Vorabbericht müssen am tatsächlichen AAB
kontrolliert werden.

Der konkrete Quell-/Exportnachweis und die offenen Punkte stehen in
docs/store/releases/20261009-healthos-native-update.md. Zum Zeitpunkt seiner
Erstellung sind signierter AAB, Geräteprüfung und Play-Einreichung offen.
