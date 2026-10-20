# 3D-Bodymap mit Git Bash bauen und deployen

## Voraussetzungen

- Git for Windows mit Git Bash
- Node.js und npm
- für Datenbankänderungen: Supabase CLI, Login und korrekt verknüpftes Projekt
- für direkten Vercel-Deploy: Vercel CLI/Login oder gültige CI-Umgebung
- `.env` enthält ausschließlich die vorgesehenen öffentlichen Expo-Werte;
  niemals einen `service_role`-Schlüssel im Frontend ablegen

## Sicherer Standardlauf

```bash
git switch feat/bodymap-3d-medical-20260725
bash scripts/deploy-bodymap3d-gitbash.sh
```

Dieser Lauf installiert exakt den Lockfile-Stand, prüft Git-Diffs, Modellmatrix,
Anatomieoberflächen und Tests und erzeugt den Produktions-Webexport
`dist-bodymap3d`. Er verändert weder die Remote-Datenbank noch GitHub oder das
Produktionshosting.

Nach bereits ausgeführtem `npm ci`:

```bash
bash scripts/deploy-bodymap3d-gitbash.sh --skip-install
```

## Datenbankmigration

Die Bodymap benötigt
`supabase/migrations/20260725083000_bodymap_3d_medical.sql`.
Vor jedem Apply zuerst den verknüpften Remote-Stand und alle ausstehenden
Migrationen prüfen:

```bash
npx supabase migration list --linked
```

Erst nach Backup/Staging-Prüfung:

```bash
bash scripts/deploy-bodymap3d-gitbash.sh --skip-install --apply-db --yes
```

`supabase db push` wendet nicht nur die Bodymap-Datei an, sondern alle lokal
ausstehenden Migrationen. Deshalb ist diese Option absichtlich nicht Teil des
Standardlaufs.

## Branch pushen

```bash
bash scripts/deploy-bodymap3d-gitbash.sh --skip-install --push --yes
```

Das Skript verweigert Push und Produktionsdeploy bei nicht eingecheckten
Änderungen. Die Freigabe erfolgt anschließend per Pull Request und Review.

## Direkter Vercel-Produktionsdeploy

Nach Merge, Datenbankmigration, medizinischem Review und Abnahme:

```bash
bash scripts/deploy-bodymap3d-gitbash.sh \
  --skip-install \
  --vercel-production \
  --yes
```

Ein Produktionsdeploy ist kein Ersatz für die fachmedizinischen Freigaben im
Modellmanifest. Solange dort Prüfpunkte `false` sind, bleibt die Darstellung ein
technischer Prototyp.
