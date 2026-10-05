import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/interfaces/security_module.dart';
import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../remote_access/remote_access_provider.dart';

class RemoteAccessSecurityModule implements SecurityModule {
  RemoteAccessSecurityModule(this._ref);

  final Ref _ref;

  static const moduleKey = 'remote_access';

  @override
  String get id => moduleKey;

  @override
  String get displayName => 'Uzaktan erişim';

  @override
  Future<ModuleHealth> evaluate() async {
    final report = _ref.read(remoteAccessProvider);
    if (report.isThreat) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Uzaktan Erişim Kalkanı',
        riskLevel: RiskLevel.critical,
        score: 20,
        statusLabel: 'Olası ekran paylaşımı / RAT',
        detail: report.detail,
      );
    }
    return ModuleHealth(
      moduleId: moduleKey,
      title: 'Uzaktan Erişim Kalkanı',
      riskLevel: RiskLevel.secure,
      score: 92,
      statusLabel: 'Uzaktan erişim sinyali yok',
      detail: report.detail,
    );
  }
}
