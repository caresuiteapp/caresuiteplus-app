# Android release 0.7.1: Play performance recommendations

The reported Play findings refer to version 0.7.0 / code 48. The first 0.7.1
build (code 49) used the same native dependency graph and the same R8 mapping.
Its icon correction alone did not resolve these recommendations.

## Build optimizer

The Expo 57 / React Native 0.86.3 defaults resolve Android Gradle Plugin 8.12.0,
even though the Gradle wrapper is 9.3.1. These are different version numbers.
`withAndroidReleaseOptimization.cjs` now pins AGP 9.0.1 and Kotlin 2.2.10 in the
generated root buildscript. Gradle 9.3.1, Java 17, SDK 36, the existing NDK,
minification, full mode and optimized resource shrinking are retained.

Expo 57's plugins still use the Kotlin Android plugin and the old Android DSL.
Google's supported `android.builtInKotlin=false` and `android.newDsl=false`
migration switches preserve these interfaces. They do not disable R8. Resource
value generation retains its previous default. No consumer-rule/global R8
optimization opt-out is added.

Expo Core 57.0.16's Gradle helper also writes the library-only
`LibraryDefaultConfig.targetSdk` property removed in AGP 9. A version- and
SHA-256-guarded prebuild migration moves that value to `lint.targetSdk`, the
supported library API. Library compile/min SDK values and the application
target remain intact. Changed or unknown upstream source is rejected.
React Native 0.86.3's Gradle plugin also registers its root-wide BuildConfig
and namespace sweeps again whenever another React Native library is applied.
AGP 9 rejects callbacks registered after a library's DSL has been finalized.
The same guarded migration makes each root-wide sweep run once while retaining
all library callbacks; the runtime React Native version is unchanged.
Expo Autolinking 57.0.12 passes two build-directory providers to the old
SourceSet API, which AGP 9 rejects. Those directory providers are resolved to
files; the existing `preBuild.dependsOn(generatePackagesList)` dependency is
retained, as is the inline-module mirror. The AGP provider check remains on.
The existing workflow now configures a fresh generated Android project with
`:app:help` before the full release checks, verifying the actual AGP version,
minSdk 24 and targetSdk 36. It uses the existing packages and Gradle toolchain,
cleans its staged source and leaves all final release checks in place.

The release gate reads `androidGradlePluginVersion` from the actual signed AAB
metadata and `compiler_version` from its signed R8 mapping. It rejects the old
AGP 8 package, R8 before 9, mismatched mapping archives and merged rules that
disable shrinking, optimization or obfuscation. The values are recorded in
`BUILD-INFO.json`; changing the wrapper or source strings alone cannot pass.

## Startup regression in code 51

