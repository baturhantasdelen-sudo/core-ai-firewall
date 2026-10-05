import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/module_health.dart';
import '../../domain/models/protection_score.dart';
import '../../domain/interfaces/security_module.dart';
import '../../providers/app_protection_provider.dart';
import '../../providers/shield_providers.dart';
import '../ai_shield/ai_shield_provider.dart';
import '../call_fraud/call_fraud_provider.dart';
import '../network/wifi_security_provider.dart';
import '../permissions/permission_scan_provider.dart';
import '../remote_access/remote_access_provider.dart';
import 'modules/ai_guard_security_module.dart';
import 'modules/call_fraud_security_module.dart';
import 'modules/live_shield_security_module.dart';
import 'modules/network_security_module.dart';
import 'modules/permissions_security_module.dart';
import 'modules/remote_access_security_module.dart';

class DashboardState {
  const DashboardState({
    required this.score,
    required this.modules,
    required this.isRefreshing,
  });

  final ProtectionScore score;
  final List<ModuleHealth> modules;
  final bool isRefreshing;

  static DashboardState initial() {
    return DashboardState(
      score: ProtectionScore(
        score: 0,
        level: RiskLevel.warning,
        headline: RiskLevel.warning.labelTr,
        evaluatedAt: DateTime.now(),
      ),
      modules: const [],
      isRefreshing: true,
    );
  }

  DashboardState copyWith({
    ProtectionScore? score,
    List<ModuleHealth>? modules,
    bool? isRefreshing,
  }) {
    return DashboardState(
      score: score ?? this.score,
      modules: modules ?? this.modules,
      isRefreshing: isRefreshing ?? this.isRefreshing,
    );
  }
}

final securityModulesProvider = Provider<List<SecurityModule>>((ref) {
  return [
    LiveShieldSecurityModule(ref),
    NetworkSecurityModule(ref),
    PermissionsSecurityModule(ref),
    AiGuardSecurityModule(ref),
    CallFraudSecurityModule(ref),
    RemoteAccessSecurityModule(ref),
  ];
});

class DashboardController extends Notifier<DashboardState> {
  @override
  DashboardState build() {
    ref.listen(shieldStatusProvider, (_, _) => _scheduleRefresh());
    ref.listen(shieldSettingsProvider, (_, _) => _scheduleRefresh());
    ref.listen(telemetryStatsProvider, (_, _) => _scheduleRefresh());
    ref.listen(appProtectionProvider, (_, _) => _scheduleRefresh());
    ref.listen(permissionScanProvider, (_, _) => _scheduleRefresh());
    ref.listen(wifiSecurityProvider, (_, _) => _scheduleRefresh());
    ref.listen(aiShieldProvider, (_, _) => _scheduleRefresh());
    ref.listen(callFraudProvider, (_, _) => _scheduleRefresh());
    ref.listen(remoteAccessProvider, (_, _) => _scheduleRefresh());
    Future.microtask(refresh);
    return DashboardState.initial();
  }

  void _scheduleRefresh() {
    Future.microtask(refresh);
  }

  Future<void> refresh() async {
    state = state.copyWith(isRefreshing: true);
    final modules = ref.read(securityModulesProvider);
    final healths = await Future.wait(modules.map((m) => m.evaluate()));
    final aggregate = ProtectionScore.fromModuleScores(
      moduleScores: healths.map((h) => h.score).toList(),
      evaluatedAt: DateTime.now(),
    );
    state = DashboardState(
      score: aggregate,
      modules: healths,
      isRefreshing: false,
    );
  }
}

final dashboardProvider =
    NotifierProvider<DashboardController, DashboardState>(
  DashboardController.new,
);
