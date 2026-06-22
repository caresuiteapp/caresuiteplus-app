# CareSuite+ — R8/ProGuard rules (Expo SDK 52 / React Native 0.76 / Hermes)

# React Native core
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}

-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.soloader.** { *; }

# Expo modules
-keep class expo.modules.** { *; }

# Reanimated / gesture handler / screens
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }
-keep class com.swmansion.rnscreens.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# SVG (Expo vector icons)
-keep public class com.horcrux.svg.** { *; }

# App package
-keep class app.caresuiteplus.** { *; }

# Networking
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**

# Keep line numbers for crash reports (mapping file still required for deobfuscation)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
