package ai.nexusshield.nexusshield_mobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.wifi.WifiManager
import android.os.Build
import android.provider.Settings
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel

object NexusShieldPlatformPlugin {
    private const val METHOD = "com.nexusshield.guard/platform"
    private const val EVENTS = "com.nexusshield.guard/events"

    private val sensitivePermissions = listOf(
        android.Manifest.permission.CAMERA,
        android.Manifest.permission.RECORD_AUDIO,
        android.Manifest.permission.READ_CONTACTS,
        android.Manifest.permission.ACCESS_FINE_LOCATION,
        android.Manifest.permission.ACCESS_COARSE_LOCATION,
    )

    private var eventSink: EventChannel.EventSink? = null
    private var packageReceiver: BroadcastReceiver? = null

    fun registerWith(flutterEngine: FlutterEngine, context: Context) {
        val messenger = flutterEngine.dartExecutor.binaryMessenger
        MethodChannel(messenger, METHOD).setMethodCallHandler { call, result ->
            when (call.method) {
                "scanInstalledAppPermissions" -> {
                    try {
                        result.success(scanInstalledAppPermissions(context))
                    } catch (e: Exception) {
                        result.error("scan_failed", e.message, null)
                    }
                }
                "getWifiSecuritySnapshot" -> {
                    result.success(getWifiSecuritySnapshot(context))
                }
                "syncCallBlockList" -> {
                    val numbers =
                        call.argument<List<String>>("numbers") ?: emptyList()
                    CallBlockStore.save(context, numbers)
                    result.success(null)
                }
                "getRemoteAccessSignals" -> {
                    result.success(getRemoteAccessSignals(context))
                }
                else -> result.notImplemented()
            }
        }

        EventChannel(messenger, EVENTS).setStreamHandler(object : EventChannel.StreamHandler {
            override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                eventSink = events
                registerPackageReceiver(context)
            }

            override fun onCancel(arguments: Any?) {
                unregisterPackageReceiver(context)
                eventSink = null
            }
        })
    }

    private fun registerPackageReceiver(context: Context) {
        if (packageReceiver != null) return
        packageReceiver = object : BroadcastReceiver() {
            override fun onReceive(ctx: Context?, intent: Intent?) {
                val pkg = intent?.data?.schemeSpecificPart ?: return
                val type = when (intent.action) {
                    Intent.ACTION_PACKAGE_ADDED -> "package_added"
                    Intent.ACTION_PACKAGE_REMOVED -> "package_removed"
                    Intent.ACTION_PACKAGE_CHANGED -> "package_changed"
                    else -> "package_changed"
                }
                eventSink?.success(mapOf("type" to type, "packageId" to pkg))
            }
        }
        val filter = IntentFilter().apply {
            addAction(Intent.ACTION_PACKAGE_ADDED)
            addAction(Intent.ACTION_PACKAGE_REMOVED)
            addAction(Intent.ACTION_PACKAGE_CHANGED)
            addDataScheme("package")
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(packageReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("UnspecifiedRegisterReceiverFlag")
            context.registerReceiver(packageReceiver, filter)
        }
    }

    private fun unregisterPackageReceiver(context: Context) {
        packageReceiver?.let {
            context.unregisterReceiver(it)
            packageReceiver = null
        }
    }

    private fun scanInstalledAppPermissions(context: Context): List<Map<String, Any>> {
        val pm = context.packageManager
        val apps = pm.getInstalledApplications(PackageManager.GET_META_DATA)
        val out = mutableListOf<Map<String, Any>>()
        for (app in apps) {
            if (app.packageName == context.packageName) continue
            val granted = mutableListOf<String>()
            for (perm in sensitivePermissions) {
                val status = pm.checkPermission(perm, app.packageName)
                if (status == PackageManager.PERMISSION_GRANTED) {
                    granted.add(permissionLabel(perm))
                }
            }
            if (granted.isEmpty()) continue
            val risk = when {
                granted.size >= 3 -> "high"
                granted.size >= 2 -> "medium"
                else -> "low"
            }
            out.add(
                mapOf(
                    "packageId" to app.packageName,
                    "displayName" to pm.getApplicationLabel(app).toString(),
                    "permissions" to granted,
                    "risk" to risk,
                ),
            )
        }
        return out.sortedByDescending { (it["permissions"] as List<*>).size }.take(250)
    }

    private fun permissionLabel(perm: String): String = when (perm) {
        android.Manifest.permission.CAMERA -> "camera"
        android.Manifest.permission.RECORD_AUDIO -> "microphone"
        android.Manifest.permission.READ_CONTACTS -> "contacts"
        android.Manifest.permission.ACCESS_FINE_LOCATION,
        android.Manifest.permission.ACCESS_COARSE_LOCATION,
        -> "location"
        else -> "unknown"
    }

    private fun getWifiSecuritySnapshot(context: Context): Map<String, Any> {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = cm.activeNetwork
        val caps = network?.let { cm.getNetworkCapabilities(it) }
        val onWifi = caps?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true

        if (!onWifi) {
            return mapOf(
                "connected" to false,
                "ssid" to "—",
                "encryption" to "UNKNOWN",
                "captivePortalSuspect" to false,
                "dnsHijackSuspect" to false,
                "arpPoisonSuspect" to false,
                "recommendVpnTunnel" to false,
                "detail" to "Wi‑Fi dışı bağlantı veya kapalı radyo",
            )
        }

        val wm = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager
        @Suppress("DEPRECATION")
        val info = wm.connectionInfo
        var ssid = info.ssid?.replace("\"", "") ?: "Wi‑Fi"
        if (ssid == "<unknown ssid>") ssid = "Wi‑Fi"

        var encryption = "WPA2"
        var open = false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val scan = wm.scanResults.firstOrNull { it.SSID == ssid || it.SSID == info.ssid?.replace("\"", "") }
            val capabilities = scan?.capabilities ?: ""
            encryption = when {
                capabilities.contains("WPA3") -> "WPA3"
                capabilities.contains("WPA2") -> "WPA2"
                capabilities.contains("WPA") -> "WPA"
                capabilities.contains("WEP") -> "WEP"
                else -> "OPEN"
            }
            open = encryption == "OPEN"
        }

        val dnsSuspect = ssid.lowercase().contains("free") || ssid.lowercase().contains("public")
        val arpSuspect = open
        val captive = caps?.hasCapability(NetworkCapabilities.NET_CAPABILITY_CAPTIVE_PORTAL) == true

        return mapOf(
            "connected" to true,
            "ssid" to ssid,
            "encryption" to encryption,
            "captivePortalSuspect" to captive,
            "dnsHijackSuspect" to dnsSuspect,
            "arpPoisonSuspect" to arpSuspect,
            "recommendVpnTunnel" to (open || dnsSuspect || captive),
            "detail" to when {
                open -> "Açık (şifresiz) ağ — VPN önerilir"
                dnsSuspect -> "Halka açık SSID deseni — DNS riski"
                captive -> "Captive portal algılandı"
                else -> "$encryption şifreleme"
            },
        )
    }

    private fun getRemoteAccessSignals(context: Context): Map<String, Any> {
        val accessibility = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES,
        ) ?: ""
        val services = accessibility.split(":").filter { it.isNotBlank() }
        val suspicious = services.count { !it.contains(context.packageName) }

        return mapOf(
            "screenCaptureActive" to false,
            "suspiciousAccessibilityCount" to suspicious,
            "overlayAppsCount" to 0,
            "detail" to if (suspicious > 0) {
                "$suspicious erişilebilirlik servisi etkin"
            } else {
                "Belirgin uzaktan erişim sinyali yok"
            },
        )
    }
}

object CallBlockStore {
    private const val PREFS = "nexus_call_block"
    private const val KEY = "numbers"

    fun save(context: Context, numbers: List<String>) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putStringSet(KEY, numbers.toSet())
            .apply()
    }

    fun load(context: Context): Set<String> =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getStringSet(KEY, emptySet()) ?: emptySet()

    fun isBlocked(context: Context, number: String?): Boolean {
        if (number.isNullOrBlank()) return false
        val normalized = number.filter { it.isDigit() || it == '+' }
        return load(context).any { blocked ->
            val b = blocked.filter { it.isDigit() || it == '+' }
            normalized.endsWith(b.takeLast(10)) || b.endsWith(normalized.takeLast(10))
        }
    }
}
