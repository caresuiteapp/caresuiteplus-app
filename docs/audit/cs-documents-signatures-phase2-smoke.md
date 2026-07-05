# CareSuite+ — Phase 2 Smoke: Dokumente & Unterschriften

## Scope

End-to-End-Flow: Office → Send-Wizard → Portal → Signatur → Erledigt

**Nicht in Phase 2:** Einsatzstart-Blockade, PDF-Archiv, produktives Deploy.

## Automatisierte Checks

| Check | Befehl |
|-------|--------|
| Unit/Service-Tests | `npm test -- src/__tests__/documents/csTemplateDatabase.test.ts` |
| Migration + Seed | `node scripts/audit/verify-cs-vorlagen-db.mjs` |

## Manuelle Smoke-Checkliste

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

## Bekannte Phase-2-Grenzen

| Thema | Status |
|-------|--------|
| Migration remote | Manuell anwenden + `verify-cs-vorlagen-db.mjs` |
| PDF-Export | Phase 4 |
| `hasBlockingCsDocumentForAssignment` | Vorbereitet, **nicht** am Einsatzstart |
| Audit-Log | Best-effort über `audit_logs` wenn Tabelle existiert |
| Juristische Vorlagen | Technische Muster — nicht rechtsverbindlich |

## Ergebnis dokumentieren

Nach jedem Lauf: Datum, Umgebung (lokal/staging/prod), Pass/Fail pro Schritt, Screenshots optional unter `.audit-screenshots-*` (nicht committen).
