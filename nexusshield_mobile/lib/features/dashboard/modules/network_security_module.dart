import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../domain/interfaces/security_module.dart';
import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../../domain/models/wifi_security_report.dart';
import '../../../providers/shield_providers.dart';
import '../../network/wifi_security_provider.dart';

class NetworkSecurityModule implements SecurityModule {
  NetworkSecurityModule(this._ref);

  final Ref _ref;

  static const moduleKey = 'network';

  @override
  String get id => moduleKey;

  @override
  String get displayName => 'Ağ';

  @override
  Future<ModuleHealth> evaluate() async {
    final wifi = _ref.read(wifiSecurityProvider);
    final settings = _ref.read(shieldSettingsProvider);
    final shieldOn = _ref.read(shieldStatusProvider);

    if (wifi.isUrgent) {
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Ağ Güvenliği',
        riskLevel: RiskLevel.critical,
        score: 25,
        statusLabel: 'Güvensiz ağ algılandı',
        detail: '${wifi.ssid} • ${wifi.encryption.label}',
      );
    }

    if (wifi.connected &&
        (wifi.encryption == WifiEncryptionClass.wpa3 ||
            wifi.encryption == WifiEncryptionClass.wpa2)) {
      final vpnBoost = settings.localVpn && shieldOn;
      return ModuleHealth(
        moduleId: moduleKey,
        title: 'Ağ Güvenliği',
        riskLevel: RiskLevel.secure,
        score: vpnBoost ? 96 : 82,
        statusLabel: 'Ağ Güvenli',
        detail: '${wifi.encryption.label} • ${wifi.ssid}',
      );
    }

    if (settings.localVpn && shieldOn) {
      return const ModuleHealth(
        moduleId: moduleKey,
        title: 'Ağ Güvenliği',
        riskLevel: RiskLevel.secure,
        score: 88,
        statusLabel: 'Güvenli tünel aktif',
        detail: 'Yerel VPN katmanı devrede',
      );
    }

    return ModuleHealth(
      moduleId: moduleKey,
      title: 'Ağ Güvenliği',
      riskLevel: RiskLevel.warning,
      score: 52,
      statusLabel: wifi.connected ? 'Ağ izleniyor' : 'Bağlantı yok',
      detail: wifi.detail,
    );
  }
}
