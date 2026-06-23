# Client UI Reality Fix — Abnahmebericht

**Datum:** 2026-06-23  
**Scope:** Klient:innen Liste, Akte, Stammdaten bearbeiten, Neuaufnahme-Wizard  
**Ausgeschlossen:** K.6 Rechnungen, Deploy, DB-Push, Assist/Office-Dashboards

---

## 1. Zusammenfassung

Lesbarkeit und Arbeitsabläufe für Office-Klient:innen wurden überarbeitet: Tabellenkontrast auf LLGAN-Glas, kompakte KPI-Zeile in der Liste, restrukturierte Akte-Tabs, Gefahrenzone für Löschen, vollständiges Stammdaten-Modal, klickbarer Intake-Wizard mit Entwurf-Speicherung.

---

## 2. Phase 2 — Liste (§2, §3)

| Punkt | Status | Umsetzung |
|-------|--------|-----------|
| Tabellentext dunkel auf hellem Glas | ✅ | `useAuroraAdaptiveText` in `ClientsListTable`, `useAuroraGlassTableStyles` Header `text.primary` |
| Kompakte KPI-Zeile (Gesamt, Aktiv, Entwürfe) | ✅ | `buildClientListKpis` + `ClientsListHero` compact KPI row |
| Kleinere Buttons | ✅ | `size="sm"` in Hero und Wizard-Footer |
| Name fett, Zebra, Badges | ✅ | Bold name, `PremiumDataTable` zebra, Status-Badges |
| Empty States DE | ✅ | Encoding-Fixes in `ClientsListView` |

---

## 3. Phase 3 — Akte (§4)

| Punkt | Status | Umsetzung |
|-------|--------|-----------|
| Tab-Struktur | ✅ | `normalizeClientRecordTabs` + aktualisierte `CLIENT_RECORD_TAB_LABELS` |
| KPI-Karten lesbar | ✅ | Rechnungs-KPI entfernt, „Offene Punkte“ statt Rechnungen |
| Übersicht-Sections | ✅ | Kurzüberblick, Nächster Termin, Offene Punkte, Dokumente, Schnellaktionen |
| Löschen in Gefahrenzone | ✅ | `SectionPanel` am Ende von `ClientRecordScreen` |

---

## 4. Phase 4 — Stammdaten bearbeiten (§5)

| Punkt | Status | Umsetzung |
|-------|--------|-----------|
| Sektionen (Identität … Interne Hinweise) | ✅ | `ClientMasterDataEditModal` + `CLIENT_MASTER_DATA_SECTIONS` |
| Scroll + sticky Footer | ✅ | `ScrollView` + `AppGlassModal` footerActions |
| Draft vs Active Validierung | ✅ | bestehende `validateIntakeStep` / `submit` |
| Ungespeichert-Bestätigung | ✅ | `confirmAction` beim Schließen |

---

## 5. Phase 5 — Intake-Wizard (§6)

| Punkt | Status | Umsetzung |
|-------|--------|-----------|
| Klickbarer Stepper 1–10 | ✅ | `FormStepper` `onStepPress` + `goToStep` |
| Completed/Error Steps | ✅ | `stepStatuses` in Hook + Stepper |
| Entwurf speichern | ✅ | Footer-Buttons in `ClientIntakeWizardForm` |
| Sticky Footer + Scroll | ✅ | `styles.root` / `styles.footer` |
| Aktivieren nur Schritt 10 | ✅ | Button „Klient:in aktivieren“ auf letztem Schritt |

---

## 6. Phase 6 — Copy (§7)

| Alt | Neu |
|-----|-----|
| Kontextbasierte Aufnahme | Klient:in aufnehmen |
| Besonderheiten | Interne Hinweise |
| Filter zur?cksetzen | Filter zurücksetzen |
| Schnellzugriff | Schnellaktionen |

---

## 7. Tests & Typecheck

| Log | Ergebnis |
|-----|----------|
| `.audit-test-client-ui-reality-fix.log` | ✅ 12/12 `clientUiRealityFix.test.ts` |
| `.audit-typecheck-client-ui-reality-fix.log` | ⚠️ Repo-weite TS-Fehler (bestehend); geänderte Client-UI-Dateien bereinigt |

---

## 8. §15 Checkliste (17 Punkte)

| # | Prüfpunkt | Status |
|---|-----------|--------|
| 1 | Klient:innen-Liste lesbar auf LLGAN-Glas | ✅ |
| 2 | KPI-Zeile kompakt (Gesamt, Aktiv, Entwürfe) | ✅ |
| 3 | Tabellenzebra + dunkler Name | ✅ |
| 4 | Empty States auf Deutsch | ✅ |
| 5 | Akte-Tabs restrukturiert | ✅ |
| 6 | Übersicht mit Kurzüberblick + Termin + Offene Punkte | ✅ |
| 7 | Löschen in Gefahrenzone | ✅ |
| 8 | Stammdaten-Modal mit allen Sektionen | ✅ |
| 9 | Modal scroll + sticky Save/Cancel | ✅ |
| 10 | Ungespeichert-Warnung | ✅ |
| 11 | Wizard Stepper klickbar | ✅ |
| 12 | Step completed/error Markierung | ✅ |
| 13 | Entwurf speichern jederzeit | ✅ |
| 14 | Wizard sticky Footer | ✅ |
| 15 | Aktivieren nur auf letztem Schritt | ✅ |
| 16 | Keine Rechnungs-KPIs in Akte (K.6 ausgeschlossen) | ✅ |
| 17 | Assist/Office-Dashboard unverändert | ✅ |

---

## 9. Geänderte Dateien (selective commit)

- `src/components/office/ClientsListTable.tsx`
- `src/components/office/ClientsListHero.tsx`
- `src/components/office/ClientsListView.tsx`
- `src/components/office/ClientMasterDataEditModal.tsx`
- `src/components/office/ClientRecordOverviewPanel.tsx`
- `src/components/office/clientintakewizardform.tsx`
- `src/components/ui/FormStepper.tsx`
- `src/design/tokens/auroraGlass.ts`
- `src/hooks/useClientIntakeWizard.ts`
- `src/lib/clients/clientIntakeFieldRules.ts`
- `src/lib/clients/clientMasterDataSections.ts`
- `src/lib/clients/clientRecordOverview.ts`
- `src/lib/office/clientDetailStats.ts`
- `src/lib/office/clientListStats.ts`
- `src/screens/business/office/ClientIntakeWizardScreen.tsx`
- `src/screens/business/office/ClientRecordScreen.tsx`
- `src/screens/business/office/ClientRecordTabPanels.tsx`
- `src/__tests__/clients/clientUiRealityFix.test.ts`
- `src/__tests__/clients/clientIntakeWizardUx.test.ts`
- `src/__tests__/office/officeClientsList.test.ts`
- `docs/audit/client-ui-reality-fix-abnahmebericht.md`

**Commit:** `fix(clients): improve record readability and intake workflow`  
**Push:** `origin main` ohne `[deploy]`
