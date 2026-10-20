# Store Screenshots Plan

**App:** CareSuite+  
**Stand:** 2026-06-13

---

## Geräte-Matrix

| Plattform | Formfaktoren | Mindest-Screenshots |
|-----------|--------------|---------------------|
| App Store | iPhone 6.7" | 3–10 |
| App Store | iPad 12.9" | 3–10 (Tablet-Layout!) |
| Google Play | Phone | 2–8 |
| Google Play | 7" + 10" Tablet | Je 2–8 |

---

## Empfohlene Screens (inhaltlich echt, keine Mockups)

1. **Business Dashboard** — Modulübersicht, KPIs
2. **Office Klient:innen** — Liste mit Filtern (Phone)
3. **Office Klient:innen Split** — Master-Detail auf iPad/Desktop
4. **Kommunikationszentrum** — Thread-Liste + Konversation
5. **Mitarbeiter-Portal** — Einsätze-Übersicht
6. **Klient:innen-Portal** — Termine
7. **Pflege-Modul** — Pflegeplan-Übersicht (wenn freigeschaltet)
8. **Dark Theme Hero** — Branding CareSuite+

---

## Aufnahme-Workflow

```bash
# iOS Simulator
npm run ios
# Screenshots: Cmd+S in Simulator

# Android Emulator
npm run android

# Web Desktop (1440px)
npm run web
# Browser DevTools → Capture screenshot
```

---

## Lokalisierung

- Primär: **Deutsch (DE)**
- Optional später: EN für AT/CH

---

## Branding

- Hintergrund: `#080D1A` (bgBase)
- Akzent: Orange `#FF9500` für CTAs
- Keine persönlichen echten Patientendaten in Screenshots — nur Demo-Mandant

---

## Offen

- [ ] Physische Screenshots noch nicht erstellt
- [ ] Feature Graphic für Play Store fehlt
- [ ] App Preview Video (optional)