A device report showed the native splash followed by Android's repeated-crash
dialog. The signed code-51 bundle resolves WorkManager 2.9.1 and Room 2.5.0;
Expo Background Task 57.0.16 introduces WorkManager, whose manifest registers
`WorkManagerInitializer` with AndroidX Startup before React Native renders.
The actual merged R8 configuration contains only the upstream class-level
keeps for `RoomDatabase` and `InputMerger`. AGP 9 no longer implicitly retains
their zero-argument constructors. This is the dependency failure corrected in
Expo's merged [PR 51349](https://github.com/expo/expo/pull/51349), also reported
through [Expo Background Task](https://github.com/expo/expo/issues/52173).
Independent inspection of the delivered code-51 AAB (SHA-256
`4d4b3005404122278a3eec707a0229076324c9588a92cdeda81d62c2f137be97`)
finds all three classes in `classes.dex` with no declared zero-argument
constructors. Its compiled manifest includes both the initialization provider
and WorkManager initializer. The new gate rejects that unchanged package.

The application now explicitly retains the zero-argument constructors of
`RoomDatabase` and `InputMerger` subclasses, without preserving other members,
upgrading runtime dependencies or disabling R8 strict full mode. The signed
package gate inspects actual DEX class definitions for public zero-argument
constructors on `WorkDatabase_Impl`, `OverwritingInputMerger` and
`ArrayCreatingInputMerger`. Method references, other overloads and source
rules alone do not establish that reflection can instantiate these classes.

This package check establishes the known startup dependency requirement.
Code 52 retains those constructors, but the subsequent device report exposes
the independent JavaScript initialization error described below. Actual cold
starts on the affected device and background task execution remain separate
acceptance steps. No app data is cleared as part of these corrections.

## JavaScript startup error in code 52

The device report confirms version 0.7.1 / code 52 and repeatedly records
`TypeError: Object.defineProperty() called on non-object` before the first app
screen. The Hermes stack begins at `getValue@1:11015115`, called from
`anonymous@1:368976`. Inspection of the exact signed code-52 bytecode binds
these virtual offsets to Expo's lazy global installer and the
`@ungap/structured-clone` CommonJS initializer respectively. The latter reads
global `structuredClone` before assigning its default export.

`nativeWorkflowEnvironment.native.ts` imported that implementation eagerly.
The import re-entered Expo 57.0.20's lazy `structuredClone` installer, which
received the partially initialized module's undefined default export and
attempted to mark it with `Object.defineProperty`. The application now uses
Expo's installed global function at clone-call time and no longer imports the
implementation directly. The clone algorithm and its supported value types
are unchanged; no JSON serialization fallback is introduced.

The existing native environment test runs the actual installed Expo installer
and locked clone package in a cold VM with CommonJS partial exports. It first
reproduces the reported exception with the old import order, then imports the
actual corrected native environment and checks cycles, Date, Map and typed
array copy isolation. Native modules are inert in this test, so it establishes
the JavaScript initialization contract, not a successful physical-device
launch. The full release and device acceptance remain separate.

The existing EAS diagnostic archive also retains the composed release Hermes
source map and the bytecode file from the same Gradle task alongside the R8
mapping. Future JavaScript crash offsets can therefore be resolved against
the exact packaged bytecode instead of rebuilding maps after the fact.

## Native page rendering and entry-flow failures in code 53

The next device report confirms version 0.7.1 / code 53. After the recorded
update it contains five fatal page-render failures with the same stack:
`Error while updating property 'borderRadius' of a view managed by: RCTText`,
caused by `java.lang.String cannot be cast to java.lang.Double`. Earlier
structured-clone failures in that report precede the code-53 update and are
not counted as current failures.

The shared CSS adapter retains percentage corner radii for native Views, but
also passed them unchanged to Text. React Native 0.86.3's Android Text and
TextInput radius setters accept numeric Float values. Actual workspace CSS
contains `border-radius:50%` on inline status decorations. The native text
boundary now resolves percentage text radii against the element's own size,
and numeric-only metrics are normalized before reaching native primitives.
Percentage layout dimensions and View corner radii remain available.

The supplied images also expose gaps outside the generated page inventory:

- A React Native Modal used for authentication feedback opens a separate
  Android window above the intro's View. Feedback visibility and dismissal
  timers now wait for the existing intro-ready state; authentication itself
  continues independently.
- The native root explicitly re-enabled legacy welcome gates before checking
  the modern-route cutover rule. It now follows the same route rule as Web,
  which excludes the current desktop, Office, portal and access routes.
- The hand-written native Apps & Widgets list bypassed the current Web center.
  The native desktop now uses the generated original center, including artwork,
  filtering, per-desktop selection and ordering, recovery, save errors/retry and
  backgrounds. Native persistence remains scoped by tenant, person and area.
- Native company modals ignored the company surface and explicit header tone.
  Their body, header and footer now follow the same surface rule as Web.
- The access hub, Help, Google Workspace, operator console and weather dialog
  still contained separate older native views outside the page inventory.
  Their active presentations now follow the current Web sources. Native
  location permissions, OAuth return, file delivery and lifecycle cancellation
  remain native adapters. Neo uses the same pure conversation engine, with a
  desktop-only speech interface instead of the old text-command dialog.
- The operator route barrel now selects the current shared workspace for all
  active operator sections, not only the tenant detail page. Its native
  capability model follows the current Web restrictions. Error, status and tab
  semantics are retained at the actual native element boundary.
- The Assist filters, Academy readiness focus, Help contents navigation and
  document-list return used unsupported browser popover, validity or selector
  APIs. They now use real native selection, field and node-registry contracts.
  The generator fails on unsupported runtime browser globals instead of
  silently keeping an older native presentation.

The generator now checks 1,110 modules and 269 emitted native route entries.
Four explicitly bounded platform fallbacks remain: native signature capture,
medication source-file delivery, and the two native 3D body-model components.
The native body models are parametrically rendered; matching the Web GLB
appearance has not been established. Module and entry counts are source
coverage, not proof that every possible device, data state or backend
transaction has been accepted.

The separately reviewed database contracts and their application status are
recorded in `android-workflow-backend-review-20261026.md`. App interaction tests
and server schema metadata do not substitute for each other.

Source correspondence, interaction tests, browser-rendered native layout
fixtures and actual Android acceptance are separate evidence. A successful
router push does not establish that the destination renders, and a browser
fixture does not exercise Android's native property setters. No comprehensive
physical-device acceptance is inferred from these checks.

## Images

CareSuite's native image adapter already uses `expo-image` / Glide, view-sized
downscaling, early resizing, source-sensitive recycling and a memory cache.
Private photos and signatures do not acquire a new persistent disk cache.
The existing native image tests and release performance audit remain active.

The exact code-48 mapping identifies the reported decoder methods as Fresco
(`F6.a`, `J6.e`), Glide (`d5.p`), animated PNG/WebP decoders (`F8.h`, `F8.l`),
the image cropper (`s5.f`) and Expo Video artwork handling (inlined into `T.k0`).
R8 merges classes and inlines methods: a short class name alone is not enough
to assign a call to the original source. These library decoder entry points
can remain visible to Play's static analysis even when application images use
managed loading. This release does not claim to eliminate those library calls
or to prove device heap usage without device profiling.

## System bars and display cutouts

Application navigation uses safe-area insets and status-bar icon styles. The
reported `C7.e` is React Native's `StatusBarModule.setColor` runnable; its
exported constants and `WindowUtilKt` are also React Native code. `xb.l.j`
contains an inlined Material bottom-sheet `onCreate`; the synthetic `f5.a`
methods are shared API outlines. Expo's crop activity uses AndroidX window
compatibility helpers. These dependencies retain system-bar/cutout compatibility
code for older Android versions. AGP 9 does not itself migrate these APIs.

The warning is not treated as fixed solely because safe areas are present or
because a build succeeds. No checks are suppressed, no Android device support
is removed, and no untested edits are made to precompiled React Native AARs.
Play may still report these library APIs. Actual Android 15/16 device acceptance
remains separate from source, exported-layout and signed-package checks.

## References

- [AGP 9.0.1 compatibility and migration switches](https://developer.android.com/build/releases/agp-9-0-0-release-notes)
- [Built-in Kotlin migration](https://developer.android.com/build/migrate-to-built-in-kotlin)
- [Android 15 edge-to-edge behavior](https://developer.android.com/about/versions/15/behavior-changes-15#edge-to-edge)
- [Expo 57 image loading and downscaling](https://docs.expo.dev/versions/v57.0.0/sdk/image/)
- [Locked React Native status-bar implementation](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/statusbar/StatusBarModule.kt)
- [Locked React Native window implementation](https://github.com/react/react-native/blob/v0.86.3/packages/react-native/ReactAndroid/src/main/java/com/facebook/react/views/view/WindowUtil.kt)
