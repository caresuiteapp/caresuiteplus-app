# Assets Readiness — CareSuite+

**Stand:** 2026-06-13 (P0 Sprint)

---

## Referenzierte Dateien (`app.json` / `app.config.ts`)

| Datei | Zweck | Empfohlene Größe | Aktueller Status |
|-------|-------|------------------|------------------|
| `assets/icon.png` | App-Icon iOS/Android | 1024×1024 px | ✓ Buildfähig (temporär, Dark Premium C+) |
| `assets/splash-icon.png` | Splash-Bild | 1242×2436+ | ✓ Buildfähig (temporär) |
| `assets/favicon.png` | Web Favicon | 512×512 | ✓ Buildfähig (temporär) |
| `assets/android-icon-foreground.png` | Adaptive Icon Vordergrund | 1024×1024 | ✓ Buildfähig (temporär) |
| `assets/android-icon-background.png` | Adaptive Icon Hintergrund | 1024×1024 | ✓ Buildfähig (temporär) |
| `assets/android-icon-monochrome.png` | Android 13+ Monochrome | 1024×1024 | ✓ Buildfähig (temporär) |
| `assets/notification-icon.png` | Push-Vorbereitung | 96×96 | ✓ Vorhanden (preparedOnly) |

**Kennzeichnung:** Buildfähige temporäre Assets vorhanden. Noch nicht finale Brand-/Store-Assets.

---

## Generierung

```bash
node scripts/create-store-assets.mjs
```

Windows: `System.Drawing` erzeugt hochauflösende PNGs (Dark Space, Orange-Gold „C+“).  
Nicht-Windows: Fallback über `create-assets.mjs` (1×1 — nur Dev, nicht Store).

---

## Build-Readiness vs Store-Readiness

| Kriterium | Status |
|-----------|--------|
| Dateien existieren (Pfade auflösbar) | ✓ |
| `npm run store:audit` Asset-Größe | ✓ (kein 1×1-Warnung) |
| EAS/Metro Build technisch möglich | ✓ vorbereitet (EAS Login offen) |
| App Store Icon-Richtlinien (final) | ❌ temporäres Design |
| Google Play Adaptive Icon (final) | ❌ temporäres Design |
| Store-Screenshots | ❌ siehe `screenshots-plan.md` |

---

## Verdict

**Buildfähige temporäre Assets vorhanden. Noch nicht finale Brand-/Store-Assets.**
