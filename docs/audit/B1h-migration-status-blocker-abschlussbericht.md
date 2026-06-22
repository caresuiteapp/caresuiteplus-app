# B.1h — Migrationsstatus & Blocker (Abbruch vor blindem Deploy)

**Datum:** 2026-06-20  
**Scope:** B.1h gestoppt — **kein** `supabase db push`, **keine** Migration angewendet, **kein** B.2, **keine** RLS-/Schema-Reparatur.  
**Auslöser:** Freigabe nur für gezieltes Apply von `0154`; blindes `db push` untersagt, wenn mehr als eine Migration pending wäre.

---

## 1. Executive Summary

| Punkt | Ergebnis |
|-------|----------|
| **B.1h ausgeführt?** | ❌ **Abgebrochen** — nur Prüfung + Bericht |
| **`supabase db push` ausgeführt?** | ❌ Nein |
| **Migration 0154 angewendet?** | ❌ Nein |
| **Remote-Projekt erreichbar?** | ✅ Ja (`npx supabase migration list`) |
| **Einzige pending Migration?** | ✅ **Ja — nur `0154`** |
| **0150–0153 auf Remote?** | ✅ Bereits angewendet |
| **Blind-`db push`-Blocker (Mehrfach-Migration)?** | 🟢 **Nicht aktiv** — Push würde aktuell nur 0154 anwenden |
| **Empfehlung für nächsten Schritt** | Explizite **B.1h-Apply-Freigabe** mit gewähltem Weg (s. §6) |

**Kernaussage:** Der ursprüngliche Sicherheits-Blocker „mehrere Migrationen würden mitdeployt“ trifft **auf den aktuellen Remote-Stand nicht zu**. Trotzdem wurde **bewusst nicht deployed**, bis ein separater Apply-Schritt freigegeben wird.

---

## 2. Projekt- & Git-Status

| Punkt | Wert |
|-------|------|
| **Branch** | `main` |
| **HEAD** | `ad0474b4b34bb0720a513bbbea2c6ecf9a0832b2` (gepusht nach `origin/main`) |
| **Supabase `project_id`** | `caresuite-plus` (`supabase/config.toml`) |
| **Migration 0154 im Git-HEAD?** | ✅ Ja (Security-Commit B.1e) |

---

## 3. Migrationsstatus (Remote vs. Local)

Quelle: `npx supabase migration list` — Log: `.audit-migration-list-b1h-abort.log`

### Bereits synchron (Auszug 0140–0153)

| Local | Remote | Status |
|-------|--------|--------|
| 0140–0149 | 0140–0149 | ✅ applied |
| 0150 | 0150 | ✅ applied |
| 0151 | 0151 | ✅ applied |
| 0152 | 0152 | ✅ applied |
| 0153 | 0153 | ✅ applied |

### Pending

| Local | Remote | Datei | Status |
|-------|--------|-------|--------|
| **0154** | *(leer)* | `0154_sync_b1_permission_keys.sql` | ⏳ **einzige pending Migration** |

**Anzahl pending Migrationen:** **1** (nur 0154)

---

## 4. Migration 0154 — Kurzprüfung (read-only)

| Prüfpunkt | Ergebnis |
|-----------|----------|
| INSERT-only / `ON CONFLICT DO NOTHING` | ✅ |
| DROP / TRUNCATE / destructive DELETE | ❌ nicht enthalten |
| RLS-Änderungen | ❌ keine |
| Schema-Änderungen | ❌ keine |
| B.1 PermissionKeys (CareSuite+-Rollen) | ✅ 8 Rollen, ~99 Zeilen |
| `office.invoices.create` | ✅ |
| Live-Rollen `owner` / `admin` | 🟡 bewusst **nicht** in 0154 (deferred) |

---

## 5. Blocker-Matrix

| ID | Blocker | Status | Auswirkung |
|----|---------|--------|------------|
| **B1h-B1** | Blind `db push` ohne Statusprüfung | ✅ **verhindert** (Abbruch) | Kein ungeprüftes Deploy |
| **B1h-B2** | Mehr als eine Migration pending | ✅ **nicht gegeben** | Nur 0154 offen |
| **B1h-B3** | Migration 0154 noch nicht applied | 🟡 **offen** | DB/UI weiterhin ohne B.1-Keys für CS+-Rollen |
| **B1h-B4** | Live-Rollen ohne B.1-Keys | 🟡 **offen** | Separater Schritt (0155 o. ä.) |
| **B1h-B5** | Statische Matrix vs. DB-Drift | 🟡 **offen** bis Apply | Service-Gates statisch OK; Supabase-UI/RLS DB-first |

---

## 6. Entscheidung & nächster sicherer Schritt (nicht ausgeführt)

### Option A — `supabase db push` (bedingt erlaubt)

**Voraussetzung erfüllt:** Nur 0154 pending.  
**Risiko:** Gering für Mehrfach-Migration; dennoch projektweiter Push-Befehl — nur nach expliziter Freigabe.

### Option B — SQL Editor / Einzeldatei (empfohlen aus B.1d)

Inhalt von `supabase/migrations/0154_sync_b1_permission_keys.sql` manuell auf Ziel-DB ausführen.  
**Vorteil:** Maximaler Scope-Engpass, kein CLI-Nebeneffekt.

### Option C — `supabase migration up` mit Version-Target

Falls CLI unterstützt: gezielt nur Version `0154` — vorher in Freigabe dokumentieren.

### Verification nach Apply (Pflicht)

```sql
-- Beispiel: Keys für business_admin zählen (nicht ausgeführt in B.1h)
SELECT COUNT(*) FROM public.role_permissions rp
JOIN public.roles r ON r.id = rp.role_id
WHERE r.key = 'business_admin'
  AND rp.permission_key LIKE 'connect.%' OR rp.permission_key = 'office.invoices.create';
```

Zusätzlich: Permission-Tests 8/8, Smoke Intake / Portal Profile / Invoice / Relative Portal.

---

## 7. Nicht ausgeführte Aktionen

- ❌ `supabase db push`
- ❌ Migration 0154 remote/lokal angewendet
- ❌ RLS geändert
- ❌ Schema-Drift repariert
- ❌ ProductAccess / B.2
- ❌ Weitere Migrationen erstellt

---

## 8. Nächster sinnvoller Schritt (Freigabe erforderlich)

1. **B.1h-Apply** — Migration 0154 gezielt anwenden (Option A oder B) + Verification  
2. **B.1h-Live-Rollen** — separater Migrationsschritt für `owner`/`admin`  
3. Audit-Commit für B.1f–B.1h-Berichte  
4. **B.2** — ProductAccess `business/office` (erst nach DB-Sync)
