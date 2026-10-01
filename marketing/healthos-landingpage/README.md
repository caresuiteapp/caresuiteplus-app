# CareSuite HealthOS landing page

Standalone public marketing page deployed at `/landingpage` by the existing Expo/Vercel deployment. The editable React source is here; the generated and prerendered output is committed in `public/landingpage`. This keeps the production Expo build independent of the marketing toolchain.

## Rebuild

Use Node 22.12+ and run `npm install` then `npm run build` in this directory. Commit source and regenerated `public/landingpage/assets` plus `public/landingpage/index.html` together. Original approved demo captures, branding and Neo live in `public/landingpage/media` and are preserved by the build.

The Vercel config handles both `/landingpage` and `/landingpage/`. All landing assets use `/landingpage/` paths. The web access hub footer uses a normal HTML link so the route opens independently of Expo authentication and startup flows.

Content is prerendered for direct access and search engines, then hydrated for product filters, galleries, chapters, motion controls and Neo. Speech uses available known male German voices; it does not fall back to a female voice. Reduced motion and pause controls are preserved.
