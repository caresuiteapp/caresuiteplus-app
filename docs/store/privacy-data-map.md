# Privacy & Data Map — CareSuite+

**Stand:** 2026-06-13  
**Zweck:** App Store Privacy Questionnaire, Google Data Safety, DSGVO-Dokumentation

---

## Datenverarbeitung — Vollständige Tabelle

| Datenkategorie | Gesammelt | Zweck | Rechtsgrundlage | Speicherort | Verschlüsselung | Geteilt | Aufbewahrung | Store-Label |
|----------------|-----------|-------|-----------------|-------------|-----------------|---------|--------------|-------------|
| Name | Ja | Auth, Akte, Kommunikation | Art. 6(1)b | Supabase EU | TLS + RLS | Nein | Vertragslaufzeit | Contact Info |
| E-Mail | Ja | Login, Benachrichtigungen | Art. 6(1)b | Supabase EU | TLS + RLS | Nein | Vertragslaufzeit | Contact Info |
| User-ID / Mandant-ID | Ja | Mandantentrennung | Art. 6(1)b/f | Supabase EU | RLS | Nein | Vertragslaufzeit | Identifiers |
| Pflegedaten / Gesundheit | Ja | Pflegedokumentation | Art. 9(2)h | Supabase EU | RLS | Nein* | Gesetzl. Fristen | Health |
| Adresse / Kontakt Klient | Ja | Versorgung, Abrechnung | Art. 6(1)b | Supabase EU | RLS | Nein | Vertragslaufzeit | Contact Info |
| Kommunikationsinhalte | Ja | Nachrichten, Anhänge | Art. 6(1)b | Supabase EU | RLS | Nein | Mandanten-Retention | — |
| Dokumente / PDFs | Teilweise | Akte, Rechnungen | Art. 6(1)b | Supabase Storage | RLS | Nein | 10 J. (Pflege) | — |
| Standort / GPS | Nein | — | — | — | — | — | — | — |
| Kamera / Fotos | Nein* | — | — | — | — | — | — | — |
| Mikrofon / Sprache | Nein* | UI vorbereitet | — | — | — | — | — | — |
| Push-Token | Nein* | Geplant | — | — | — | Expo Push | — | — |
| Geräte-ID (Analytics) | Nein | — | — | — | — | — | — | — |
| Absturzberichte | Nein* | Geplant (Sentry) | Art. 6(1)f | Anbieter EU | TLS | Anbieter | 90 Tage | Diagnostics |
| Zahlungsdaten | Nein | Stripe Web (B2B) | — | Stripe | — | — | — | — |
| Login-Audit | Ja | Sicherheit | Art. 6(1)f | Supabase | RLS | Nein | Konfigurierbar | — |

\*Nicht im aktuellen Build implementiert oder nur vorbereitet (preparedOnly).

---

## Supabase — Technische Details

- **Auth:** E-Mail/Passwort, Portal-Codes (Edge Functions)
- **Datenbank:** PostgreSQL mit Row Level Security pro `tenant_id`
- **Storage:** Dokumente, Anhänge (geplant/teilweise)
- **Realtime:** Kommunikationszentrum (Vorbereitung)
- **Region:** EU (Projekt `caresuiteplus-production` — Remote)

---

## Rechtsgrundlagen (DSGVO)

| Verarbeitung | Grundlage |
|--------------|-----------|
| Vertragspflege (B2B SaaS) | Art. 6 Abs. 1 lit. b |
| Gesundheitsdaten | Art. 9 Abs. 2 lit. h (Pflege) + Einwilligung wo nötig |
| Mitarbeiter-Auth | Art. 6 Abs. 1 lit. f / b |

---

## Betroffenenrechte

- Auskunft, Berichtigung, Löschung über Mandanten-Admin
- Export: geplant über Reporting-Modul
- Beschwerde: Landesdatenschutzbehörde

---

## Aufbewahrung

- Mandantendaten: Vertragslaufzeit + gesetzliche Fristen (Pflege: 10 Jahre relevante Dokumente)
- Auth-Logs: `login_audit` — konfigurierbar
- Kommunikation: mandantenspezifische Retention (Settings-Tabelle)

---

## App Store Privacy Labels (Mapping)

| Apple-Kategorie | CareSuite+ |
|-----------------|------------|
| Contact Info | Ja |
| Health & Fitness | Ja (Pflegedaten) |
| Identifiers | User ID |
| Usage Data | Nein (aktuell) |

---

## Google Data Safety (Mapping)

- Personal info: Name, Email — **Collected, not shared**
- Health info: Care records — **Collected, encrypted in transit, not shared**
- App activity: Not collected (current build)

---

## Datenschutz-URL

https://caresuiteplus.de/datenschutz (Platzhalter — vor Store-Launch live schalten)

---

## Verantwortlicher

[Mandanten-/Firmenname eintragen]  
[Adresse]  
[Datenschutzbeauftragter Kontakt]
