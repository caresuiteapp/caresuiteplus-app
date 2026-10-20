# Apple App Store — Submission Checklist

**App:** CareSuite+  
**Bundle ID:** `de.caresuiteplus.app`  
**Stand:** 2026-06-13

---

## Vor dem Build

- [ ] Apple Developer Program aktiv (Team ID)
- [ ] App Store Connect App-Eintrag angelegt
- [ ] EAS `projectId` durch echte UUID ersetzt (`eas init`)
- [ ] `assets/icon.png` (1024×1024) vorhanden
- [ ] `assets/splash-icon.png` vorhanden
- [ ] Privacy Policy URL live: `https://caresuiteplus.de/datenschutz`
- [ ] Support URL live: `https://caresuiteplus.de/hilfe`

## App Store Connect Metadaten

- [ ] App-Name: CareSuite+
- [ ] Untertitel (30 Zeichen)
- [ ] Kategorie: Business / Medical (prüfen mit Legal)
- [ ] Altersfreigabe: 4+ (anpassen nach Inhalt)
- [ ] Copyright: © 2026 [Firma]
- [ ] Beschreibung (DE) — siehe `store-listing-texts.md`
- [ ] Keywords
- [ ] Screenshots — siehe `screenshots-plan.md`
- [ ] App Privacy Questionnaire ausgefüllt — siehe `privacy-data-map.md`

## Technisch (Expo / EAS)

- [ ] `eas build --profile production --platform ios`
- [ ] `eas submit --platform ios`
- [ ] `ios.buildNumber` / `autoIncrement` in eas.json
- [ ] Push Notifications: nur wenn implementiert (aktuell **nicht**)
- [ ] Sign in with Apple: nur wenn Social Login (aktuell **nicht**)
- [ ] `ITSAppUsesNonExemptEncryption`: false (oder Export Compliance dokumentieren)

## Review

- [ ] Demo-Account für Reviewer — siehe `reviewer-notes.md`
- [ ] Keine Placeholder-Buttons in Review-Build
- [ ] Tablet-Layouts getestet auf iPad Simulator
- [ ] Dark Mode konsistent (`userInterfaceStyle: dark`)

## Nach Approval

- [ ] Phased Release aktivieren
- [ ] Crashlytics / Analytics (optional)
- [ ] Release Notes für Updates
