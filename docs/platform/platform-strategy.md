# CareSuite+ — Plattform-Strategie

**Stand:** 2026-06-13  
**Stack:** Expo 52, React Native 0.76, TypeScript, Expo Router, Supabase

---

## Zielbild

CareSuite+ soll auf **iOS, Android, Tablet, Web und Desktop (Windows/macOS)** mit **einer Codebasis** betrieben werden — ohne separate Business-Module pro Plattform. Fokus: responsive Architektur, Store-Fähigkeit, Desktop-Tauglichkeit.

---

## Plattform-Bewertung (aktueller Stack)

| Plattform | Reife mit Expo/RN | CareSuite+ Status | Empfehlung |
|-----------|-------------------|-------------------|------------|
| **iOS Phone** | Produktionsreif (EAS Build) | Shell + Tabs vorhanden | Primärziel App Store |
| **iOS Tablet** | `supportsTablet: true` | Responsive Shells + Master-Detail (3 Screens) | Eigenes Layout, kein Stretch |
| **Android Phone** | Produktionsreif (EAS Build) | Analog iOS | Primärziel Google Play |
| **Android Tablet** | Unterstützt | Responsive Breakpoints ≥768px | Side-Rail + Split-Pane |
| **Web (Browser)** | Expo Web (Metro, static) | Phase 1 Desktop | Öffentliche + interne Distribution |
| **Windows Desktop** | Phase 1: Expo Web; Phase 2: Wrapper | Noch nicht gebaut | **Option A** (siehe unten) |
| **macOS Desktop** | Phase 1: Expo Web; Phase 2: Wrapper | Noch nicht gebaut | **Option A** |

---

## Architektur-Entscheidung: Desktop Option A vs. B

### Option A — Expo Web + Tauri Wrapper (empfohlen)

1. **Phase 1:** `expo export --platform web` → statisches Web-Bundle
2. **Phase 2:** Tauri 2.x lädt lokales `dist/` oder Remote-URL in WebView
3. **Vorteile:** Geringer Overhead (~5–15 MB), Rust-Sicherheitsmodell, systemeigene Menüs/Tray, Auto-Update möglich
4. **Nachteile:** WebView-Rendering, native RN-Module nur eingeschränkt

### Option B — Expo Web + Electron Wrapper

1. Gleiche Web-Export-Pipeline
2. Electron packt Chromium + Node
3. **Vorteile:** Ökosystem, viele Beispiele
4. **Nachteile:** Größere Binaries (150+ MB), höherer RAM-Verbrauch, Security-Hardening aufwändiger

### Entscheidung

**Option A (Tauri)** — CareSuite+ ist eine datenintensive B2B-SaaS-App ohne schwere native GPU-Anforderungen. Expo Web deckt UI ab; Tauri liefert Desktop-Distribution mit akzeptablem Footprint. Electron bleibt Fallback, falls Tauri-Integration blockiert.

---

## Responsive Device Classes

| Klasse | Breite | Shell | Navigation |
|--------|--------|-------|------------|
| `phone` | &lt;768 | MobileShell | Bottom Tabs |
| `small_tablet` | 768–899 | TabletShell | Side Rail |
| `tablet` | 900–1199 | TabletShell | Side Rail |
| `desktop` | 1200–1599 | DesktopShell | Sidebar |
| `wide_desktop` | ≥1600 | DesktopShell | Sidebar (breiter) |

Implementierung: `src/lib/platform/breakpoints.ts`, `src/hooks/platform/usePlatformLayout.ts`, `src/components/layout/*Shell.tsx`.

---

## Master-Detail (Tablet+)

Referenzimplementierungen:

- Office Klient:innen (`ClientsAdaptiveScreen`)
- Business Kommunikationszentrum (`CommunicationAdaptiveScreen`)
- Office Nachrichten (`OfficeMessagesAdaptiveScreen`)

---

## Nächste Schritte (nach diesem Sprint)

1. `assets/` Icon-Set erstellen (Build-blockierend)
2. EAS `projectId` durch echte UUID ersetzen
3. Erste `eas build --profile preview` für iOS + Android
4. `expo export -p web` und Tauri-Scaffold (Phase 2)
5. Verbleibende Screens auf Master-Detail-Muster migrieren
