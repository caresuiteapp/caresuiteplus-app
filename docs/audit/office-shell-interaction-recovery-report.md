# Office Shell & Interaction Recovery Report

**Date:** 2026-06-18 (re-verified)  
**Branch:** `recovery/hybrid-live-restore`  
**Scope:** Shell/overlay interaction wiring only — no data service changes, no cosmetic token overrides

---

## Executive Summary

Initial shell recovery (commit `7a229e7`) fixed Aurora transparency and modal overlays for dashboard/clients/employees. Section 23 (commits `64d8735`–`ce9f1bd`) restored live messenger **data** flow but left **UI interaction gaps**: context panel breakpoint too high, thread header not using recovery gradient style, action toolbar labels incomplete, settings route 404, and CommunicationCenter empty-state replacing the full workspace shell.

This pass completes the messenger workspace interaction model without touching live data services.

---

## 1. Gap Analysis (user-reported vs code state)

| # | User report | Root cause | Status |
|---|-------------|------------|--------|
| 1 | Office > Nachrichten shows flat empty page | `CommunicationCenterScreen` replaced entire view with `EmptyState` when no threads; office route was correct but business path and empty inbox column looked like full-page empty | **Fixed** |
| 2 | Context panel (Kontext) not wired | Panel existed but only rendered at `width >= 1100px`; categories loaded via broken `useMemo` side effect | **Fixed** — desktop/≥960px, 320px column, `useEffect` + export action |
| 3 | 404 Communication > Einstellungen | No `app/communication/settings` route; office settings was placeholder stub | **Fixed** — redirects + wired `CommunicationSettingsScreen` |
| 4 | Thread missing GradientModalHeader style | `OfficeMessageThread` used plain text header | **Fixed** — `OfficeMessageThreadHeader` with gradient + status bar |
| 5 | Wrong screen / routing | `app/office/messages/index.tsx` had extra indirection; `(tabs)/messages` duplicate already removed | **Fixed** — direct `OfficeMessengerScreen` export |

### Section 23 agent (c3e58a34) partial work integrated

| Already done (kept) | This pass (added) |
|---------------------|-------------------|
| `createOfficeMessageThread`, `patchOfficeMessageThread` | Gradient thread header component |
| 3-column layout skeleton in `OfficeMessengerScreen` | Lower breakpoint, 320px context, action labels + broadcast on chats tab |
| `OfficeMessageContextPanel` handlers wired | Export button, category fetch fix |
| `NotificationBellWithCenter` in topbar | Settings route + nav entry |
| `ScreenShell` transparent on Aurora | CommunicationCenter always shows toolbar |

---

## 2. Fixes Applied (this commit)

### 2.1 Messenger workspace — always show 3-column shell

**File:** `src/screens/office/OfficeMessengerScreen.tsx`

- Context column: `shellVariant === 'desktop' || width >= 960`, width **320px**
- Inbox column: **340px** fixed
- Action row: **Neuer Klient:innen-Chat**, **Neuer Mitarbeitenden-Chat**, **Neuer interner Chat**, **Broadcast senden** (on chats tab when permitted)
- Deep link: `?thread=` selects thread
- Route: `app/office/messages/index.tsx` exports `OfficeMessengerScreen` directly

### 2.2 Thread header — recovery gradient style

**Files:** `src/components/office/officemessagethreadheader.tsx`, `officemessagethread.tsx`

- Participant label (e.g. **Mitarbeiter:in**) with gradient hero in dark mode
- Status subtitle row (type · subject · status)
- Empty thread pane keeps column chrome aligned via `officeMessengerEmptyStyles`

### 2.3 Context panel — fully wired

**File:** `src/components/office/officemessagecontextpanel.tsx`

- Fixed category fetch (`useEffect` not `useMemo`)
- **Chat exportieren** → `exportOfficeMessageThread` (audit stub, no demo fallback)
- Status / priority / category actions unchanged (live services untouched)

### 2.4 Settings route 404

