import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/app_theme.dart';
import '../wifi_security_provider.dart';

class WifiAlertBanner extends ConsumerWidget {
  const WifiAlertBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final wifi = ref.watch(wifiSecurityProvider);
    if (!wifi.isUrgent) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: CyberCard(
        borderColor: NexusBrand.alertRed,
        borderOpacity: 0.5,
        glowColor: NexusBrand.alertRed,
        glowStrength: 0.15,
        padding: const EdgeInsets.all(14),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.wifi_tethering_error, color: NexusBrand.alertRed),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Acil ağ uyarısı',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: NexusBrand.alertRed,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${wifi.ssid} • ${wifi.encryption.label}\n${wifi.detail}',
                    style: const TextStyle(
                      color: NexusBrand.muted,
                      fontSize: 12,
                      height: 1.35,
                    ),
                  ),
                  if (wifi.recommendVpnTunnel) ...[
                    const SizedBox(height: 8),
                    Text(
                      'Öneri: Ayarlar → Yerel VPN / güvenli tüneli etkinleştirin.',
                      style: TextStyle(
                        color: NexusBrand.cyberCyan.withValues(alpha: 0.95),
                        fontSize: 12,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
