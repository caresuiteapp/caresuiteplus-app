# CareSuite+ — Phase 2 / 2.1 Smoke: Dokumente & Unterschriften

Stand: 2026-07-05 (Phase 2.1 abgeschlossen bis Remote-Verify + Unit-Tests)

## Scope

End-to-End-Flow: Office → Send-Wizard → Portal → Signatur → Erledigt

**Nicht in Phase 2/2.1:** Einsatzstart-Blockade, PDF-Archiv, produktives Deploy.

## Phase 2.1 Abschluss (automatisiert)

| Check | Befehl | Ergebnis 2026-07-05 |
|-------|--------|----------------------|
| Feature-Commit | `a075fc8d` | Ja (Branch `cursor/cs-vorlagen-documents-signatures-phase2`) |
| Migration remote | `0233_cs_vorlagen_datenbank.sql` (Teilschritte) | **Angewendet** |
| Verify | `node scripts/audit/verify-cs-vorlagen-db.mjs` | **Exit 0** |
| Unit-Tests | `npm test -- src/__tests__/documents/csTemplateDatabase.test.ts` | **19/19 grün** |
| E2E Browser-Smoke | Manuell (unten) | **Noch offen** |
| Push / Deploy | — | **Nein** |

## Automatisierte Checks

| Check | Befehl |
|-------|--------|
| Unit/Service-Tests | `npm test -- src/__tests__/documents/csTemplateDatabase.test.ts` |
| Migration + Seed | `node scripts/audit/verify-cs-vorlagen-db.mjs` |

## Manuelle E2E-Smoke-Checkliste (noch ausstehend)

### Office (`/business/office/documents/signatures`)

- [ ] Seite lädt ohne White Screen
- [ ] Tabs: Offen / In Bearbeitung / Erledigt / Alle
- [ ] Send-Wizard öffnet
- [ ] Vorlage wählbar (Kategorie + Liste)
- [ ] Empfängertyp: Mitarbeiter / Klient:in / Beide
- [ ] **Keine sichtbaren UUID-Felder**
- [ ] Mitarbeitersuche: Name, E-Mail, Rolle, Status, Portal-Badge
- [ ] Klient:innensuche: Name, Ort, Pflegegrad, Kostenträger, Vertretung
- [ ] Vorschau rendert Platzhalter (keine Roh-`{{…}}` außer Warnungen)
- [ ] Signaturbereiche in Vorschau markiert
- [ ] Senden erstellt Request (Status „Gesendet“)
- [ ] Validierung zeigt fachliche Fehler (z. B. fehlender Empfänger)

### Mitarbeiterportal (`/portal/employee/documents/signatures`)

- [ ] Offene Dokumente sichtbar
- [ ] Karte: Titel, Fälligkeit, Priorität, Status
- [ ] Aktion „Öffnen und unterschreiben“
- [ ] Signaturmodal → Absenden
- [ ] Dokument verschwindet aus „Offen“
- [ ] Erscheint unter „Erledigt“

### Klient:innenportal (`/portal/client/documents/signatures`)

- [ ] Analog Mitarbeiterportal

### Office nach Signatur

- [ ] Request unter „Erledigt“
- [ ] HTML-Archiv (`rendered_html`) nachvollziehbar
- [ ] Kein Fake-PDF in `cs_document_request_files`

## Bekannte Grenzen

| Thema | Status |
|-------|--------|
| Migration remote | **Erledigt** (0233, verify Exit 0) |
| PDF-Export | Phase 4 |
| `hasBlockingCsDocumentForAssignment` | Vorbereitet, **nicht** am Einsatzstart |
| Audit-Log | Best-effort über `audit_logs` wenn Tabelle existiert |
| Juristische Vorlagen | Technische Muster — nicht rechtsverbindlich |
| E2E Browser-Smoke | **Nächster Schritt** |

## Ergebnis dokumentieren

Nach jedem E2E-Lauf: Datum, Umgebung (lokal/staging/prod), Pass/Fail pro Schritt. Screenshots optional unter `.audit-screenshots-*` (**nicht committen**).

## Empfehlung

| Kriterium | Bereit? |
|-----------|---------|
| E2E-Smoke (manuell) | **Ja** — Remote-DB + Code committed, Verify grün |
| Phase 3 (Einsatz-Blockade) | **Nein** — erst nach E2E-Smoke |
| Deploy | **Nein** — explizit nicht Teil Phase 2.1 |
