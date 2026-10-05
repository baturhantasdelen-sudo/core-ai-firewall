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

fun projectProp(name: String): String? =
    (findProperty(name) as String?)?.trim()?.takeIf { it.isNotEmpty() }

val releaseStorePassword =
    projectProp("android.injected.signing.store.password")
        ?: signingValue("ANDROID_KEYSTORE_PASSWORD", propertyName = "storePassword")
val releaseKeyAlias =
    projectProp("android.injected.signing.key.alias")
        ?: signingValue("ANDROID_KEYSTORE_ALIAS", "ANDROID_KEY_ALIAS", propertyName = "keyAlias")
val releaseKeyPassword =
    projectProp("android.injected.signing.key.password")
        ?: signingValue("ANDROID_KEY_PASSWORD", propertyName = "keyPassword")

val injectedStoreFilePath = projectProp("android.injected.signing.store.file")
val keystorePath =
    injectedStoreFilePath
        ?: signingValue("ANDROID_KEYSTORE_PATH", propertyName = "storeFile")

val appModuleKeystore = file("upload-keystore.jks")

fun resolveReleaseKeystoreFile(): java.io.File? {
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
        !releaseStorePassword.isNullOrBlank() &&
        !releaseKeyAlias.isNullOrBlank() &&
        !releaseKeyPassword.isNullOrBlank()

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

    if (!hasReleaseSigning) {
        logger.warn(
            "Release signing not configured (debug builds are unaffected). " +
                "For release: android/key.properties, -Pandroid.injected.signing.*, or " +
                "ANDROID_KEYSTORE_PATH, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEYSTORE_ALIAS, ANDROID_KEY_PASSWORD.",
        )
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = releaseKeystoreFile
                storePassword = releaseStorePassword
                keyAlias = releaseKeyAlias
                keyPassword = releaseKeyPassword
            }
        }
    }

    buildTypes {
        release {
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            isMinifyEnabled = false
            isShrinkResources = false
        }
        debug {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

// Fail only when a release packaging task runs without keystore (debug CI must not require secrets).
gradle.taskGraph.whenReady {
    if (hasReleaseSigning) return@whenReady
    val needsReleaseSigning = allTasks.any { task ->
        val n = task.name
        (n.contains("Release", ignoreCase = true)) &&
            (
                n.startsWith("assemble") ||
                    n.startsWith("bundle") ||
                    n.startsWith("package") ||
                    n == "signReleaseBundle"
                )
    }
    if (!needsReleaseSigning) return@whenReady
    throw GradleException(
        "Release signing is required for ${allTasks.filter { it.name.contains("Release") }.joinToString { it.name }}. " +
            "Configure android/key.properties or ANDROID_KEYSTORE_* env vars (debug builds do not need this).",
    )
}

fun assertReleaseNotDebugSigned(taskLabel: String) {
    val releaseBuildType = android.buildTypes.getByName("release")
    val config = releaseBuildType.signingConfig
        ?: throw GradleException("$taskLabel: release signingConfig is null.")

    if (config.name == "debug") {
        throw GradleException("$taskLabel: release variant is configured to use debug signing.")
    }

    val store = config.storeFile
        ?: throw GradleException("$taskLabel: release keystore file is null.")

    if (!store.exists()) {
        throw GradleException("$taskLabel: release keystore not found at ${store.absolutePath}")
    }

    logger.lifecycle(
        "$taskLabel: signing with config='${config.name}', store='${store.absolutePath}', alias='${config.keyAlias}'"
    )
}

tasks.configureEach {
    if (name == "bundleRelease" || name == "signReleaseBundle" || name == "packageReleaseBundle") {
        doFirst { assertReleaseNotDebugSigned(name) }
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
