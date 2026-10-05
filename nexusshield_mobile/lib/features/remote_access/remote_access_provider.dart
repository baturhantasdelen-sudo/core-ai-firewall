import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/platform/nexus_platform_bridge.dart';
import '../../domain/models/remote_access_signal.dart';
import '../security/security_alert_provider.dart';

class RemoteAccessController extends Notifier<RemoteAccessSignalReport> {
  Timer? _timer;

  @override
  RemoteAccessSignalReport build() {
    ref.onDispose(() => _timer?.cancel());
    _timer = Timer.periodic(const Duration(seconds: 20), (_) => refresh());
    Future.microtask(refresh);
    return const RemoteAccessSignalReport(
      screenCaptureActive: false,
      suspiciousAccessibilityCount: 0,
      overlayAppsCount: 0,
      detail: 'Tarama bekleniyor',
    );
  }

  Future<void> refresh() async {
    try {
      final map = await NexusPlatformBridge.getRemoteAccessSignals();
      final report = RemoteAccessSignalReport.fromMap(map);
      state = report;
      if (report.isThreat) {
        ref.read(securityAlertProvider.notifier).push(
              SecurityAlert(
                title: 'Uzaktan erişim şüphesi',
                body: report.detail,
                kind: SecurityAlertKind.remoteAccess,
              ),
            );
      }
    } catch (_) {
      /* keep last */
    }
  }
}

final remoteAccessProvider =
    NotifierProvider<RemoteAccessController, RemoteAccessSignalReport>(
  RemoteAccessController.new,
);
