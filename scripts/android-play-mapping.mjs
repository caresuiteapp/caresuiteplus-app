#!/usr/bin/env node
/**
 * Prints Play Console steps to link R8 mapping.txt after production-aab build.
 */
console.log(`
CareSuite+ Android — R8 Offenlegungsdatei (mapping.txt)

1. AAB bauen (versionCode 6, R8 aktiv):
   npx eas-cli build -p android --profile production-aab --non-interactive

2. Nach FINISHED: Auf expo.dev → Build → Artifacts:
   - *.aab  → Play Console hochladen
   - mapping.txt (Pfad: android/app/build/outputs/mapping/release/mapping.txt)

3. Play Console → Testen und veröffentlichen → Interner Test → Version 6:
   - App-Paket öffnen
   - „Offenlegungsdatei“ / „ProGuard mapping file“ → mapping.txt hochladen

4. Optional automatisch (Service Account):
   npx eas-cli submit -p android --profile production --latest
   (Mapping weiterhin manuell in Play Console verknüpfen, falls Warnung bleibt.)

Hinweis: mapping.txt entsteht nur bei Release-Builds mit enableMinifyInReleaseBuilds.
`);
