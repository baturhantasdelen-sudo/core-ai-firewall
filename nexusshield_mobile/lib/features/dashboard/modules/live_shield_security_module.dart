import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/interfaces/security_module.dart';
import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../../providers/shield_providers.dart';
import '../../../services/firewall_service.dart';

class LiveShieldSecurityModule implements SecurityModule {
  LiveShieldSecurityModule(this._ref);

  final Ref _ref;

  static const moduleKey = 'live_shield';

  @override
  String get id => moduleKey;

  @override
  String get displayName => 'Canlı Kalkan';

  @override
  Future<ModuleHealth> evaluate() async {
    final active = _ref.read(shieldStatusProvider);
    final telemetry = _ref.read(telemetryStatsProvider);

    if (active) {
      try {
        await FirewallService.instance.ensureInitialized();
      } catch (_) {
        return const ModuleHealth(
          moduleId: moduleKey,
          title: 'Canlı Kalkan',
          riskLevel: RiskLevel.warning,
          score: 55,
          statusLabel: 'Kalkan açık — motor hazırlanıyor',
          detail: 'Rust FFI firewall başlatılıyor.',
        );
      }
      final latencyOk =
          telemetry.probeCount == 0 || telemetry.averageLatencyMs < 50;
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Canlı Kalkan',
        riskLevel: latencyOk ? RiskLevel.secure : RiskLevel.warning,
        score: latencyOk ? 100 : 75,
        statusLabel: 'Canlı Kalkan Aktif',
        detail: telemetry.probeCount > 0
            ? 'Ortalama gecikme ${telemetry.averageLatencyMs.round()} ms'
            : 'PII ve aksiyon duvarı dinlemede',
      );
    }

    return const ModuleHealth(
      moduleId: moduleKey,
      title: 'Canlı Kalkan',
      riskLevel: RiskLevel.warning,
      score: 35,
      statusLabel: 'Kalkan kapalı',
      detail: 'Korumayı etkinleştirmek için skora dokunun.',
    );
  }
}
