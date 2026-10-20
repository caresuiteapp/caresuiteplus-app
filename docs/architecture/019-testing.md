# CareSuite+ — Tests & Smoke-Check (Arbeitspaket 019)

## Ziel

Schnelle Integritätsprüfung ohne Unit-Test-Framework — für CI und lokale Vorab-Checks.

## Smoke-Check

```bash
npm run smoke
```

Führt `scripts/smoke-check.mjs` aus:

1. **Datei-Check** — Kern-Artefakte (Theme, Hooks, Services, Architektur-Docs, README)
2. **TypeScript** — `npm run typecheck` (`tsc --noEmit`)

Bei Fehler: Exit-Code `1` mit konkreter Meldung.

## Weitere Scripts

| Script | Zweck |
|--------|-------|
| `npm run typecheck` | Nur TypeScript |
| `npm run check` | Alias für `typecheck` |
| `npm run lint` | Expo ESLint |

## Bekannte Grenzen (nach WP 019)

- Keine Jest/Detox-Tests — Smoke-Check ersetzt nur Struktur- und Typ-Sicherheit
- E2E-Tests für Login-Flows folgen in späteren Paketen
