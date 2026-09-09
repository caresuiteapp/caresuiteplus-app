# Desktop workspace height correction — 2026-09-09

The previous desktop grid change could collapse the workspace to its header height. React Native Web's default content alignment combined with size containment left the implicit grid row without a full-height content allocation. Navigation entries and widget cards consequently disappeared from view.

The workspace now explicitly stretches one grid row across the available height. Its navigation column fills that row. The desktop panel uses separate rows for the heading and the remaining widget viewport, so the contained widget grid receives a definite available height.

Scope: the web desktop screen only. Weather, widget selection, desktop navigation transitions and native applications retain their existing implementation.

Release procedure: required Expo Web export, followed by git push and production deployment. Automated tests, lint, typecheck and browser review are omitted at the user's request; the user performs the manual checks after deployment.
