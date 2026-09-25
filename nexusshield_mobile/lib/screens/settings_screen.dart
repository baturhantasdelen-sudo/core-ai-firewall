import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/shield_providers.dart';
import '../theme/app_theme.dart';
import '../widgets/nexus_screen_header.dart';
import 'app_protection_screen.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settings = ref.watch(shieldSettingsProvider);
    final notifier = ref.read(shieldSettingsProvider.notifier);

    return SafeArea(
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const NexusScreenHeader(
            title: 'Protection Modules',
            subtitle:
                'Configure on-device VPN tunnel, banking isolation, and social deepfake scanning.',
          ),
          const SizedBox(height: 20),
          _SettingTile(
            title: '🛡️ Local TUN/VPN Interceptor',
            subtitle: 'Android VpnService / iOS NEPacketTunnelProvider proxy',
            value: settings.localVpn,
            onChanged: notifier.setLocalVpn,
            icon: Icons.vpn_lock_outlined,
          ),
          _SettingTile(
            title: '🏦 Banking & SMS OTP Guard',
            subtitle: 'Accessibility isolation for banking, crypto, messaging',
            value: settings.bankingGuard,
            onChanged: notifier.setBankingGuard,
            icon: Icons.account_balance_outlined,
          ),
          _SettingTile(
            title: '👁️ Real-time Social Media Deepfake Badge',
            subtitle: 'C2PA + on-device synthetic media heuristics',
            value: settings.deepfakeScanner,
            onChanged: notifier.setDeepfakeScanner,
            icon: Icons.face_retouching_off_outlined,
          ),
          const SizedBox(height: 12),
          CyberCard(
            child: ListTile(
              leading: const Icon(Icons.apps_outlined, color: NexusBrand.cyberCyan),
              title: const Text(
                'Per-App Protection Matrix',
                style: TextStyle(fontWeight: FontWeight.w600),
              ),
              subtitle: const Text(
                'Banking, AI clients, messaging — granular PII / clipboard / injection toggles',
                style: TextStyle(color: NexusBrand.muted),
              ),
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.of(context).push(
                  MaterialPageRoute<void>(
                    builder: (_) => const AppProtectionScreen(),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 24),
          const CyberCard(
            child: ListTile(
              leading: Icon(Icons.info_outline, color: NexusBrand.cyberCyan),
              title: Text('Native services'),
              subtitle: Text(
                'VPN and Accessibility services are registered in AndroidManifest. '
                'Enable them in system settings after first install.',
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SettingTile extends StatelessWidget {
  const _SettingTile({
    required this.title,
    required this.subtitle,
    required this.value,
    required this.onChanged,
    required this.icon,
  });

  final String title;
  final String subtitle;
  final bool value;
  final ValueChanged<bool> onChanged;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: CyberCard(
        padding: EdgeInsets.zero,
        child: SwitchListTile(
        secondary: Icon(icon, color: NexusBrand.neonGreen),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle, style: const TextStyle(color: NexusBrand.muted)),
        value: value,
        onChanged: onChanged,
        ),
      ),
    );
  }
}
