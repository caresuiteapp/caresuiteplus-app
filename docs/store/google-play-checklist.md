# Google Play Store — Submission Checklist

**App:** CareSuite+  
**Package:** `de.caresuiteplus.app`  
**Stand:** 2026-06-13

---

## Vor dem Build

- [ ] Google Play Console Developer Account
- [ ] App-Eintrag erstellt (Internal Testing Track zuerst)
- [ ] EAS `projectId` konfiguriert
- [ ] `assets/android-icon-foreground.png` + `background.png` + `monochrome.png`
- [ ] Datenschutzerklärung URL in Console eingetragen
- [ ] Service Account JSON für `eas submit` (Pfad in `eas.json`)

## Store Listing

- [ ] App-Name: CareSuite+
- [ ] Kurzbeschreibung (80 Zeichen)
- [ ] Vollständige Beschreibung (DE) — `store-listing-texts.md`
- [ ] Screenshots — `screenshots-plan.md`
- [ ] Feature Graphic (1024×500)
- [ ] App-Icon (512×512 aus adaptive icon)
- [ ] Kategorie: Business
- [ ] Kontakt-E-Mail: support@caresuiteplus.de

## Data Safety Form

- [ ] Alle Datentypen aus `privacy-data-map.md` eingetragen
- [ ] Verschlüsselung in Transit: Ja (HTTPS)
- [ ] Daten löschbar auf Anfrage: Ja (Prozess dokumentieren)
- [ ] Gesundheitsdaten: Ja — erhöhte Sorgfalt

## Technisch

- [ ] `eas build --profile production --platform android`
- [ ] AAB (App Bundle) — `buildType: app-bundle` in eas.json
- [ ] `versionCode` inkrementiert
- [ ] Nur `INTERNET` Permission (keine unnötigen Permissions)
- [ ] Target API Level aktuell (Expo 52 Default prüfen)

## Testing

- [ ] Internal Testing Track mit 20+ Testern (empfohlen)
- [ ] Tablet (10") Layout geprüft
- [ ] Demo-Login — `reviewer-notes.md`

## Nach Veröffentlichung

- [ ] Staged Rollout (10% → 50% → 100%)
- [ ] Play Integrity API (optional, Phase 2)
