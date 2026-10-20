# Desktop weather location and header sizing — 2026-09-09

The weather bar previously presented the observation station name as the user's city. Web desktop now offers a city/postcode picker and stores the selected postal area per account in this browser. A manual choice takes precedence over browser geolocation; automatic mode is available explicitly. Automatic mode is labelled as the current location instead of naming a possibly different weather station.

City lookup uses a bundled German postal-place directory, downloaded only when the picker opens. Queries are filtered locally. Selection, storage failure, directory loading/retry, weather timeouts and switching accounts have explicit handling. Weather continues to use current observations with the existing freshness checks; station names and attribution are explained in the picker's expandable weather information instead of a provider link in the bar.

The logo and left information bar share the same responsive width. The logo preserves its 8:1 aspect ratio; clock text increases from 27 to 34 and date text from 13 to 15. Both status bars remain above the logo.

Place directory: GeoNames German postal data, downloaded 2026-09-09 from https://download.geonames.org/export/zip/DE.zip. CC BY 4.0, https://creativecommons.org/licenses/by/4.0/. Place names, postal codes, state, district and rounded coordinates are retained; invalid and duplicate rows removed. Full attribution accompanies the directory and is available in the picker.

Only the web weather hook, desktop UI and web assets change. Required Expo Web export precedes push/deploy. Automated tests, lint, typecheck and browser checks are omitted at the user's request; manual validation follows deployment.
