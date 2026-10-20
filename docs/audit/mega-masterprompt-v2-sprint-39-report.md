# MEGA Masterprompt v2 — Sprint 39 Report

**Datum:** 2026-06-14  
**Scope:** QM Live-Repository — Handbuch-Kapitel (List + Detail + Handbook)  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 39 setzte **QM Handbuch-Kapitel Live-Pfad** um — analog Sprint 27/28 Stationär/Akademie. `qmHandbookService` nutzt in Live-Modus `qmSupabaseRepository` mit Mapper statt hartcodiertem „Live-Anbindung vorbereitet“-Blocker. Migration 0015 deckt alle benötigten Spalten ab — keine neue Migration nötig.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchQmHandbook` | Live → `getHandbookMapped` |
| `fetchQmChapters` | Live → `listChaptersMapped` |
| `fetchQmChapter` | Live → `getChapterMapped` |
| `fetchQmDashboard` | Live → `listChaptersMapped` für Kapitelzähler |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/lib/qm/qmChapterMapper.ts` | DB-Zeile → `QmHandbookChapter`, Schema-Validierung |
| `src/lib/qm/qmHandbookMapper.ts` | DB-Zeile → `QmHandbook` |
| `src/lib/qm/qmRepository.supabase.ts` | `listChaptersMapped`, `getChapterMapped`, `getHandbookMapped`, `toGermanSupabaseError` |
| `src/lib/qm/qmHandbookService.ts` | `guardServiceTenant` + Live-Repo-Switch |
| `src/lib/qm/qmService.ts` | Dashboard Live-Pfad auf `listChaptersMapped` |
| `src/__tests__/qm/qmHandbookLive.test.ts` | 11 Mapper + Wiring Tests |

**Live-Verhalten:**

- Leere `qm_handbook_chapters` → leere Liste (ok)
- Zeilen ohne Titel → gefiltert (nicht in Liste)
- Fehlendes Schema-Feld → Fehler: `Live-QM-Handbuch: Supabase-Schema unvollständig (…)`
- Kein aktives Handbuch → `QM-Handbuch nicht gefunden.`
- Demo-Modus → unverändert `qmDemoRepository`
- Mutations (create/update/version) → weiterhin Demo-only

---

## 3. Demo vs. Live

| Modus | QM-Handbuch |
|-------|-------------|
| **Demo** | `qmDemoRepository` / 22 Kapitel |
| **Live (Supabase)** | `qmSupabaseRepository` — kein Demo-Fallback |
| **Schema** | Migration 0015 vollständig — keine 0031 nötig |
| **guardServiceTenant** | ✅ Handbook + Dashboard |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0015_quality_management_module.sql` | Basis-Schema für QM-Handbuch — **Remote prüfen** |
| `0021`–`0030` | Unverändert — siehe progress.md |

Keine destruktiven DB-Ops in Sprint 39.

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **617** passed (+11 zu Sprint 38) |
| `npm run smoke` | ✅ 253 routes |

---

## 6. Deferred to Sprint 40+

| Priorität | Item |
|-----------|------|
| P2 | View-Präferenz Durchführung + Fahrten |
| P2 | Store/EAS-Audit |
| P2 | QM Dokumente Live-Repository |

---

## 7. Verdict

QM-Handbuch liest Kapitel und Stammdaten jetzt ehrlich aus Supabase — Tree-Navigation profitiert im Live-Pilot. Dokumente, Compliance und MD-Mappe bleiben Demo-only.
