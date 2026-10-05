import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/interfaces/security_module.dart';
import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../../domain/models/app_permission_report.dart';
import '../../permissions/permission_scan_provider.dart';

class PermissionsSecurityModule implements SecurityModule {
  PermissionsSecurityModule(this._ref);

  final Ref _ref;

  static const moduleKey = 'permissions';

  @override
  String get id => moduleKey;

  @override
  String get displayName => 'İzinler';

  @override
  Future<ModuleHealth> evaluate() async {
    final scan = _ref.read(permissionScanProvider);
    if (scan.scanning && scan.reports.isEmpty) {
      return const ModuleHealth(
        moduleId: moduleKey,
        title: 'Uygulama İzinleri',
        riskLevel: RiskLevel.warning,
        score: 50,
        statusLabel: 'Tarama sürüyor',
        detail: 'Yüklü uygulamalar analiz ediliyor',
      );
    }

    final risky = scan.risky.length;
    final high = scan.reports
        .where((r) => r.riskTier == AppPermissionRiskTier.high)
        .length;

    if (risky == 0 && scan.reports.isNotEmpty) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Uygulama İzinleri',
        riskLevel: RiskLevel.secure,
        score: 94,
        statusLabel: 'İzinler Kontrol Altında',
        detail: '${scan.reports.length} uygulama tarandı — kritik profil yok',
      );
    }
    if (high > 0) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Uygulama İzinleri',
        riskLevel: RiskLevel.critical,
        score: 35,
        statusLabel: '$high yüksek riskli uygulama',
        detail: 'İzin Tarayıcısından inceleyin',
      );
    }
    if (risky > 0) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Uygulama İzinleri',
        riskLevel: RiskLevel.warning,
        score: 62,
        statusLabel: '$risky orta/yüksek risk',
        detail: 'Kamera, mikrofon, rehber veya konum',
      );
    }

    return const ModuleHealth(
      moduleId: moduleKey,
      title: 'Uygulama İzinleri',
      riskLevel: RiskLevel.warning,
      score: 55,
      statusLabel: 'Tarama bekleniyor',
      detail: 'İzin tarayıcısını açın',
    );
  }
}
