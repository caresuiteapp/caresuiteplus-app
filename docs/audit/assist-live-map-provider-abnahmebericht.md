# Assist Live Map Provider — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Live-Kartenansicht für Assist Live-Status und Klient:innenportal (Termin-Detail)  
**Commit:** `feat(assist): add live map tracking for assist and client portal`

---

## 1. Executive Summary

Live-Standortanzeige ist für Assist und das Klient:innenportal implementiert. **OpenStreetMap** dient als Standard-Kartenanbieter (ohne API-Key, localhost-tauglich). Optional kann **Mapbox** über Umgebungsvariablen aktiviert werden. Die Listendarstellung bleibt als Fallback erhalten.

**Ergebnis:** ✅ **SUCCESS** — Unit-Tests grün, Datenschutz-Gates implementiert.

---

## 2. Provider-Wahl

| Option | Entscheidung |
|--------|--------------|
| react-native-maps | ❌ Nicht im Projekt, schwerer Native-Stack |
| react-leaflet | ❌ Nur Web, zusätzliche Abhängigkeit |
| **OpenStreetMap (Embed + Static)** | ✅ Standard, kein Key, Web + Native-Fallback |
| Mapbox Static API | ✅ Optional via `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` |

---

## 3. Implementierung

### A) Map-Abstraktion

| Datei | Zweck |
|-------|-------|
| `src/lib/assist/assistMapProvider.ts` | Tile-URLs, Demo-Position, Env-Erkennung |
| `src/components/maps/AssistLiveMap.tsx` | Static-Map-Fallback (Native/allgemein) |
| `src/components/maps/AssistLiveMap.web.tsx` | Interaktive OSM-Embed-Karte (Web) |

### B) Assist Live-Status (`/assist/live-status`)

- Split-Layout ab 1024px: Liste links, Karte rechts
- KPI-Badge „Kartenansicht aktiv“
- Demo-Vorschau-Koordinaten im Demo-Modus wenn noch keine GPS-Punkte
- Realtime/Polling via `subscribeToAssistLiveTrackingChanges`

### C) Klient:innenportal

| Datei | Zweck |
|-------|-------|
| `src/lib/portal/clientPortalAssistLiveVisitService.ts` | Sanitized Projection — nur letzte Position |
| `PortalClientAppointmentDetailScreen.tsx` | Live-Einsatz-Sektion mit Karte |
| `portalAppointmentsLiveService.ts` | Live-Detail inkl. `liveVisit` |

### D) System-Status

- `assistDashboardSystemStatus.ts`: „Kartenansicht aktiv“ wenn Provider verfügbar
- `gpsTrackingConfig.ts`: `isAssistMapProviderConfigured()` → true (OSM)

---

## 4. Datenschutz-Garantien

| Regel | Umsetzung |
|-------|-----------|
| Tracking nur während aktiver Einsätze | Status-Gate: `unterwegs`, `angekommen`, `gestartet` |
| Kein Dauer-Tracking außerhalb Einsätze | Session-scoped `assist_tracking_sessions` |
| Klient:innenportal: nur aktueller Einsatz | `projectClientPortalAssistLiveVisit` — ein Punkt, kein Verlauf |
| Kein Fahrtenbuch / GPS-Historie im Portal | Kein Zugriff auf Location-Point-Liste, nur latest |
| Kein Zugriff auf fremde Einsätze | `assignmentBelongsToClient`-Prüfung |
| Portal-Freigabe + Zeitfenster | `portalReleaseEnabled` + Sichtbarkeitsfenster |
| Keine Provider-Namen in UI | Labels: „Kartenansicht“, „Letzte Aktualisierung“ |
| `visit_tracking`-Feature bleibt blockiert | Kein Roh-GPS-Feature-Flag im Portal |

---

## 5. Tests

| Suite | Ergebnis |
|-------|----------|
| `assistMapProvider.test.ts` | ✅ OSM konfiguriert, URLs ohne Key |
| `clientPortalAssistLiveVisit.test.ts` | ✅ Sanitization, Phase-Gate, Client-Isolation |
| `assistLiveTrackingView.test.ts` | ✅ (bestehend) |

---

## 6. Env-Variablen (Namen only)

| Variable | Zweck |
|----------|-------|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Optional: Mapbox Static Tiles |
| `MAPBOX_ACCESS_TOKEN` | Server/Build-Fallback für Mapbox |

Ohne diese Variablen: OpenStreetMap (Standard).

---

## 7. Verifikation

| Route | Erwartung |
|-------|-----------|
| `localhost:8082/assist/live-status` | Kartenbereich sichtbar (Demo-Koordinaten wenn leer) |
| `/portal/client/appointments/[id]` | Live-Einsatz-Sektion mit Karte bei aktivem Einsatz |

Manuelle Browser-Verifikation empfohlen nach `npm run web`.
