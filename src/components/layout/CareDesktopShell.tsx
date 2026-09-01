// Import the concrete shell module directly. Importing the `platform` barrel
// here evaluates every platform export, including module navigation and its
// modal screen registry. That registry reaches back into the layout barrel and
// creates a runtime cycle before `PlatformShell` has been initialized on web.
export { PlatformShell as CareDesktopShell } from './platform/platformshell';
