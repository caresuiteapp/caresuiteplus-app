# CareSuite+ Office als Basis-Modul

**Stand:** 13.06.2026  
**Produktregel:** CareSuite+ Office kann separat gebucht werden. Sobald **mindestens ein Fachmodul** (Assist, Pflege, Stationär, Beratung, Akademie) aktiv ist, wird Office **automatisch als Basisverwaltung enthalten** — ohne Doppelabrechnung.

---

## 1. Produktregel

| Situation | Office-Status | Abrechnung |
| --------- | ------------- | ---------- |
| Nur Office gebucht | `access_source: purchased` | billable |
| Fachmodul ohne Office | Office `included_base` | Office: included |
| Office + Fachmodul | Office bleibt `purchased` | beide billable |
| Letztes Fachmodul gekündigt, Office nur included | Office deaktiviert | not_billed |
| Letztes Fachmodul gekündigt, Office purchased | Office bleibt aktiv | billable |

---

## 2. Datenmodell

Erweiterung von `TenantProduct` (`src/types/core/tenant.ts`):

| Feld | Typ | Bedeutung |
| ---- | --- | --------- |
| `accessSource` | `ModuleAccessSource` | purchased, included_base, trial, admin_granted, demo, expired, disabled |
| `includedByModuleKey` | `ProductKey \| null` | Welches Fachmodul Office enthält |
| `isBaseIncluded` | `boolean` | Office als Basis ohne Zusatzabo |
| `billingStatus` | `ModuleBillingStatus` | billable, included, not_billed |

Supabase: Migration `0013_tenant_product_module_access.sql` ergänzt `tenant_products`.

---

## 3. Services

| Service | Pfad | Aufgabe |
| ------- | ---- | ------- |
| `moduleAccessService` | `src/lib/modules/moduleAccessService.ts` | Freischaltung, effective access, activate/deactivate |
| `moduleEntitlementService` | `src/lib/modules/moduleEntitlementService.ts` | `calculateBillingItems()` — keine Doppelabrechnung |

Kernfunktionen:

- `getEffectiveModuleAccess(tenantId)` — effektiver Modulstatus inkl. Office
- `activatePurchasedModule(tenantId, key)` — Fachmodul buchen → Office included_base (falls nicht purchased)
- `deactivateModule(tenantId, key)` — Kündigung → Office included_base entfernen
- `hasModuleAccess(key, tenantId)` — Modul-Gate (Produkt aktiv)
- `hasEffectiveModuleGateAccess(key, tenantId)` — Assist impliziert Office

---

## 4. UI & Navigation

- **ModuleOverviewScreen:** Badges „Gebucht“, „Inklusive“, „Basis-Modul“
- **SubscriptionScreen:** Hinweis auf enthaltene Basisverwaltung
- **Navigation / Module-Switcher:** nutzt `getEffectiveModuleAccess()` statt statischer Demo-Liste
- **RequireProductAccess / isProductActive:** delegieren an `hasEffectiveModuleGateAccess()` (Assist impliziert Office-Gate)

---

## 5. Rollen vs. Modul-Zugriff

| Ebene | Prüfung | Beispiel |
| ----- | ------- | -------- |
| Modul-Gate | `hasModuleAccess` / `hasEffectiveModuleGateAccess` | Pflege aktiv → Office-Modul erreichbar |
| Rollenrechte | `usePermissions().can(...)` | Pflegefachkraft: kein Rechnungszugriff |

Ein aktives Pflege-Modul **erteilt keinen** automatischen `office.invoices.view`-Zugriff.

---

## 7. Abrechnung & Warenkorb

Siehe auch [pricing-and-packages.md](./pricing-and-packages.md).

### Beispiele (Demo-Warenkorb)

**Assist only (149 € gesamt):**

| Position | Betrag |
| -------- | ------ |
| CareSuite+ Assist | 149 € |
| CareSuite+ Office | Inklusive |
| **Summe** | **149 €** |

**Pflege Pro Paket (299 € gesamt):**

| Position | Betrag |
| -------- | ------ |
| Pflege Pro | 299 € |
| CareSuite+ Office | Inklusive |
| CareSuite+ Assist | Inklusive |
| **Summe** | **299 €** |

**Assist + Pflege manuell (378 € — kein Paketrabatt):**

| Position | Betrag |
| -------- | ------ |
| CareSuite+ Assist | 149 € |
| CareSuite+ Pflege | 229 € |
| CareSuite+ Office | Inklusive |
| **Summe** | **378 €** |

Implementierung: `src/lib/billing/billingPreviewService.ts` → `calculateCartTotal()`.

---

## 8. Tests

`src/__tests__/core/moduleAccess.test.ts` — Szenarien: Office allein, Assist+Office, Kündigung, purchased+Assist, Rollentrennung.

---

## 9. TI-Infrastruktur (kein Fachmodul)

**Telematik (TI/KIM/ePA)** ist **kein** `ProductKey` und **kein** Fachmodul im Sinne der Office-Basisregel.

| Frage | Antwort |
| ----- | ------- |
| TI allein ohne Office/Fachmodul? | **Nein** — TI setzt weiterhin ein aktives Mandantenprodukt voraus |
| TI aktiviert Office automatisch? | **Nein** — nur Assist, Pflege, Stationär, Beratung, Akademie lösen `included_base` aus |
| TI + Fachmodul | Office wird über das Fachmodul enthalten, TI bleibt Integrationsbereich |

TI-Zugriff wird separat über Integrations-/TI-Services und Rollenrechte gesteuert (`src/lib/ti/`), nicht über `SPECIALTY_MODULE_KEYS`.

---

## 10. Offene Punkte (Live-Pilot)

- Supabase-Repository für `tenant_products` mit neuen Spalten
- Live-Navigation: Tenant-ID aus Profil statt `DEMO_TENANT_ID` Default
- Kauf-UI: echte Stripe-Anbindung für `activatePurchasedModule`
