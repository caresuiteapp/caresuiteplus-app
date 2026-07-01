# CareSuite+ — Thermal & Performance Audit

**Datum:** 2026-07-01  
**Scope:** Expo Web PWA + Native — Portal, Assist Live, Office Live, Maps, GPS, Realtime  
**Constraints:** Keine Design-/Feature-/Schema-/Business-Logic-Änderungen; nur Analyse + sichere Performance-Reparaturen

---

## 1. Vorbereitung & Baseline

### npm-Scripts (package.json)

| Script | Vorhanden | Zweck |
|--------|-----------|-------|
| `typecheck` | ✓ | `tsc --noEmit` |
| `test` | ✓ | `vitest run` |
| `lint` | ✓ | `expo lint` |
| `check` | ✓ | Alias für typecheck |
| `smoke` | ✓ | Smoke-Check |
| `platform:audit` | ✓ | Plattform-Audit |
| `perf-thermal` (dediziert) | ✗ | Vorhanden als `scripts/audit-perf-thermal.ts` (manuell: `npx tsx scripts/audit-perf-thermal.ts`) |

**Fehlende Scripts:** Kein npm-Alias für `audit-perf-thermal.ts`; kein dediziertes `test:perf`-Target.

### Baseline-Ergebnisse (2026-07-01)

| Check | Ergebnis |
|-------|----------|
| `npm run typecheck` | **FAIL** — ~300 vorbestehende TS-Fehler (hauptsächlich Tests, Portal-Screens, Dropdown-Typen); **0 neue Fehler durch diesen Audit** |
| `npm test` | **PARTIAL** — 3229 passed / 334 failed (vorbestehende WP/Integration-Failures); **PERF.1-Tests 7/7 grün** |
| `npm run lint` | **FAIL** — 945 Probleme (102 errors, 843 warnings); vorbestehend (Deno-Edge-Imports, React-Hook-Deps) |

**Vorarbeit PERF.1 (2026-06-29):** 26/26 Checks bestanden — siehe `docs/audit/perf-1-thermal-audit-output.md`.

---

## 2. setInterval / Polling

| Datei | Intervall | Risiko | Status |
|-------|-----------|--------|--------|
| `useLiveRefresh.ts` | 15–30s | Hoch | ✓ visibility-aware (`createVisibilityAwareInterval`) |
| `useAssistLiveStatus.ts` | 30–60s | Hoch | ✓ `useVisibilityAwarePolling` + Profil-Throttle |
| `usePortalClientLiveTracking.ts` | 15–60s | Hoch | ✓ visibility-aware + Realtime |
| `usePortalClientAppointmentDetail.ts` | 30s | Mittel | **FIX:** raw `setInterval` → `useVisibilityAwarePolling` |
| `liveMonitorRealtime.ts` | 15s | Hoch | **FIX:** Demo + Fallback-Poll → `createVisibilityAwareInterval` |
| `communication.realtime.ts` | 30–45s (Demo) | Mittel | **FIX:** visibility-aware Demo-Polls |
| `officemessagerealtime.ts` | 20s (Demo) | Mittel | **FIX:** visibility-aware Demo-Polls |
| `channelManager.ts` | 30s (Demo) | Mittel | **FIX:** `pollCleanup` in Subscription für korrektes Unsubscribe |
| `useLiveVisitTimers.ts` | 1s | Mittel (UX-kritisch) | **FIX:** Tick pausiert bei `document.hidden` / inactive AppState |
| `useEmployeePortalVisitExecution.ts` | 15s via useLiveRefresh | OK | Realtime + visibility poll |
| `ScreensaverClock*.tsx` | 1s | Niedrig | Nur bei aktivem Screensaver — OK |
| `voicerecording.ts` | 500ms | Niedrig | Nur während Aufnahme, mit Cleanup — OK |

**Befund:** Mehrere parallele Poll-Loops pro Screen (Realtime + Poll + Refresh). PERF.1 koordiniert bereits; dieser Audit schließt verbleibende raw-Interval-Lücken.

---

## 3. watchPosition / Geolocation

| Datei | Muster | Risiko | Status |
|-------|--------|--------|--------|
| `useSingleGeolocationWatch.ts` | Singleton `watchPosition` + `clearWatch` | — | ✓ |
| `useEmployeeGpsTracking.ts` | Nutzt Singleton, Throttle 15–30s, 20–30m Schwelle | Kritisch | ✓ (PERF.1) |
| `gpsLocationService.ts` | Einmalig `getCurrentPositionAsync` | OK | ✓ |
| `employeePortalVisitTrackingService.ts` | Foreground einmalig | OK | ✓ |

**Befund:** Ein aktiver GPS-Watch pro `tenantId:sessionId`. Kein paralleler Watch bei Remount.

---

## 4. supabase.channel / Realtime

