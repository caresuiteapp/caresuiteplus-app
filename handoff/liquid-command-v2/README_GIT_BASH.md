# CareSuite HealthOS – Liquid Command V2

Dieses Übergabepaket übernimmt den Greenfield-Neuaufbau als einzelnen Commit in
den vorhandenen CareSuite-Stand. Bestehende Daten, Supabase-Migrationen und
Fachdienste bleiben erhalten; die neue Oberfläche liegt isoliert unter
`src/liquid-command` und `app/liquid-command`.

## Übernahme in den aktuellen Windows-Stand

1. Den beigefügten Bundle- und diesen `handoff`-Ordner gemeinsam entpacken.
2. Git Bash öffnen.
3. Das Installationsskript mit dem Pfad zum aktuellen Repository starten:

   ```bash
   bash install-liquid-command-v2.sh \
     "/c/Users/Kevin Reinhardt/CareSuite-Recovery/caresuiteplus-app" \
     "./caresuite-liquid-command-masterspec-v2-20260727.bundle"
   ```

Das Skript verlangt einen sauberen Arbeitsbaum, legt vor der Übernahme einen
Backup-Branch an, holt den Liquid-Command-Commit aus dem Bundle und übernimmt
ihn per `cherry-pick` auf den aktuell ausgecheckten Stand. Damit werden neuere
fachliche Änderungen im aktuellen Repository nicht durch einen Branchwechsel
ersetzt.

## Prüfung

Nach der Übernahme:

```bash
cd "/c/Users/Kevin Reinhardt/CareSuite-Recovery/caresuiteplus-app"
npm run liquid-command:audit
npx vitest run src/__tests__/liquidCommand/liquidCommandFoundation.test.ts
npx expo export --platform web
```

Der vollständige Repository-Befehl `npm run typecheck` enthält im gelieferten
Ausgangsstand bereits zahlreiche fachfremde Altfehler. Für Liquid Command selbst
werden zusätzlich der isolierte Audit, ESLint, die Foundation-Tests, der
Web-Export und die visuelle Vier-Größen-Prüfung verwendet.

## Start

```bash
npm run web
```

Der neue Einstieg ist `/`; alle neuen Routen liegen außerdem unter
`/liquid-command`.

## Optionaler Push

Erst nach fachlicher Abnahme:

```bash
bash deploy-liquid-command-v2.sh \
  "/c/Users/Kevin Reinhardt/CareSuite-Recovery/caresuiteplus-app"
```

Das Deploy-Skript pusht nur den bereits geprüften aktuellen Branch und verändert
keinen Zielbranch automatisch.
