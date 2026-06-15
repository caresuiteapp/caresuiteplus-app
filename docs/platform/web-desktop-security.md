# CareSuite+ — Web & Desktop Security

**Stand:** 2026-06-13  
**Geltungsbereich:** Expo Web (Phase 1), Tauri/Electron Wrapper (Phase 2)

---

## Auth & Session

| Thema | Mobile (iOS/Android) | Web / Desktop |
|-------|----------------------|---------------|
| Supabase Auth | `@supabase/supabase-js` + AsyncStorage | `localStorage` / secure cookie (SSR nicht aktiv) |
| Session Refresh | Automatisch via Client | Gleich; Tab-Schließen beendet Session |
| Portal-Login | Edge Functions + Session Store | Gleiche Endpoints; CORS in Supabase prüfen |
| PKCE | Empfohlen für OAuth | **Pflicht** für Web-Redirects |

**Maßnahmen:**

- Keine Service-Role-Keys im Client-Bundle
- `EXPO_PUBLIC_SUPABASE_URL` und Anon-Key nur als Publishable Keys
- RLS auf allen Mandantentabellen (bestehende Migrationen)
- Logout (`signOut`) in DesktopShell-Sidebar verfügbar

---

## Content Security (Web Export)

Beim statischen Export:

- Keine inline Scripts aus User-Input
- Supabase-Realtime nur über WSS
- CSP-Header auf Hosting-Ebene setzen (nicht in Expo-App):

```
Content-Security-Policy: default-src 'self'; connect-src 'self' https://*.supabase.co wss://*.supabase.co; img-src 'self' data: https:; style-src 'self' 'unsafe-inline'
```

---

## Desktop Wrapper (Tauri Phase 2)

| Risiko | Mitigation |
|--------|------------|
| XSS in WebView | Strikte CSP, kein `dangerouslyAllowRuntime` |
| Deep-Link Hijacking | Custom Protocol nur in registrierter App |
| Lokale Datenspeicherung | Keine PHI auf Disk; Session in WebView-Storage |
| Auto-Update | Signierte Updates, HTTPS-only Feed |
| Clipboard / Screenshots | Optional für sensible Screens sperren (später) |

---

## Datenschutz-relevante Links

In-App (DesktopShell / TabletShell):

- Hilfe → `SUPPORT_LINKS.help`
- Datenschutz → `SUPPORT_LINKS.privacy`
- Impressum → `SUPPORT_LINKS.imprint`
- Abmelden → `signOut()`

Konstanten: `src/lib/platform/supportLinks.ts`

---

## Compliance-Hinweise (DE Pflege-SaaS)

- Gesundheitsdaten: RLS + Rollenmodell (bestehend)
- Auftragsverarbeitung: DPA mit Supabase + Hosting
- TI-Modul: Separates Security-Audit vor Produktion (bestehend dokumentiert)
- Web/Desktop: Kein zusätzlicher PHI-Cache außerhalb Supabase ohne Verschlüsselung

---

## Checkliste vor Web-Production

- [ ] Supabase Auth Redirect URLs für Web-Domain eingetragen
- [ ] CORS auf Edge Functions geprüft
- [ ] CSP auf CDN/Hosting
- [ ] HTTPS erzwungen
- [ ] Penetrationstest Portal-Login
- [ ] Session-Timeout Policy dokumentiert
