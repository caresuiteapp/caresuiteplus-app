# OFFLINE.1 — Connectivity + IndexedDB Foundation + OfflineNotice

**Datum:** 2026-07-03  
**Phase:** OFFLINE.1 (Implementierung)  
**Blueprint:** `docs/audit/offline-first-portal-execution-blueprint.md` (OFFLINE.0)  
**Scope:** Mitarbeiterportal (MP) only — keine Migrationen, kein Service Worker, kein Sync, kein Execute-Workflow-Change

---

## Phase 0 — Preflight

| Check | Ergebnis |
|-------|----------|
| HEAD | `71cd7d80` — `docs(offline): add offline-first portal execution blueprint` |
| origin/main sync | **ja** (HEAD = origin/main) |
| OFFLINE.0 Blueprint | **ja** — `docs/audit/offline-first-portal-execution-blueprint.md` |
| ZEIT.1 on remote | **ja** — `2c48eb8f fix(wfm): resolve portal employee_id for MP time tracking` |
| Uncommitted CODE changes (pre-existing) | **1 Datei** — `src/__tests__/office/profileRoleAndTimeTrackingFix.test.ts` (3 Zeilen, nicht von OFFLINE.1) |
| Commit / Push / Deploy | **nein** (explizit ausgeschlossen) |

---

## Phase 1 — useConnectivity

| Artefakt | Status |
|----------|--------|
| `src/hooks/useConnectivity.ts` | **neu** |
| Web | `navigator.onLine` + `online`/`offline` events |
| SSR | Guards für `typeof window` / `typeof navigator` |
| Native NetInfo | Optional via `require('@react-native-community/netinfo')` — **nicht installiert**, Fallback `unknown` |
| Export | `ConnectivityState`, `readInitialConnectivityState()`, `useConnectivity()` |

**ConnectivityState:**

```typescript
{
  isConnected: boolean;
  isOffline: boolean;
  isInternetReachable: boolean | null;
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'bluetooth' | 'none' | 'unknown';
  source: 'web' | 'native' | 'unknown';
}
```

**Neue Dependencies:** **keine** (`@react-native-community/netinfo` nicht in package.json — dokumentiert, nicht installiert)

---

## Phase 2 — IndexedDB Foundation

| Artefakt | Status |
|----------|--------|
| `src/lib/offline/types.ts` | **neu** |
| `src/lib/offline/idb.ts` | **neu** |
| DB Name | `CareSuiteOfflineDB` v1 |
| Stores | `sync_meta`, `assignments`, `visit_execution`, `outbox`, `doc_drafts`, `signature_drafts`, `gps_buffer`, `wfm_pending` |
| API | `openOfflineDb()`, `getOfflineDbHealth()`, `putSyncMeta()`, `getSyncMeta()`, `clearOfflineDb()` |
| Fehlerbehandlung | Missing IDB, private mode / SecurityError, QuotaExceeded — graceful degrade, `console.warn` |

**Neue Dependencies:** **keine** (native IndexedDB; `fake-indexeddb` nicht in package.json — In-Memory-Mock in Tests)

---

## Phase 3 — OfflineNotice

| Check | Status |
|-------|--------|
| Message OFFLINE.1-stufe | **ja** — ehrlich, keine „alle Daten gespeichert“-Behauptung |
| Text | „Keine Verbindung. Einige Funktionen sind eingeschränkt. Offline-Speicherung wird schrittweise vorbereitet.“ |
| Export | `OFFLINE_NOTICE_MESSAGE` Konstante |

---

## Phase 4 — MP Wiring

| Check | Status |
|-------|--------|
| Verdrahtung | `EmployeePortalShell` — `useConnectivity().isOffline` → `<OfflineNotice visible />` |
| H3/H4/Office | **nicht geändert** |
| `AppStartScreen` | Unverändert (`<OfflineNotice />` ohne visible — weiterhin unwirksam außerhalb MP) |

---

## Phase 5 — Logout Clear

| Check | Status |
|-------|--------|
| Pfad | `AuthProvider.signOut()` |
| `clearOfflineDb()` | **verdrahtet** (fire-and-forget via `void clearOfflineDb()`) |
| Risiko | **niedrig** — OFFLINE.1 Stores noch leer / nur sync_meta in späteren Phasen |

---

## Phase 6 — Tests