| Datei | Cleanup | Dedup | Visibility |
|-------|---------|-------|------------|
| `channelManager.ts` | ✓ `pollCleanup` + `removeChannel` | ✓ Map | Demo-Poll visibility-aware |
| `presets.ts` | ✓ | ✓ | Via channelManager |
| `liveMonitorRealtime.ts` | ✓ | ✓ | **FIX:** Fallback-Poll visibility-aware |
| `officemessagerealtime.ts` | ✓ | ✓ Handler-Set | **FIX:** Demo-Poll visibility-aware |
| `communication.realtime.ts` | ✓ | ✓ | **FIX:** Demo-Poll visibility-aware |
| `useManagedSupabaseChannel.ts` | ✓ | ✓ | Hook-Lifecycle |

**Befund:** Realtime-Subscriptions werden korrekt entfernt. Live-Modus nutzt postgres_changes; Demo nutzt visibility-aware Polling.

---

## 5. useEffect / Re-Render-Stürme

| Hotspot | Befund | Status |
|---------|--------|--------|
| `GlobalAiProvider` | Context `useMemo`, lazy `AiMiniPanel`, Panel nur bei `panelOpen` | ✓ PERF.1 |
| `AuthProvider` | Context-Wert memoized | ✓ |
| `ThemeModeProvider` | Context-Wert memoized | ✓ |
| `PerformanceProvider` | Snapshot memoized, CSS-Sync in Effect | ✓ |
| `useOrientation` | Listener-Cleanup korrekt; `tick`-Bump bei resize | OK (bewusst) |
| `CareSignatureCanvas` | ResizeObserver + RAF mit Cleanup | ✓ |
| `EmployeePortalVisitExecutionScreen` | Mehrere Effects, Realtime via Hook | OK |
| `usePortalActor` | 3 Effects — Auth/Portal-Session | Mittel — kein Loop erkannt |

**console.log in Render-Pfaden:** Keine in `src/` (nur `voiceRealtimeUtils.ts` gated via `voiceDebugLog`).

---

## 6. Google Maps

| Datei | Befund | Status |
|-------|--------|--------|
| `googleMapsLoader.ts` | Singleton script load | ✓ |
| `useStableGoogleMap.ts` | Map nicht bei jedem Center-Update neu | ✓ PERF.1 |
| `useStableMapMarkers.ts` | Marker-Update statt Full-Recreate | ✓ PERF.1 |
| `useVisibleMapPolling.ts` | Poll nur im Viewport | ✓ |
| `GoogleMapsLiveMap.web.tsx` | Nutzt stable hooks, memoized | ✓ |
| `AssistLiveMap.web.tsx` | Delegiert an GoogleMapsLiveMap | ✓ |

---

## 7. CSS / GPU-Last (backdrop-filter, Animationen)

| Muster | Vorkommen | Impact | Mitigation |
|--------|-----------|--------|------------|
| `backdrop-filter: blur()` | GlassSurface, TopBars, Nav, Scrollbars | **Hoch iOS Safari** | `performanceCss.ts` — `.performance-mobile`, `.performance-ios-safari` deaktiviert Blur |
| Infinite CSS/Canvas | `LightGalaxyOrbitNebulaBackground`, Aurora | **Hoch** | Mobile/Tracking: `shouldUseHeavyEffects()` → Animation off |
| Reanimated infinite | `VoiceOrbCore` pulse/orbit | Mittel-Hoch | Mobile motion reduction (PERF.1) |
| Global Background | `app/_layout.tsx` | Hoch | Mobile background disabled via PerformanceProvider |

**Keine Design-Änderungen** — nur bestehende Performance-Profile respektiert.

---

## 8. Große Listen / Memoization

| Bereich | Virtualisierung | Memo |
|---------|-----------------|------|
| EntityListScreen, AssignmentsListView | FlatList/ScrollView | Teilweise `React.memo` auf Rows |
| Office Messages Inbox | FlatList | OK |
| Portal Inbox | FlatList | OK |
| Calendar Views | Custom Grid | Kein Virtualizer — akzeptabel bei <500 Events |
| Dashboard KPIs | Kleine Sets | OK |

**P2-Empfehlung:** Einsatzplanung/Kalender bei >200 Einträgen FlatList + `getItemLayout` prüfen (nicht in diesem Audit umgesetzt — kein sicherer Minimal-Fix ohne UX-Risiko).

---

## 9. Context Provider (non-memoized values)

| Provider | Context memoized | Status |
|----------|------------------|--------|
| AuthProvider | ✓ `useMemo` | OK |
| GlobalAiProvider | ✓ `useMemo` | OK |
| ThemeModeProvider | ✓ `useMemo` | OK |
| PerformanceProvider | Stateless wrapper | OK |
| ScreensaverSettingsProvider | ✓ | OK |
| ModalStackProvider | ✓ | OK |

---

## 10. Angewandte Fixes (dieser Audit)

| Datei | Fix |
|-------|-----|
| `src/hooks/usePortalClientAppointmentDetail.ts` | Raw 30s-Interval → `useVisibilityAwarePolling` |
| `src/hooks/useLiveVisitTimers.ts` | 1s-Tick pausiert bei hidden Tab/AppState |
| `src/lib/assist/liveMonitorRealtime.ts` | Demo + Realtime-Fallback → `createVisibilityAwareInterval` |
| `src/features/communication/communication.realtime.ts` | Demo-Polls visibility-aware |
| `src/lib/office/officemessagerealtime.ts` | Demo-Polls visibility-aware |
| `src/lib/realtime/channelManager.ts` | `pollCleanup` in Subscription für vollständiges Teardown |

