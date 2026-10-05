import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/interfaces/security_module.dart';
import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../ai_shield/ai_shield_provider.dart';

class AiGuardSecurityModule implements SecurityModule {
  AiGuardSecurityModule(this._ref);

  final Ref _ref;

  static const moduleKey = 'ai_guard';

  @override
  String get id => moduleKey;

  @override
  String get displayName => 'Yapay Zeka';

  @override
  Future<ModuleHealth> evaluate() async {
    final score = _ref.read(aiShieldHealthProvider);
    final grants =
        _ref.read(aiShieldProvider).grants.values.where((g) => g.isValid).length;

    if (score >= 85) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Yapay Zeka Koruması',
        riskLevel: RiskLevel.secure,
        score: score,
        statusLabel: 'AI API & medya kalkanı aktif',
        detail: grants > 0
            ? '$grants şifreli rıza kaydı'
            : 'Firewall + keşif devrede',
      );
    }
    if (score >= 55) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Yapay Zeka Koruması',
        riskLevel: RiskLevel.warning,
        score: score,
        statusLabel: 'Kısmi AI koruması',
        detail: 'Rıza akışı ve modülleri tamamlayın',
      );
    }
    return ModuleHealth(
      moduleId: moduleKey,
      title: 'Yapay Zeka Koruması',
      riskLevel: RiskLevel.critical,
      score: score,
      statusLabel: 'AI koruması zayıf',
      detail: 'Kalkan + Banking/Deepfake + AI ekranı',
    );
  }
}
