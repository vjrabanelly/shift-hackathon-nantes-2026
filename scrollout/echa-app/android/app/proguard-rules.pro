# Capacitor — keep WebView JS interfaces
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes JavascriptInterface

# Capacitor plugin classes
-keep class com.getcapacitor.** { *; }
-keep class com.lab.echa.app.** { *; }

# ML Kit
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**

# NanoHTTPD
-keep class fi.iki.elonen.** { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# AndroidX
-keep class androidx.** { *; }
-dontwarn androidx.**

# Keep source file names for crash reports
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
