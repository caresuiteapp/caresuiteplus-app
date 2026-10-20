# MEGA Masterprompt v2 — Sprint 24 Report

**Datum:** 2026-06-14  
**Scope:** Office-Nachrichten Compose + Antwort (echte Demo-Flows)  
**Verdict:** Funktionaler Office-Kommunikations-Slice — **NOT production/store ready**

---

## 1. Entscheidung

Sprint 24 wählte **Office-Nachrichten Compose/Antwort** (P1) statt Desktop-Tabellen Bewohner/Kurse (P2), da Compose-Infrastruktur (`MessageComposeScreenShell`, `useDomainComposeMessage`, `sendDomainMessage`) bereits teilweise existierte.

---

## 2. Implementiert

| Route / Flow | Änderung |
|--------------|----------|
| `/office/messages/compose` | Neue Route → `OfficeComposeMessageScreen` |
| Office-Liste | „Neue Nachricht“-Button (nicht Lesemodus) |
| Summary-Panel | Antwort-Formular mit Persistenz |

**Neue / überarbeitete Dateien:**

| Datei | Zweck |
|-------|-------|
| `app/office/messages/compose.tsx` | Expo-Route |
| `src/data/demo/portalMessageStore.ts` | `replyToDemoOfficeMessage` |
| `src/lib/portal/messageService.ts` | Mutable Store, `replyToOfficeMessage`, `canReply: true` |
| `src/hooks/useOfficeMessageDetail.ts` | Reply-Mutation |
| `src/components/office/OfficeMessageDetailSummaryPanel.tsx` | Antwort-UI |
| `src/components/office/OfficeMessagesListView.tsx` | Compose-Navigation |
| `src/lib/navigation/routes.ts` | Route registriert |
| `src/__tests__/office/officeMessagesList.test.ts` | Compose + Reply Tests (+5) |

**UX:** Compose mit Validierung (Betreff, ≥10 Zeichen), Demo-Persistenz via `appendDomainMessage`, Antwort im Master-Detail mit Lesemodus-Schutz.

---

## 3. Demo vs. Live

| Modus | Office-Nachrichten |
|-------|-------------------|
| **Demo** | Compose + Antwort persistieren in `portalMessageStore` |
| **Live (Supabase)** | `guardServiceTenant` — kein Live-Backend für Nachrichten |
| **service_role im Frontend** | ❌ Nicht verwendet |

---

## 4. Quality Gates

| Gate | Ergebnis |
|------|----------|
| `npm run typecheck` | ✅ |
| `npm run test` | ✅ (siehe kumulativ) |
| `npm run smoke` | ✅ 253 routes |

---

## 5. Deferred to Sprint 25+

| Priorität | Item |
|-----------|------|
| P1 | Live Trip-Detail-Mapping |
| P1 | Live Stationär/Akademie List/Detail |
| P1 | Live Reporting List/Detail |
| P2 | Desktop-Tabelle Bewohner:innen + Kurse |
| P2 | View-Toggle Karten/Tabelle auf Desktop |

---

## 6. Verdict

Erste echte Office-Nachrichten-Flows (Compose + Antwort) ohne Fake-Buttons — weiterhin Demo-Persistenz, kein Supabase-Backend. **Kein Store-Release.**
