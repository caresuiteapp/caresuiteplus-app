# CareSuite+ — Fundament (Arbeitspaket 001)

## Produktvision

CareSuite+ ist eine modulare, mandantenfähige SaaS-Mobile-App für Pflege- und Betreuungsunternehmen. Die Plattform vereint Verwaltung (Office), Alltagsbegleitung (Assist), Pflege (Pflege), stationäre Versorgung (Stationär), Beratung (Beratung) und Weiterbildung (Akademie) in einer einheitlichen Premium-Oberfläche.

Querschnittsfunktionen (AI, OCR, Telemedizin, Integrationen, Reporting, Operations) werden über sichere Provider-Abstraktionen angebunden — ohne Secrets im Frontend.

## Schichtenmodell

| Schicht | Pfad | Verantwortung |
|---------|------|---------------|
| Routing | `app/` | Expo Router, Screens, Layouts, Guards (ab WP 002) |
| UI | `src/components/ui/` | Wiederverwendbare Premium-Komponenten |
| Theme | `src/theme/` | Design-Tokens (Farben, Typo, Abstände) |
| Verträge | `src/types/` | TypeScript-Interfaces, Enums, Status |
| Demo-Daten | `src/data/demo/` | Fixtures für Demo-Modus (gleiche Typen wie Supabase) |
| IO / Services | `src/lib/` | Supabase-Client, Auth, Business-Services (ab WP 007) |
| Datenbank | `supabase/migrations/` | SQL-Schema, RLS (ab WP 010) |

## Mandantenmodell

- Jeder Pflegedienst ist ein **Tenant** (`tenants.id`).
- Benutzer:innen haben ein **Profile** mit `tenant_id` und `role_key`.
- Alle fachlichen Entitäten tragen `tenantId` (TypeScript) bzw. `tenant_id` (Datenbank).
- RLS-Policies beschränken Lese-/Schreibzugriff auf den eigenen Mandanten.

## Supabase-Anbindungsplan

1. **Auth**: Supabase Auth → `profiles` Trigger bei Registrierung
2. **RLS**: `auth.uid()` → `profiles.tenant_id` → mandantenisolierte Policies
3. **Storage**: Buckets pro Mandant/Modul mit RLS auf `storage.objects`
4. **Realtime**: Kanäle für Nachrichten, Einsätze, Übergaben (tenant-scoped)
5. **Edge Functions**: Secrets nur serverseitig; Frontend nutzt `secret_reference`

## Bekannte Grenzen (nach WP 001)

- ~~Keine Auth- oder Routen-Guards~~ (umgesetzt in WP 002)
- ~~Keine produktiven Services/Hooks~~ (umgesetzt in WP 007/008)
- ~~Keine SQL-Migration~~ (vorbereitet in WP 010 — manuell via `supabase db push`)
- Demo-Daten nur Fundament-Snapshot (→ WP 011)
- PremiumInput, ModuleTile, SectionPanel, Timeline noch offen (→ WP 003–006)