| Datei | Tests | Ergebnis |
|-------|-------|----------|
| `src/__tests__/offline/useConnectivity.test.tsx` | 6 | **pass** |
| `src/__tests__/offline/offlineIdb.test.ts` | 6 | **pass** |
| `src/__tests__/offline/offlineNotice.test.tsx` | 4 | **pass** |
| **Gesamt** | **16/16** | **pass** |

`vitest.config.ts`: Include um `*.test.tsx` erweitert.

---

## Phase 7 — Browser Smoke

**Dev-Server:** `http://localhost:8087` (Expo web)  
**Skript:** `.audit-offline1-browser-smoke.mjs`  
**Ergebnis:** `.audit-offline1-browser-results.json`  
**Screenshots:** `.audit-offline1-browser-screenshots/` (lokal, nicht committed)

| Szenario | Banner sichtbar? | Ergebnis |
|----------|------------------|----------|
| Online (MP Dashboard) | **nein** | **grün** |
| Offline-Event (CDP + `window.offline`) | **ja** | **grün** |
| Reload bei vollem Offline | Navigation fehlgeschlagen | **erwartete Limitation** |

**Reload-Offline-Limitation:** Ohne Service Worker schlägt ein Full-Reload bei `Network.offline` mit `ERR_INTERNET_DISCONNECTED` fehl. Das Offline-Banner funktioniert auf der bereits geladenen SPA-Shell via `online`/`offline`-Events (<800 ms in Smoke).

---

## Geänderte / neue Dateien (OFFLINE.1)

| Datei | Aktion |
|-------|--------|
| `src/hooks/useConnectivity.ts` | neu |
| `src/lib/offline/types.ts` | neu |
| `src/lib/offline/idb.ts` | neu |
| `src/components/ui/OfflineNotice.tsx` | Message |
| `src/components/portal/EmployeePortalShell.tsx` | Banner wiring |
| `src/lib/auth/AuthProvider.tsx` | Logout IDB clear |
| `src/__tests__/offline/*` | neu (3 Dateien) |
| `vitest.config.ts` | tsx tests |
| `docs/audit/offline1-connectivity-idb-foundation.md` | neu (dieses Dokument) |

---

## 10. Abschlussbericht — Entscheidungsmatrix (ja/nein)

| Feld | Wert |
|------|------|
| **Preflight origin/main sync** | **ja** |
| **OFFLINE.0 Blueprint vorhanden** | **ja** |
| **ZEIT.1 on remote** | **ja** |
| **Uncommitted fremde CODE-Änderungen (Preflight)** | **ja** (1 Testdatei, pre-existing) |
| **useConnectivity implementiert** | **ja** |
| **NetInfo installiert** | **nein** (optional, nicht vorhanden — Web/unknown Fallback) |
| **IndexedDB Foundation implementiert** | **ja** |
| **CareSuiteOfflineDB v1 Stores angelegt** | **ja** (8 Stores) |
| **sync_meta CRUD** | **ja** |
| **OfflineNotice Message OFFLINE.1-honest** | **ja** |
| **OfflineNotice im MP verdrahtet** | **ja** (EmployeePortalShell) |
| **H3/H4/Office unverändert** | **ja** |
| **clearOfflineDb on logout** | **ja** (AuthProvider) |
| **Unit-Tests grün** | **ja** (16/16 offline) |
| **Browser smoke online (kein Banner)** | **ja** |
| **Browser smoke offline (Banner)** | **ja** |
| **Reload-offline Limitation dokumentiert** | **ja** |
| **Neue npm Dependencies** | **nein** |
| **Migrationen / RLS** | **nein** |
| **Service Worker / PWA** | **nein** |
| **Sync Queue / Execute Workflow** | **nein** |
| **Commit erstellt** | **nein** (explizit ausgeschlossen) |
| **Deploy** | **nein** |
| **Empfohlene nächste Phase** | **OFFLINE.2** (Assignment-Cache + Prefetch) |

### Reifegrad nach OFFLINE.1 (Schätzung)

| Dimension | Vor OFFLINE.1 | Nach OFFLINE.1 |
|-----------|---------------|----------------|
| Connectivity-Erkennung | ~5 % | ~40 % (Hook + Banner) |
| Persistente lokale Stores | ~0 % | ~15 % (Schema only, kein Cache-Fill) |
| OfflineNotice aktiv (MP) | nein | **ja** |
| Offline Workflow | ~0 % | ~0 % (bewusst unverändert) |

---

*Erstellt: 2026-07-03 | OFFLINE.1 Implementierung | Nächste Aktion: OFFLINE.2*
