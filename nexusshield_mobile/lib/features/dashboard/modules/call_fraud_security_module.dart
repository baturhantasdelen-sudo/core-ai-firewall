import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/interfaces/security_module.dart';
import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../call_fraud/call_fraud_provider.dart';

class CallFraudSecurityModule implements SecurityModule {
  CallFraudSecurityModule(this._ref);

  final Ref _ref;

  static const moduleKey = 'call_fraud';

  @override
  String get id => moduleKey;

  @override
  String get displayName => 'Arama';

  @override
  Future<ModuleHealth> evaluate() async {
    final state = _ref.read(callFraudProvider);
    if (state.synced && state.blockedNumbers.isNotEmpty) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Arama & Dolandırıcılık',
        riskLevel: RiskLevel.secure,
        score: 90,
        statusLabel: 'Casus numara listesi aktif',
        detail: '${state.blockedNumbers.length} numara engellendi',
      );
    }
    return const ModuleHealth(
      moduleId: moduleKey,
      title: 'Arama & Dolandırıcılık',
      riskLevel: RiskLevel.warning,
      score: 45,
      statusLabel: 'Call Screening bekleniyor',
      detail: 'Feed senkronu ve sistem rolünü doğrulayın',
    );
  }
}
