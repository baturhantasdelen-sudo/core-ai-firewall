import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/platform/nexus_platform_bridge.dart';
import '../../domain/models/wifi_security_report.dart';
import '../security/security_alert_provider.dart';

class WifiSecurityController extends Notifier<WifiSecurityReport> {
  Timer? _timer;

  @override
  WifiSecurityReport build() {
    ref.onDispose(() => _timer?.cancel());
    _timer = Timer.periodic(const Duration(seconds: 45), (_) => refresh());
    Future.microtask(refresh);
    return WifiSecurityReport.disconnected();
  }

  Future<void> refresh() async {
    try {
      final map = await NexusPlatformBridge.getWifiSecuritySnapshot();
      final report = WifiSecurityReport.fromMap(map);
      state = report;
      if (report.isUrgent) {
        ref.read(securityAlertProvider.notifier).push(
              SecurityAlert(
                title: 'Ağ güvenliği uyarısı',
                body: report.detail.isNotEmpty
                    ? report.detail
                    : '${report.ssid} — ${report.encryption.label}',
                kind: SecurityAlertKind.network,
              ),
            );
      }
    } catch (_) {
      state = WifiSecurityReport.disconnected();
    }
  }
}

final wifiSecurityProvider =
    NotifierProvider<WifiSecurityController, WifiSecurityReport>(
  WifiSecurityController.new,
);
