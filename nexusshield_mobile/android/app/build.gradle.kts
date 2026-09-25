import java.io.FileInputStream
import java.util.Properties

plugins {
    id("com.android.application")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

fun signingValue(envName: String, propertyName: String): String? {
    System.getenv(envName)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    return keystoreProperties.getProperty(propertyName)?.trim()?.takeIf { it.isNotEmpty() }
}

android {
    namespace = "ai.nexusshield.nexusshield_mobile"
    compileSdk = flutter.compileSdkVersion.coerceAtLeast(35)
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    defaultConfig {
        applicationId = "com.nexusshield.guard"
        minSdk = flutter.minSdkVersion.coerceAtLeast(21)
        targetSdk = flutter.targetSdkVersion.coerceAtLeast(35)
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    val keystorePath = signingValue("ANDROID_KEYSTORE_PATH", "storeFile")
    val storePassword = signingValue("ANDROID_KEYSTORE_PASSWORD", "storePassword")
    val keyAlias = signingValue("ANDROID_KEY_ALIAS", "keyAlias")
    val keyPassword = signingValue("ANDROID_KEY_PASSWORD", "keyPassword")
    val hasReleaseSigning =
        !keystorePath.isNullOrBlank() &&
            !storePassword.isNullOrBlank() &&
            !keyAlias.isNullOrBlank() &&
            !keyPassword.isNullOrBlank()

    if (hasReleaseSigning) {
        signingConfigs {
            create("release") {
                val declared = file(keystorePath!!)
                storeFile =
                    when {
                        declared.isAbsolute && declared.exists() -> declared
                        declared.exists() -> declared
                        rootProject.file(keystorePath).exists() -> rootProject.file(keystorePath)
                        else -> declared
                    }
                this.storePassword = storePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }

    buildTypes {
        release {
            signingConfig =
                if (hasReleaseSigning) {
                    signingConfigs.getByName("release")
                } else {
                    signingConfigs.getByName("debug")
                }
            isMinifyEnabled = false
            isShrinkResources = false
        }
    }
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
