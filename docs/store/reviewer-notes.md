# App Store / Play Store — Reviewer Notes

**App:** CareSuite+  
**Stand:** 2026-06-13

---

## App-Typ

B2B SaaS — Zugang nur mit Mandanten-Zugangsdaten. Kein öffentlicher Self-Service ohne Registrierung durch Pflegedienst.

---

## Demo-Zugang für Reviewer

> **Hinweis:** Vor Submission echte Demo-Credentials in App Store Connect / Play Console eintragen.

| Rolle | Login-Typ | Pfad |
|-------|-----------|------|
| Business Admin | Business Login | `/auth/business-login` |
| Office User | Business Login (Rolle office) | `/office` |
| Mitarbeiter-Portal | Mitarbeiter-Login | `/auth/employee-login` |
| Klient:innen-Portal | Portal-Code | `/auth/client-login` |

**Empfohlener Review-Flow:**

1. App starten → Startseite
2. Business Login → Demo-Mandant
3. Modul **Office** → Klient:innen-Liste öffnen
4. Modul **Business** → Kommunikationszentrum
5. Modul-Wechsler (🧩) für weitere Module

---

## Tablet-Test

- iPad / Android Tablet: Side-Rail-Navigation (keine Bottom-Tabs)
- Klient:innen: Split-Ansicht Liste + Detail ab 768px Breite

---

## Desktop / Web

- Web-Build optional für Review: URL bereitstellen wenn verfügbar
- Sidebar-Navigation ab 1200px

---

## Bekannte Einschränkungen (ehrlich kommunizieren)

- TI-Modul (KIM, eGK, ePA): **Demo-Daten**, keine echte gematik-Anbindung
- Push Notifications: **nicht implementiert**
- Sprachnachrichten: UI-Vorbereitung, kein `expo-av`
- Einige Module nur mit Demo-Mandant (`DEMO_TENANT_ID`)

---

## Keine Placebo-Features

Alle sichtbaren Buttons in Review-Builds führen zu echten Screens oder zeigen Permission-Banner bei fehlender Rolle.

---

## Kontakt für Review-Fragen

support@caresuiteplus.de  
Antwort innerhalb 24h (WERKTAGS)
