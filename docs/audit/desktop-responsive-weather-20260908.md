# Web desktop: responsive workspace and weather

## Changes
- Measure the actual grid viewport width and height independently of the left navigation.
- Use four columns in normal large desktop workspaces and six in ultrawide workspaces; reflow at larger text sizes.
- Fit illustration height to the remaining viewport, preserve readable titles above images, and allow scrolling below the minimum card size.
- Reduce oversized chrome, keep the two information/action bars at the same height, and show navigation scrolling.
- Keep clock and weather visible when the header wraps in narrower windows.
- Load DWD observations through Bright Sky after location permission. Use approximate coordinates, bounded requests, fresh observations, retry states, and source attribution. Do not store coordinates or restore the former sample temperature.
- Android and visit execution are unchanged.

## Verification
- Six targeted suites: 51 tests passed (grid geometry, preferences/navigation, weather, shared desktop shell and architecture).
- Web production export passed with demo mode disabled.
- TypeScript check passed; the ten weather tests passed again after correcting a test-only callback type.
- Grid checks cover 320–3840 CSS pixels and 100–200% text size. At workspace widths 1218 and 1602 CSS pixels, twelve slots use four columns and fit the tested available heights without reducing title size.
- Weather checks cover permission denial, retry, network errors, geolocation timeout, invalid/stale data, zero degrees and late responses after account changes.

## Remaining verification gap
No rendered visual sign-off in an authenticated real browser was available in this session. The layout arithmetic and simulated DOM tests do not prove visual correctness. Live weather retrieval with an actual permitted browser location remains unverified; the API documentation confirms the public endpoint and CORS support.

Provider documentation: https://brightsky.dev/docs/ and https://brightsky.dev/.
