# SIS / Assessment HealthOS – Git-Bash

```bash
bash INSTALL-SIS-ASSESSMENT-HEALTHOS-GITBASH.sh \
  ./caresuiteplus-sis-assessment-healthos-v1-20260726.bundle \
  "$HOME/CareSuite-Recovery/caresuiteplus-app" \
  --verify-db
```

Produktiv nach Review:

```bash
bash INSTALL-SIS-ASSESSMENT-HEALTHOS-GITBASH.sh \
  ./caresuiteplus-sis-assessment-healthos-v1-20260726.bundle \
  "$HOME/CareSuite-Recovery/caresuiteplus-app" \
  --apply-db --push --vercel-production --yes
```

Enthalten: gemeinsamer Fachkern für Pflege und Stationär, sechs Themenfelder,
Risiken, fokussierte Assessments, Maßnahmen, BodyMap-Anbindung,
Freigabeworkflow, Versionierung, RLS und verlustfreie Altbestandsübernahme.
