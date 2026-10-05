import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/shield_providers.dart';
import '../../theme/app_theme.dart';
import '../../widgets/nexus_screen_header.dart';
import '../ai_shield/ai_shield_screen.dart';
import '../call_fraud/call_fraud_screen.dart';
import '../network/widgets/wifi_alert_banner.dart';
import '../permissions/permission_scan_screen.dart';
import '../security/security_alert_provider.dart';
import 'dashboard_provider.dart';
import 'widgets/protection_score_ring.dart';
import 'widgets/security_status_card.dart';

/// Live security dashboard — modular scores and status cards.
class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  void _openModule(BuildContext context, String moduleId) {
    final route = switch (moduleId) {
      'permissions' => const PermissionScanScreen(),
      'ai_guard' => const AiShieldScreen(),
      'call_fraud' => const CallFraudScreen(),
      'network' => null,
      _ => null,
    };
    if (route != null) {
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => route));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final dashboard = ref.watch(dashboardProvider);
    final shieldActive = ref.watch(shieldStatusProvider);
    final alerts = ref.watch(securityAlertProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const NexusScreenHeader(
          title: 'Güvenlik Panosu',
          subtitle: 'Canlı koruma skoru • modüler güvenlik durumu',
        ),
        const SizedBox(height: 12),
        const WifiAlertBanner(),
        if (alerts.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: CyberCard(
              borderColor: NexusBrand.amber,
              borderOpacity: 0.4,
              padding: const EdgeInsets.all(12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.notifications_active_outlined,
                      color: NexusBrand.amber, size: 20),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      alerts.first.body,
                      style: const TextStyle(fontSize: 12, height: 1.35),
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close, size: 18),
                    onPressed: () =>
                        ref.read(securityAlertProvider.notifier).dismiss(0),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 8),
        Center(
          child: ProtectionScoreRing(
            score: dashboard.score,
            busy: dashboard.isRefreshing,
            onTap: () => ref.read(shieldStatusProvider.notifier).toggle(),
          ),
        ),
        const SizedBox(height: 8),
        Center(
          child: Text(
            shieldActive
                ? 'Skora dokunarak kalkanı yönetebilirsiniz'
                : 'Korumayı açmak için skora dokunun',
            style: const TextStyle(color: NexusBrand.muted, fontSize: 12),
          ),
        ),
        const SizedBox(height: 20),
        if (dashboard.modules.isEmpty && dashboard.isRefreshing)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Center(child: CircularProgressIndicator()),
          )
        else
          ...dashboard.modules.map(
            (health) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: SecurityStatusCard(
                health: health,
                icon: iconForModuleId(health.moduleId),
                onTap: () => _openModule(context, health.moduleId),
              ),
            ),
          ),
      ],
    );
  }
}