**Geänderte Dateien:** 6 Source + 5 Dev-Utils + 1 Report = **12 Dateien**

---

## 11. Dev-only Performance Utils

Neu unter `src/utils/performance/` — **zero production overhead** (`__DEV__` / `NODE_ENV === 'development'` Gate):

| Modul | Zweck |
|-------|-------|
| `renderGuard.ts` | Warnt bei >30 Renders/s pro Label |
| `devRenderCounter.ts` | Zählt Renders pro Komponente |
| `subscriptionRegistry.ts` | Trackt aktive Realtime-Subscriptions |
| `intervalRegistry.ts` | Trackt aktive Intervalle |
| `index.ts` | Re-Exports |

**Nutzung (Dev-Konsole):**
```javascript
import { logDevRenderCounts, logDevIntervals, logDevSubscriptions } from '@/utils/performance';
logDevRenderCounts();
logDevIntervals();
logDevSubscriptions();
```

Bestehend: `window.__caresuitePerfDiagnostics()` aus `performanceDiagnostics.ts`.

---

## 12. Prioritäten & Validierung

### P0 — Kritisch (Thermal/Battery)

| ID | Ursache | Status |
|----|---------|--------|
| P0-1 | Parallele Polling ohne Tab-Hidden-Pause | **Behoben** (PERF.1 + dieser Audit) |
| P0-2 | GPS `watchPosition` ohne Singleton | **Behoben** (PERF.1) |
| P0-3 | Google Maps Marker/Map recreate | **Behoben** (PERF.1) |
| P0-4 | Global Animated Background auf Mobile | **Behoben** (PERF.1) |

### P1 — Hoch

| ID | Ursache | Status |
|----|---------|--------|
| P1-1 | `backdrop-filter` Glass auf iOS Safari | **Mitigiert** via Performance-CSS |
| P1-2 | Live Monitor Demo/Fallback-Poll ohne Visibility | **Behoben** (dieser Audit) |
| P1-3 | Portal Appointment Detail raw 30s poll | **Behoben** (dieser Audit) |
| P1-4 | VoiceOrb infinite Reanimated auf Mobile | **Mitigiert** (PERF.1) |

### P2 — Mittel

| ID | Ursache | Status |
|----|---------|--------|
| P2-1 | 1s Visit-Timer bei hidden Tab | **Behoben** (dieser Audit) |
| P2-2 | Demo Realtime-Polls (Office/Communication) | **Behoben** (dieser Audit) |
| P2-3 | Große Kalender-Grids ohne Virtualizer | Offen — Monitoring |
| P2-4 | channelManager pollCleanup Leak bei last-handler | **Behoben** (dieser Audit) |

### P3 — Niedrig / Beobachtung

| ID | Ursache | Status |
|----|---------|--------|
| P3-1 | Screensaver 1s Clock | OK — nur aktiv bei Screensaver |
| P3-2 | Voice recording 500ms duration tick | OK — nur bei Aufnahme |
| P3-3 | `useOrientation` resize listener | OK — notwendig für Landscape |
| P3-4 | CareSignatureCanvas ResizeObserver | OK — Cleanup vorhanden |

### Finale Validierung

| Check | Ergebnis |
|-------|----------|
| `npm run typecheck` | ~300 vorbestehende Fehler, **keine neuen** aus Audit-Dateien |
| `npm test` (perf1Thermal) | **7/7 passed** |
| `npm test` (gesamt) | 3229 passed / 334 failed (vorbestehend) |
| `npm run lint` | 945 vorbestehende Probleme, keine neuen in geänderten Dateien |

---

## Top 5 Thermal Root Causes (Gesamt)

1. **Parallele Polling + Realtime ohne Tab-Hidden-Pause** — Live Portal/Assist/Monitor Screens → **behoben**
2. **GPS watchPosition mit enableHighAccuracy** — Mitarbeiter-Live-Tracking → **Singleton + Throttle (PERF.1)**
3. **Google Maps Marker/Map recreate** — Positionsaktualisierung → **stable hooks (PERF.1)**
4. **backdrop-filter Glass + Scrollbars** — iOS Safari GPU → **Performance-CSS (PERF.1)**
5. **Global Animated Background + VoiceOrb** — permanent GPU/CPU → **Mobile off (PERF.1)**

---

## Kevin — 5 Min Smoke-Test (iPhone/PWA)

1. Mitarbeiterportal → Einsatz starten → Live Tracking: Gerät bleibt kühl, Standort sichtbar
2. Klient:innenportal → Live-Karte: Marker ohne Flackern; Tab wechseln → kein Hintergrund-Poll
3. Assist Live Dashboard: KPIs nach Tab-Rückkehr aktuell
4. Safari-Konsole: `window.__caresuitePerfDiagnostics()` → `geolocationWatches ≤ 1`

**Thermal/Battery Ready:** Ja — mit optionalem iPhone Smoke-Test.