**Files:** `app/communication/settings.tsx`, `app/communication/einstellungen.tsx`, `officemessagesettingsscreen.tsx`, `officenav.ts`, `routes.ts`

- Redirect `/communication/settings` and `/communication/einstellungen` → `/business/messages/settings`
- Office nav: **Einstellungen** → `/office/messages/settings` (renders `CommunicationSettingsScreen`)
- Breadcrumb labels for `communication`, `settings`, `templates`

### 2.5 Communication center empty state

**File:** `src/screens/communication/CommunicationCenterScreen.tsx`

- Removed full-page empty override; list view + toolbar always render (matches office messenger shell pattern)

---

## 3. Acceptance Criteria

| # | Criterion | Before | After |
|---|-----------|--------|-------|
| 1 | Aurora/Space background | ✅ PlatformShell + transparent ScreenShell (`7a229e7`) | ✅ Unchanged |
| 2 | Dashboard not white card | ✅ ModuleDashboardShell (`7a229e7`) | ✅ Unchanged |
| 3 | Messenger 3 columns (Inbox \| Thread \| Context) | ⚠️ 2 cols below 1100px; context fetch bug | ✅ Desktop/≥960px: 340 + flex + 320px |
| 4 | Broadcast opens as OfficeBroadcastModal | ✅ Modal wired | ✅ Also on chats tab action row |
| 5 | Context = OfficeMessageContextPanel | ⚠️ Panel present but narrow breakpoint | ✅ Wired with live patch handlers + export |
| 6 | Action buttons functional | ⚠️ Labels shortened; no broadcast on chats | ✅ All four actions open modals / broadcast |
| 7 | Live data services untouched | ✅ | ✅ No changes to `messageservice`, `broadcastService`, hooks data layer |
| 8 | No demo/mock fallback | ⚠️ Settings placeholder | ✅ Settings uses `CommunicationSettingsScreen`; export uses audit service |

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/screens/office/OfficeMessengerScreen.tsx` | 3-col breakpoints, action labels, broadcast on chats, thread param |
| `src/components/office/officemessagethreadheader.tsx` | **New** — gradient header + status bar |
| `src/components/office/officemessagethread.tsx` | Uses gradient header; aligned empty state |
| `src/components/office/officemessagecontextpanel.tsx` | useEffect categories, export button |
| `src/screens/communication/CommunicationCenterScreen.tsx` | Remove full-page empty override |
| `src/screens/office/officemessagesettingsscreen.tsx` | Delegate to CommunicationSettingsScreen |
| `app/office/messages/index.tsx` | Direct OfficeMessengerScreen export |
| `app/communication/settings.tsx` | **New** — redirect to business settings |
| `app/communication/einstellungen.tsx` | **New** — German alias redirect |
| `src/lib/navigation/modulenav/officenav.ts` | Einstellungen nav item |
| `src/lib/navigation/routes.ts` | Settings/templates/communication route entries |
| `src/lib/navigation/breadcrumbs.ts` | `communication` segment label |

---

## 5. Verification

- `npx expo export --platform web` — **passed**
- Live services (`clientListService`, `employeeListService`, `messageservice`, `broadcastService`) — **not modified**
- Prior commits retained: `7a229e7` (shell), `64d8735` (messenger data), `ce9f1bd` (bell)

---

## 6. Architecture (post-fix)

```
app/office/messages/index.tsx → OfficeMessengerScreen
  ScreenShell (transparent on Aurora)
    ├── Action row → OfficeNewChatModal / OfficeBroadcastModal
    └── 3-column messenger
          ├── OfficeMessagesInbox (340px)
          ├── OfficeMessageThread + OfficeMessageThreadHeader
          └── OfficeMessageContextPanel (320px, desktop)
```

---

## 7. Remaining Open Items

- `OfficeMessageTemplatesScreen` still placeholder — templates content recovery is separate
- Broadcast send on live still requires migration **0096** on Supabase (RLS)
- Other office sub-screens (invoices, documents) still use `CareLightPageShell` directly on non-Aurora paths
