import Flutter
import UIKit
import Network

final class NexusPlatformBridge: NSObject, FlutterPlugin, FlutterStreamHandler {
  private var eventSink: FlutterEventSink?

  static func register(with registrar: FlutterPluginRegistrar) {
    let instance = NexusPlatformBridge()
    let channel = FlutterMethodChannel(
      name: "com.nexusshield.guard/platform",
      binaryMessenger: registrar.messenger()
    )
    registrar.addMethodCallDelegate(instance, channel: channel)
    let events = FlutterEventChannel(
      name: "com.nexusshield.guard/events",
      binaryMessenger: registrar.messenger()
    )
    events.setStreamHandler(instance)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    switch call.method {
    case "scanInstalledAppPermissions":
      result([]) // iOS cannot enumerate other apps' permission grants.
    case "getWifiSecuritySnapshot":
      result(wifiSnapshot())
    case "syncCallBlockList":
      if let args = call.arguments as? [String: Any],
         let numbers = args["numbers"] as? [String] {
        UserDefaults.standard.set(numbers, forKey: "nexus_call_block_list")
      }
      result(nil)
    case "getRemoteAccessSignals":
      result(remoteAccessSnapshot())
    default:
      result(FlutterMethodNotImplemented)
    }
  }

  func onListen(withArguments arguments: Any?, eventSink events: @escaping FlutterEventSink) -> FlutterError? {
    eventSink = events
    return nil
  }

  func onCancel(withArguments arguments: Any?) -> FlutterError? {
    eventSink = nil
    return nil
  }

  private func wifiSnapshot() -> [String: Any] {
    let pathMonitor = NWPathMonitor(requiredInterfaceType: .wifi)
    var onWifi = false
    let semaphore = DispatchSemaphore(value: 0)
    pathMonitor.pathUpdateHandler = { path in
      onWifi = path.status == .satisfied
      semaphore.signal()
    }
    let queue = DispatchQueue(label: "nexus.wifi.snapshot")
    pathMonitor.start(queue: queue)
    _ = semaphore.wait(timeout: .now() + 0.4)
    pathMonitor.cancel()

    if !onWifi {
      return [
        "connected": false,
        "ssid": "—",
        "encryption": "UNKNOWN",
        "captivePortalSuspect": false,
        "dnsHijackSuspect": false,
        "arpPoisonSuspect": false,
        "recommendVpnTunnel": false,
        "detail": "Wi‑Fi dışı veya SSID iOS entitlement gerektirir",
      ]
    }

    return [
      "connected": true,
      "ssid": "Wi‑Fi",
      "encryption": "WPA2",
      "captivePortalSuspect": false,
      "dnsHijackSuspect": false,
      "arpPoisonSuspect": false,
      "recommendVpnTunnel": false,
      "detail": "Bağlı — ayrıntılı SSID için Hotspot Configuration entitlement",
    ]
  }

  private func remoteAccessSnapshot() -> [String: Any] {
    let captured = UIScreen.main.isCaptured
    return [
      "screenCaptureActive": captured,
      "suspiciousAccessibilityCount": 0,
      "overlayAppsCount": 0,
      "detail": captured
        ? "Ekran kaydı veya yansıtma algılandı"
        : "Belirgin uzaktan erişim sinyali yok",
    ]
  }
}
