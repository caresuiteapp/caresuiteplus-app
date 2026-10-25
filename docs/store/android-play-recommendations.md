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

The release gate reads `androidGradlePluginVersion` from the actual signed AAB
metadata and `compiler_version` from its signed R8 mapping. It rejects the old
AGP 8 package, R8 before 9, mismatched mapping archives and merged rules that
disable shrinking, optimization or obfuscation. The values are recorded in
`BUILD-INFO.json`; changing the wrapper or source strings alone cannot pass.

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
