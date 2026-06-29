# PERF.1 — Thermal Abnahmebericht

**Datum:** 2026-06-29  
**Production:** https://caresuiteplus.app  
**Commit:** _(siehe git log nach Deploy)_

---

## Zusammenfassung

PERF.1 reduziert thermische Last durch Singleton-GPS, visibility-aware Polling, stabile Maps, Mobile-Glass-Reduktion und deaktivierte Hintergrund-Animationen auf Portal/Mobile.

---

## Umgesetzte Phasen

| Phase | Deliverable | Status |
|-------|-------------|--------|
| 1 | `perf-1-thermal-preflight.md` | ✓ |
| 2 | `devicePerformance.ts` | ✓ |
| 3 | Performance CSS + Provider | ✓ |
| 4 | `useSingleGeolocationWatch` | ✓ |
| 5 | Stable Map hooks | ✓ |
| 6 | Visibility polling + managed channels | ✓ |
| 7 | memo / visibility auf Hotspots | ✓ |
| 8 | Lazy AiMiniPanel | ✓ |
| 9 | VoiceOrb mobile motion off | ✓ |
| 10 | `performanceDiagnostics.ts` | ✓ |
| 11 | iOS Safari CSS | ✓ |
| 12 | Unit tests | ✓ |
| 13 | Audit script + output | ✓ |
| 14 | Deploy `[deploy]` | ✓ |
| 15 | Dieser Bericht | ✓ |

---

## Kevin — 5–10 Min iPhone Verifikation

1. **Mitarbeiterportal → Einsatz starten → Live Tracking aktiv**
   - Gerät sollte nach 2–3 Min merklich kühler bleiben als vorher
   - Standort-Updates weiterhin sichtbar (15–30s Verzögerung OK)

2. **Klient:innenportal → Live-Karte**
   - Karte lädt, Marker bewegt sich ohne Flackern/Re-Init
   - Tab wechseln (Safari) → kein heißer Hintergrund-Poll

3. **Assist Live / Office Live Dashboard**
   - KPIs aktualisieren sich nach Tab-Rückkehr
   - Kein ständiges Netzwerk-Traffic-Rauschen im Hintergrund

4. **VoiceOrb / KI**
   - Orb sichtbar, keine pulsierende Animation auf iPhone
   - Panel öffnet nach Tap (lazy load)

5. **Glass/Blur**
   - Portal-Topbar ohne sichtbaren Blur-Lag beim Scrollen

**Dev-Diagnose (optional):** In Safari-Konsole `window.__caresuitePerfDiagnostics()` — `geolocationWatches ≤ 1` während Tracking.

---

## Thermal/Battery Ready

**Ja** — mit Kevin iPhone Smoke-Test empfohlen.

---

## LT.GMAPS Kompatibilität

- `useEmployeeGpsTracking` nutzt Singleton — LT.GMAPS.2 Throttle/Consent unverändert
- Maps-Runtime-Key und Route-Fixes unberührt
