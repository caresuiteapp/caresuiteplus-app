# MEGA Masterprompt v2 — Sprint 41 Report

**Datum:** 2026-06-14  
**Scope:** QM Dokumente Live-Repository (List + Detail + Versionen)  
**Verdict:** Ehrlicher Live-Wiring-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 41 setzte **QM Dokumente Live-Pfad** um — analog Sprint 39 Handbuch-Kapitel. `qmDocumentService` nutzt in Live-Modus `qmSupabaseRepository` mit Mapper statt hartcodiertem „Live-Anbindung vorbereitet“-Blocker. Bewohner/Kurse View-Präferenz (Toggle + Persistenz) bleibt für Sprint 43+.

---

## 2. Implementiert

| Service | Änderung |
|---------|----------|
| `fetchQmDocuments` | Live → `listDocumentsMapped` |
| `fetchQmDocument` | Live → `getDocumentMapped` |
| `fetchQmDocumentVersions` | Live → `listDocumentVersionsMapped` |
| `fetchQmDashboard` | Live → `listDocumentsMapped` für Dokumentzähler + pendingApprovals |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `src/lib/qm/qmDocumentMapper.ts` | DB-Zeile → `QmDocument` / `QmDocumentVersion`, Schema-Validierung |
| `src/lib/qm/qmRepository.supabase.ts` | `listDocumentsMapped`, `getDocumentMapped`, `listDocumentVersionsMapped` |
| `src/lib/qm/qmDocumentService.ts` | `guardServiceTenant` + Live-Repo-Switch |
| `src/lib/qm/qmService.ts` | Dashboard Live-Pfad auf `listDocumentsMapped` |
| `src/__tests__/qm/qmDocumentLive.test.ts` | 12 Mapper + Wiring Tests |

**Live-Verhalten:**

- Leere `qm_documents` → leere Liste (ok)
- Zeilen ohne Titel/Nummer → gefiltert (nicht in Liste)
- Fehlendes Schema-Feld → Fehler: `Live-QM-Dokumente: Supabase-Schema unvollständig (…)`
- Kein Dokument → `Dokument nicht gefunden.`
- Demo-Modus → unverändert `qmDemoRepository`
- Freigabe, Lesebestätigungen → weiterhin Demo-only

---

## 3. Demo vs. Live

| Modus | QM-Dokumente |
|-------|--------------|
| **Demo** | `qmDemoRepository` / 30+ Dokumente |
| **Live (Supabase)** | `qmSupabaseRepository` — kein Demo-Fallback |
| **Schema** | Migration 0015 vollständig — keine neue Migration nötig |
| **guardServiceTenant** | ✅ List + Detail + Versionen |

---

## 4. Migration-Hinweis (Remote)

| Migration | Status |
|-----------|--------|
| `0015_quality_management_module.sql` | Basis-Schema für QM-Dokumente — **Remote prüfen** |
| `0021`–`0030` | Unverändert — siehe progress.md |

Keine destruktiven DB-Ops in Sprint 41.

---

## 5. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ **631** passed (+12 zu Sprint 40) |
| `npm run smoke` | ✅ 253 routes |

---

## 6. Deferred to Sprint 43+

| Priorität | Item |
|-----------|------|
| P2 | Bewohner/Kurse View-Toggle + AsyncStorage-Persistenz |
| P2 | Remote-Migrationen 0021–0030 anwenden + Live-Pilot-Seed |
| P2 | QM Lesebestätigungen Live-Repository |
| P3 | DSGVO DataRequest/AccountDeletion Screens |
| P3 | EAS project:init + Preview Builds |

---

## 7. Verdict

QM-Dokumente lesen Liste, Detail und Versionen jetzt ehrlich aus Supabase — Dokumentenverwaltung profitiert im Live-Pilot. Compliance, MD-Mappe und Freigabe bleiben Demo-only.
