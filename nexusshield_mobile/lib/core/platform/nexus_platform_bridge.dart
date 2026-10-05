import 'dart:async';

import 'package:flutter/services.dart';

/// Native security capabilities (permissions, Wi‑Fi, call block, remote access).
abstract final class NexusPlatformBridge {
  static const _method = MethodChannel('com.nexusshield.guard/platform');
  static const _events = EventChannel('com.nexusshield.guard/events');

  static Stream<Map<String, dynamic>> securityEvents() {
    return _events.receiveBroadcastStream().map(
          (event) => Map<String, dynamic>.from(event as Map),
        );
  }

  static Future<List<Map<String, dynamic>>> scanInstalledAppPermissions() async {
    final result = await _method.invokeMethod<List<Object?>>(
      'scanInstalledAppPermissions',
    );
    if (result == null) return const [];
    return result
        .map((e) => Map<String, dynamic>.from(e! as Map))
        .toList(growable: false);
  }

  static Future<Map<String, dynamic>> getWifiSecuritySnapshot() async {
    final result = await _method.invokeMethod<Map<Object?, Object?>>(
      'getWifiSecuritySnapshot',
    );
    return Map<String, dynamic>.from(result ?? const {});
  }

  static Future<void> syncCallBlockList(List<String> e164Numbers) async {
    await _method.invokeMethod<void>('syncCallBlockList', {
      'numbers': e164Numbers,
    });
  }

  static Future<Map<String, dynamic>> getRemoteAccessSignals() async {
    final result = await _method.invokeMethod<Map<Object?, Object?>>(
      'getRemoteAccessSignals',
    );
    return Map<String, dynamic>.from(result ?? const {});
  }
}
