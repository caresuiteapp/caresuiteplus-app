# CareSuite HealthOS — Expo SDK 57 / React Native 0.86 / Hermes
# React Native, Expo, Reanimated, SVG and Glide ship their own consumer rules.
# Those rules preserve their JNI entrypoints, reflection and autolinking.
# Do not blanket-keep library or application packages: this prevents shrinking
# and optimization of all reachable classes in those packages.

# Source positions for crash reports; retain the R8 mapping with each release.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
