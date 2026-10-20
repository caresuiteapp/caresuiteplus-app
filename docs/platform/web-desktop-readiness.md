# Web & Desktop Readiness — CareSuite+

**Stand:** 2026-06-13

---

## Aktueller Stand

| Aspekt | Status |
|--------|--------|
| Expo Web Dev Server (`npm run web`) | ✓ Konfiguriert |
| Statischer Export (`expo export -p web`) | ✓ PASS (2026-06-13, 254 Routen → `dist/`) |
| Responsive Shells (Mobile/Tablet/Desktop) | ✓ Implementiert |
| DesktopShell (Sidebar, keine Bottom-Tabs) | ✓ |
| Web Auth (PKCE) | Dokumentiert in `web-desktop-security.md` |
| Tauri Desktop Wrapper | ☐ Phase 2, nicht gebaut |
| Production Hosting | ☐ Nicht deployed |

---

## Web-Konfiguration (`app.config.ts`)

- `web.bundler: metro`
- `web.output: static`
- `web.favicon: ./assets/favicon.png`

---

## Desktop-Strategie

Siehe `docs/platform/desktop-app-strategy.md`:

1. **Phase 1 (jetzt):** Expo Web + `DesktopShell` ab 1200px
2. **Phase 2:** Tauri-Wrapper um Web-Export
3. **Phase 3:** Enterprise-Distribution

---

## Export-Befehl

```bash
npx expo export --platform web
# Output: dist/
```

Hosting-Empfehlung: statisches CDN mit CSP (siehe `web-desktop-security.md`).

---

## Bekannte Web-Einschränkungen

- Nicht alle Screens haben Desktop-optimierte Layouts (nur Shell + 3 Master-Detail)
- Öffentliche Startseite ohne Desktop-Marketing-Layout
- Favicon/Assets: Platzhalter

---

## Verdict

**Web/Desktop-Basis vorbereitet** — Architektur und Export-Pfad existieren. Nicht production-deployed; Export-Ergebnis im EAS-Store-Build-Readiness-Report dokumentiert.
