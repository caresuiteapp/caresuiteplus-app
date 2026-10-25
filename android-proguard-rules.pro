# CareSuite HealthOS — Expo SDK 57 / React Native 0.86 / Hermes
# React Native, Expo, Reanimated, SVG and Glide ship their own consumer rules.
# Those rules preserve their JNI entrypoints, reflection and autolinking.
# Do not blanket-keep library or application packages: this prevents shrinking
# and optimization of all reachable classes in those packages.

# Source positions for crash reports; retain the R8 mapping with each release.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Expo Background Task 57 resolves WorkManager 2.9.1 / Room 2.5.0. Their
# class-only consumer keeps lose implicit constructors under AGP 9. AndroidX
# Startup reflects WorkDatabase_Impl before React Native can render; input
# mergers are reflected when work runs. Retain only these required members.
# https://github.com/expo/expo/pull/51349
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class * extends androidx.work.InputMerger { <init>(); }

# PDFBox 2.0.27.0 guards its optional JPX decoder with Class.forName.
# CareSuite uses PDFBox for embedded attachments, and Android PdfRenderer for
# page images. Only this absent optional codec is allowed; keep other missing
# dependencies as release errors and retain all R8 optimizations.
# https://github.com/TomRoush/PdfBox-Android/tree/v2.0.27.0#reading-jpx-images
-dontwarn com.gemalto.jp2.JP2Decoder
