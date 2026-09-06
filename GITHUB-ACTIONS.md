# Android-AAB mit GitHub Actions

Der neue Standard-Build läuft auf einem GitHub-Linux-Runner. Er enthält den
aktuellen Portal-Stand und das achtsekündige Startintro 1.3 in sechs Formaten.
Der große EAS-Cloud-Upload vom Laptop entfällt.

## Voraussetzung: Quellcode auf GitHub

Der geprüfte App-Stand einschließlich dieser Einrichtung muss zuerst auf GitHub
bereitgestellt werden. Der Workflow muss auf dem Standardbranch `main` vorhanden
sein, damit GitHub die Schaltfläche zum manuellen Start anbietet. Ein nur lokal
installierter Stand ist auf GitHub noch nicht verfügbar.

Das Repository ist öffentlich. Die Veröffentlichung des derzeit nur lokal
vorhandenen App-Updates ist zum Zeitpunkt dieser Anleitung noch nicht erfolgt
und wartet auf die ausdrücklich angeforderte Freigabe. Der lokale Installer
dieses Einrichtungspakets führt keinen GitHub-Upload aus.

## Einmalig einrichten — nach Bereitstellung auf GitHub

1. Bei [Expo Access Tokens](https://expo.dev/settings/access-tokens) mit dem
   bisherigen Expo-Konto anmelden. Einen Token namens `CareSuite GitHub Actions`
   anlegen. Das Konto muss Zugriff auf das vorhandene CareSuite-Projekt haben.
2. In [GitHub: Actions-Secrets](https://github.com/caresuiteapp/caresuiteplus-app/settings/secrets/actions)
   auf **New repository secret** klicken. Name: **EXPO_TOKEN**. Den Expo-Token
   als Secret einfügen und speichern. Er gehört weder in eine Datei noch in den Chat.
3. [CareSuite Android AAB](https://github.com/caresuiteapp/caresuiteplus-app/actions/workflows/android-aab.yml)
   öffnen. **Run workflow** anklicken, den aktuellen veröffentlichten Branch
   auswählen und starten. Nach Übernahme aller Änderungen nach `main` diesen wählen.

## Bauen und herunterladen

Der Workflow prüft den Expo-Zugang, die produktive Serverkonfiguration,
TypeScript, die Portal-/Introtests und den Android-Export. Danach baut er einen
signierten **AAB**. Nach erfolgreichem Lauf den Downloadlink in der
Zusammenfassung oder unter **Artifacts → CareSuite-Portal-AAB-…** öffnen.

Die heruntergeladene ZIP enthält:

- `CareSuite-Portal.aab` für die vorhandene Google-Play-App;
- `SHA256SUMS.txt` zur Integritätsprüfung;
- `BUILD-INFO.json` mit Quellcode-Commit, Build-ID und Introprüfung.

Die Dateien bleiben sieben Tage auf GitHub verfügbar. Den AAB rechtzeitig lokal
sichern. Der Workflow veröffentlicht nichts automatisch bei Google Play.

Der bekannte Befehl im Projektordner bleibt:

```bash
bash scripts/build-portal-update-aab.sh
```

Mit installierter und angemeldeter [GitHub CLI](https://cli.github.com/) startet
er den Workflow für den aktuellen Branch. Er prüft, dass lokaler Commit und
GitHub-Commit übereinstimmen. Ohne GitHub CLI zeigt er den Link zum manuellen
Start. Der frühere `download-portal-update-aab.sh` ist ausschließlich für alte
EAS-Cloud-Build-IDs gedacht; neue AABs werden über GitHub heruntergeladen.

## Signierung, Live-Konfiguration und Versionsnummer

Der Workflow nutzt `eas build --local` auf GitHub. Expo stellt dabei die bereits
vorhandene verwaltete Android-Upload-Signierung bereit. Der eigentliche Build
läuft auf dem GitHub-Rechner und verbraucht kein EAS-Cloud-Build-Kontingent.
Es wird kein neuer Upload-Schlüssel erzeugt. Fehlende Berechtigungen oder
Signierungsdaten müssen im bestehenden Expo-Projekt korrigiert werden.

Das bisherige Profil `portal-only-aab` bleibt aktiv: Paket
`app.caresuitehealthos`, Produktionsmodus und `production`-Umgebung. Die dort
gespeicherten Variablen mit Sichtbarkeit Plain text oder Sensitive werden
übernommen. EAS-Variablen mit Sichtbarkeit Secret stehen lokalen Builds nicht
automatisch zur Verfügung; falls später solche benötigt werden, müssen sie
gezielt als GitHub-Secrets eingerichtet werden.

`versionCode` wird weiterhin zentral über Expo erhöht. Der abgebrochene
Cloud-Auftrag hatte bereits 35 reserviert; der nächste Build erhält den nächsten
verfügbaren Wert. Eine übersprungene Buildnummer ist normal. GitHub serialisiert
die AAB-Jobs; keine parallelen alten Cloud-Aufträge starten.

## Kosten und Fehler

Der Workflow verwendet den Standardrunner `ubuntu-24.04`. Solche Runner sind
bei öffentlichen Repositories kostenlos. Wird das Repository privat, gelten
die enthaltenen Minuten und Speichergrenzen des jeweiligen GitHub-Tarifs.
Die Sichtbarkeit des Repositories wird durch diese Einrichtung nicht geändert.

- `EXPO_TOKEN fehlt`: das Repository-Secret aus Schritt 2 speichern.
- Anmeldung/Projektzugriff fehlgeschlagen: Token des bisherigen Expo-Kontos prüfen.
- Live-Konfiguration fehlt: `production` in Expo prüfen; keine Dummywerte einsetzen.
- Signierung fehlt: bestehende Google-Play-Upload-Signierung in Expo prüfen.
- Roter Build: den ersten fehlgeschlagenen Schritt öffnen und dessen Meldung lesen.
- Kein Download: der Build muss erfolgreich abgeschlossen sein; abgelaufene
  Artefakte erfordern einen neuen Build.

Der erste native Build und der anschließende Gerätetest stehen noch aus.

Quellen: [Expo lokale Builds](https://docs.expo.dev/build-reference/local-builds/),
[Expo-Zugriffstoken](https://docs.expo.dev/accounts/programmatic-access/),
[GitHub Actions Abrechnung](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
