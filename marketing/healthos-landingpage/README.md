# CareSuite HealthOS landing page

Standalone public marketing page prepared for `/landingpage` through the existing Expo/Vercel deployment. The editable React source is here; the generated and prerendered output is committed in `public/landingpage`. This keeps the production Expo build independent of the marketing toolchain. See `../../TV_WEB_RELEASE.md` for the actual release status and deployment prerequisites.

## Rebuild

Use Node 22.12+ and run `npm install` then `npm run build` in this directory. Commit source and regenerated `public/landingpage/assets` plus `public/landingpage/index.html` together. Original approved demo captures, branding and Neo live in `public/landingpage/media` and are preserved by the build.

The Vercel config handles both `/landingpage` and `/landingpage/`. All landing assets use `/landingpage/` paths. The web access hub footer uses a normal HTML link so the route opens independently of Expo authentication and startup flows.

Content is prerendered for direct access and search engines, then hydrated for product filters, galleries, chapters, motion controls and Neo. Neo plays the approved original MP3 directly from a user click/tap; it does not depend on installed system voices. A native audio player and readable transcript are available as fallbacks. Reduced motion and pause controls are preserved.

CareSuite Assist links to the verified Google Play package `app.caresuitehealthos`. The German badge, app icon and employee/client screenshots are unmodified originals; provenance is recorded in `store-assets.sources.json`.
