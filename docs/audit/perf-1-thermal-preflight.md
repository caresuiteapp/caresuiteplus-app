# PERF.1 — Thermal Preflight Audit

**Datum:** 2026-06-29  
**Scope:** CareSuite+ Expo Web PWA — Mitarbeiterportal, Live Tracking, Office Live, Assist Live, Maps  
**Ziel:** CPU/GPU/Netzwerk/Battery-Hotspots identifizieren vor Implementierung

---

## Executive Summary

Die App erzeugt spürbare Wärme auf iPhone, Laptop und PWA — besonders bei Portal-Live-Ansichten mit parallelen Timern, GPS, Realtime und GPU-lastigem Glass/Animation-Stack.

---

## 1. setInterval / Polling

| Datei | Intervall | Risiko | Maßnahme PERF.1 |
|-------|-----------|--------|-----------------|
| `useLiveRefresh.ts` | 15–30s | Hoch — läuft auch im Hintergrund | `createVisibilityAwareInterval` |
| `useAssistLiveStatus.ts` | 30s (war raw setInterval) | Hoch | `useVisibilityAwarePolling` |
| `usePortalClientLiveTracking.ts` | 15s (war raw setInterval) | Hoch | `useVisibilityAwarePolling` |
| `useEmployeePortalVisitExecution.ts` | 1s | Mittel — UI-Timer während Einsatz | Beibehalten (UX-kritisch), Tab-hidden pausiert via AppState |
| `channelManager.ts` | 30s demo | Mittel | Visibility-aware |
| `liveMonitorRealtime.ts` | variabel | Hoch | Bestehendes Dedup + visibility |
| `officemessagerealtime.ts` | variabel | Mittel | Bestehendes Dedup |
| `ScreensaverClock*.tsx` | 1s | Niedrig — nur Screensaver aktiv | OK |
| `voicerecording.ts` | duration | Niedrig — nur bei Aufnahme | OK |

**Befund:** Mehrere parallele Poll-Loops pro Screen (Realtime + setInterval + useLiveRefresh). PERF.1 koordiniert und pausiert bei `document.hidden`.

---

## 2. watchPosition / Geolocation

| Datei | Muster | Risiko |
|-------|--------|--------|
| `useEmployeeGpsTracking.ts` | `watchPosition` + DB writes | **Kritisch** |
| `gpsLocationService.ts` | `getCurrentPositionAsync` einmalig | OK |
| `employeePortalVisitTrackingService.ts` | Expo Location einmalig | OK |

**Befund:** Ein aktiver GPS-Watch pro Session — vor PERF.1 kein Singleton; mehrfache Mounts konnten parallele Watches erzeugen.

**Maßnahme:** `useSingleGeolocationWatch` — ein Watch pro `tenantId:sessionId`, Throttle 15–30s, 20–30m Bewegungsschwelle.

---

## 3. supabase.channel / Realtime

| Datei | Muster |
|-------|--------|
| `channelManager.ts` | Deduped Map — gut |
| `presets.ts` | Portal/Assist/Employee Subscriptions |
| `liveMonitorRealtime.ts` | Office live |
| `officemessagerealtime.ts` | Nachrichten |
| `communication.realtime.ts` | Kommunikation |

**Befund:** Dedup vorhanden, aber kein zentraler Visibility-Gate. PERF.1: `useManagedSupabaseChannel` + visibility-aware Demo-Poll.

---

## 4. useEffect Leaks (Stichprobe)

| Hotspot | Problem | Fix |
|---------|---------|-----|
| `GoogleMapsLiveMap.web.tsx` | Map/Marker recreate bei jedem Positions-Update | `useStableGoogleMap` + `useStableMapMarkers` |
| `useLiveRefresh` | Interval ohne hidden-check | Visibility-aware cleanup |
| `GlobalAiProvider` | VoiceOrb + Panel immer gemountet | Lazy `AiMiniPanel`, Panel nur bei `panelOpen` |

---

## 5. Google Maps

| Datei | Problem |
|-------|---------|
| `googleMapsLoader.ts` | Singleton script load — **OK** |
| `GoogleMapsLiveMap.web.tsx` | Map neu bei center change; Marker full recreate | Stable hooks |
| `AssistLiveMap.web.tsx` | Delegiert an GoogleMapsLiveMap | OK |

**Maßnahme:** `useVisibleMapPolling` — Poll nur wenn Karte im Viewport.

---

## 6. CSS GPU Killers

| Muster | Vorkommen | Impact |
|--------|-----------|--------|
| `backdrop-filter: blur()` | `glasssurface.tsx`, `glassScrollbarsCss.ts`, Portal/Platform TopBars, Nav | **Hoch auf iOS Safari** |
| Infinite CSS animations | `LightGalaxyOrbitNebulaBackground`, Aurora | **Hoch** |
| Reanimated infinite loops | `VoiceOrbCore` pulse/orbit | **Mittel-Hoch mobile** |
| Global animated background | `app/_layout.tsx` | **Hoch** — 240s canvas + aurora |

**Maßnahme:** `.performance-mobile`, `.disable-heavy-effects`, `.performance-ios-safari` — blur off, animation off auf Mobile/Tracking.

---

## Top 5 Thermal Root Causes

1. **Parallele Polling + Realtime ohne Tab-Hidden-Pause** — Live Portal/Assist Screens
2. **GPS watchPosition mit enableHighAccuracy** — Mitarbeiter-Live-Tracking
3. **Google Maps Marker/Map recreate** — jede Positionsaktualisierung
4. **backdrop-filter Glass + Scrollbars** — iOS Safari GPU compositor
5. **Global Animated Background + VoiceOrb infinite Reanimated** — permanent GPU/CPU

---

## Implementierungs-Reihenfolge

Phasen 2–15 gemäß PERF.1 Spec — siehe `scripts/audit-perf-thermal.ts` für Verifikation.
