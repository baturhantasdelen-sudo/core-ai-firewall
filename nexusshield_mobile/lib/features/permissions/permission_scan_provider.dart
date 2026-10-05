import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/platform/nexus_platform_bridge.dart';
import '../../domain/models/app_permission_report.dart';
import '../../providers/app_protection_provider.dart';
import '../security/security_alert_provider.dart';

class PermissionScanState {
  const PermissionScanState({
    this.reports = const [],
    this.lastScan,
    this.scanning = false,
    this.error,
  });

  final List<AppPermissionReport> reports;
  final DateTime? lastScan;
  final bool scanning;
  final String? error;

  List<AppPermissionReport> get risky =>
      reports.where((r) => r.isRisky).toList(growable: false);

  PermissionScanState copyWith({
    List<AppPermissionReport>? reports,
    DateTime? lastScan,
    bool? scanning,
    String? error,
  }) {
    return PermissionScanState(
      reports: reports ?? this.reports,
      lastScan: lastScan ?? this.lastScan,
      scanning: scanning ?? this.scanning,
      error: error,
    );
  }
}

class PermissionScanController extends Notifier<PermissionScanState> {
  @override
  PermissionScanState build() {
    Future.microtask(scan);
    return const PermissionScanState();
  }

  Future<void> scan() async {
    state = state.copyWith(scanning: true, error: null);
    try {
      var raw = await NexusPlatformBridge.scanInstalledAppPermissions();
      if (raw.isEmpty) {
        raw = _fallbackFromProtectionProfiles(ref.read(appProtectionProvider));
      }
      final reports =
          raw.map(AppPermissionReport.fromMap).toList(growable: false);
      state = PermissionScanState(
        reports: reports,
        lastScan: DateTime.now(),
        scanning: false,
      );
    } catch (e) {
      state = state.copyWith(
        scanning: false,
        error: '$e',
      );
    }
  }
}

final permissionScanProvider =
    NotifierProvider<PermissionScanController, PermissionScanState>(
  PermissionScanController.new,
);

List<Map<String, dynamic>> _fallbackFromProtectionProfiles(
  List<AppProtectionProfile> apps,
) {
  return [
    for (final app in apps.where((a) => a.recommended))
      if (!(app.piiFirewall &&
          app.clipboardShield &&
          app.promptInjectionGuard))
        {
          'packageId': app.packageId,
          'displayName': app.displayName,
          'permissions': ['contacts', 'location'],
          'risk': 'medium',
        },
  ];
}

/// Listens for package install / permission change events from native layer.
final securityEventBridgeProvider = Provider<void>((ref) {
  final sub = NexusPlatformBridge.securityEvents().listen((event) {
    final type = '${event['type']}';
    if (type == 'package_changed' || type == 'package_added') {
      ref.read(securityAlertProvider.notifier).push(
            SecurityAlert(
              title: 'Uygulama değişikliği algılandı',
              body:
                  '${event['packageId'] ?? 'Yeni uygulama'} — izin taraması önerilir.',
              kind: SecurityAlertKind.permission,
            ),
          );
      ref.read(permissionScanProvider.notifier).scan();
    }
  });
  ref.onDispose(sub.cancel);
});
