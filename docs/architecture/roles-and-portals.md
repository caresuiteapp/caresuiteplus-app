# CareSuite+ — Rollen & Portale

## Rollen (role_key)

| Key | Deutsches Label | Bereich |
|-----|-----------------|---------|
| `business_admin` | Geschäftsführung / Admin | Business |
| `business_manager` | Bereichsleitung | Business |
| `billing` | Abrechnung | Business |
| `dispatch` | Einsatzplanung | Business |
| `nurse` | Pflegefachkraft | Fachlich |
| `caregiver` | Alltagsbegleiter:in | Fachlich |
| `counselor` | Beratungskraft | Fachlich |
| `akademie_admin` | Akademie-Admin | Fachlich |
| `employee_portal` | Mitarbeiterportal | Portal |
| `client_portal` | Klient:innenportal | Portal |
| `family_portal` | Angehörigenportal | Portal |

## Portalgrenzen

| Portal | Sichtbarkeit | Regel |
|--------|--------------|-------|
| Mitarbeiter | `own`, `team` | Eigene Einsätze, Team-Kalender |
| Klient:in | `own`, `shared` | Nur eigene oder freigegebene Daten |
| Angehörige:r | `shared` | Nur explizit freigegebene Informationen |
| Business | `tenant_admin` | Vollständiger Mandantenzugriff (rollenbasiert) |

## Datenschutz-Stufen (`SensitivityLevel`)

| Stufe | Beschreibung | Beispiel |
|-------|--------------|----------|
| `public` | Öffentlich im Mandant | Kursname |
| `internal` | Intern, nicht portal | Rechnungsnummer |
| `care` | Pflegerelevant | Einsatzprotokoll |
| `health` | Gesundheitsdaten | Vitalwerte, Medikation |
| `restricted` | Höchste Stufe | Diagnosen, psych. Befunde |

## RLS-Policy-Muster (Vorbereitung WP 010)

```sql
-- Lesen nur eigener Mandant
CREATE POLICY "tenant_isolation_select"
  ON public.example_table FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
    )
  );
```

Portal-spezifische Policies ergänzen `owned_by` / `shared_with` Felder (ab WP 012).

## Provider-Sicherheit

Integrationen speichern **keine Secrets** im Frontend. Nur `secret_reference` (z. B. `vault:integration-uuid`) — der echte Wert liegt in Supabase Vault / Edge Functions.
