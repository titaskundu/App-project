# MediaPipe calls into these classes from native code and uses protobuf reflection.
-keep class com.google.mediapipe.** { *; }
-keep class com.google.protobuf.** { *; }
# MediaPipe logs through Flogger, which finds its caller by class name on the stack. If R8
# renames Flogger's classes, MediaPipe's Graph fails to load ("no caller found on the stack").
-keep class com.google.common.flogger.** { *; }
-dontwarn com.google.common.flogger.**
-dontwarn com.google.mediapipe.**
-dontwarn com.google.protobuf.**
-dontwarn com.google.ai.edge.litertlm.**
-dontwarn javax.annotation.**
