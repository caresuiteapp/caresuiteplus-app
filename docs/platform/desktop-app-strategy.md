# CareSuite+ — Desktop-App-Strategie

**Stand:** 2026-06-13

---

## Vergleich: Tauri vs. Electron

| Kriterium | Tauri 2.x (Option A) | Electron (Option B) |
|-----------|----------------------|---------------------|
| **Bundle-Größe** | ~5–15 MB | ~150–250 MB |
| **RAM-Verbrauch** | Niedrig (System-WebView) | Hoch (embedded Chromium) |
| **Security** | Rust-Backend, Capability-Model | Node + Chromium, mehr Angriffsfläche |
| **Auto-Update** | Tauri Updater | electron-updater |
| **Code-Signing** | Windows/macOS Standard | Standard |
| **Expo Web Kompatibilität** | Gut (WebView) | Sehr gut |
| **Native RN Module** | Eingeschränkt (Web only) | Eingeschränkt (Web only) |
| **Team-Aufwand** | Mittel (Rust-Toolchain) | Niedrig (JS only) |
| **Empfehlung** | **Primär** | Fallback |

---

## Phasenplan

### Phase 1 — Expo Web (jetzt)

- `npm run web` für lokale Entwicklung
- `npx expo export --platform web` für statisches `dist/`
- Responsive `DesktopShell` / `TabletShell` ohne Bottom-Tabs
- Supabase Auth über PKCE / Session (siehe `web-desktop-security.md`)

**Exit-Kriterium:** Web-Build läuft fehlerfrei, DesktopShell auf ≥1200px, Login + Office-Kernflows nutzbar.

### Phase 2 — Tauri Wrapper

- Neues Repo-Verzeichnis `desktop/` oder Monorepo-Package
- Tauri lädt `file://` aus `../dist/` oder konfigurierte Staging-URL
- Deep Links: `caresuiteplus://` → Custom Protocol in Tauri
- System-Tray optional (Hintergrund-Benachrichtigungen Vorbereitung)
- Code-Signing: Windows (Authenticode), macOS (Developer ID + Notarization)

**Exit-Kriterium:** Installierbare `.msi`/`.dmg`, Auto-Start, Session-Persistenz.

### Phase 3 — Store & Enterprise Distribution

- Microsoft Store (optional, MSIX)
- Mac App Store (optional; Sandbox-Einschränkungen prüfen)
- Enterprise: Intune/SCCM via signierte Installer
- MDM-Konfiguration: Supabase-URL, Mandanten-ID via Config-Datei

---

## Build-Befehle (Phase 1)

```bash
# Web-Dev
npm run web

# Statischer Export
npx expo export --platform web

# Preview-Builds Mobile (Parallel)
eas build --profile preview --platform ios
eas build --profile preview --platform android
```

---

## Offene Punkte

- Assets (`icon.png`, favicon) fehlen — blockiert auch Desktop-Icon
- Kein erfolgreicher EAS-Build in diesem Sprint verifiziert
- Tauri-Projekt noch nicht angelegt (nur dokumentiert)
