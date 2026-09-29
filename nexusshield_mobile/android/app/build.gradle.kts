import java.io.FileInputStream
import java.util.Base64
import java.util.Properties

plugins {
    id("com.android.application")
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val keystorePropertiesFile = rootProject.file("key.properties")
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

fun signingValue(vararg envNames: String, propertyName: String): String? {
    for (envName in envNames) {
        System.getenv(envName)?.trim()?.takeIf { it.isNotEmpty() }?.let { return it }
    }
    return keystoreProperties.getProperty(propertyName)?.trim()?.takeIf { it.isNotEmpty() }
}

val isCi =
    System.getenv("CI") == "true" ||
        System.getenv("GITHUB_ACTIONS") == "true"

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

    val storePassword = signingValue("ANDROID_KEYSTORE_PASSWORD", propertyName = "storePassword")
    val keyAlias =
        signingValue("ANDROID_KEY_ALIAS", "ANDROID_KEYSTORE_ALIAS", propertyName = "keyAlias")
    val keyPassword = signingValue("ANDROID_KEY_PASSWORD", propertyName = "keyPassword")
    val keystorePath = signingValue("ANDROID_KEYSTORE_PATH", propertyName = "storeFile")
    val appModuleKeystore = file("upload-keystore.jks")

    fun resolveReleaseKeystoreFile(): java.io.File? {
        // Prefer explicit file path / key.properties (CI writes android/key.properties).
        if (!keystorePath.isNullOrBlank()) {
            val declared = file(keystorePath)
            val resolved =
                when {
                    declared.isAbsolute && declared.exists() -> declared
                    declared.exists() -> declared
                    rootProject.file(keystorePath).exists() -> rootProject.file(keystorePath)
                    else -> null
                }
            if (resolved != null) {
                return resolved
            }
        }

        if (appModuleKeystore.exists()) {
            return appModuleKeystore
        }

        // Optional fallback: decode BASE64 only when no keystore file exists yet.
        System.getenv("ANDROID_KEYSTORE_BASE64")?.trim()?.takeIf { it.isNotEmpty() }?.let { encoded ->
            val normalized = encoded.replace("\\s".toRegex(), "")
            appModuleKeystore.parentFile?.mkdirs()
            appModuleKeystore.writeBytes(Base64.getDecoder().decode(normalized))
            return appModuleKeystore
        }

        return null
    }

    val releaseKeystoreFile = resolveReleaseKeystoreFile()
    val hasReleaseSigning =
        releaseKeystoreFile != null &&
            releaseKeystoreFile.exists() &&
            !storePassword.isNullOrBlank() &&
            !keyAlias.isNullOrBlank() &&
            !keyPassword.isNullOrBlank()

    if (!hasReleaseSigning) {
        val message =
            "Release signing is required. Configure android/key.properties or env vars: " +
                "ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS " +
                "(or ANDROID_KEYSTORE_ALIAS), ANDROID_KEY_PASSWORD."
        if (isCi) {
            throw GradleException(message)
        } else {
            logger.warn(message)
        }
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseKeystoreFile
                this.storePassword = storePassword
                this.keyAlias = keyAlias
                this.keyPassword = keyPassword
            }
        }
    }

    buildTypes {
        release {
            if (!hasReleaseSigning) {
                throw GradleException("Release build refused: upload keystore is not configured.")
            }
            signingConfig = signingConfigs.getByName("release")
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
