import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/telemetry_stats.dart';
import '../providers/shield_providers.dart';
import '../theme/app_theme.dart';
import '../widgets/live_playground_panel.dart';
import '../widgets/nexus_screen_header.dart';
import '../widgets/shield_button.dart';
import '../widgets/telemetry_card.dart';

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isActive = ref.watch(shieldStatusProvider);
    final telemetry = ref.watch(telemetryStatsProvider);
    final settings = ref.watch(shieldSettingsProvider);

    return SafeArea(
      child: LayoutBuilder(
        builder: (context, constraints) {
          final wide = constraints.maxWidth >= 900;

          return SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const NexusScreenHeader(
                  title: 'Personal AI Guard',
                  subtitle:
                      'On-device PII firewall • BYOK vault • Deepfake scanner',
                ),
                const SizedBox(height: 24),
                Center(
                  child: ShieldButton(
                    active: isActive,
                    latencyMs: telemetry.averageLatencyMs.round(),
                    onPressed: () =>
                        ref.read(shieldStatusProvider.notifier).toggle(),
                  ),
                ),
                const SizedBox(height: 24),
                _TelemetryGrid(
                  telemetry: telemetry,
                  settings: settings,
                  pulse: isActive,
                  wide: wide,
                ),
                const SizedBox(height: 20),
                const LivePlaygroundPanel(),
                const SizedBox(height: 12),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TelemetryGrid extends StatelessWidget {
  const _TelemetryGrid({
    required this.telemetry,
    required this.settings,
    required this.pulse,
    required this.wide,
  });

  final TelemetryStats telemetry;
  final ShieldSettings settings;
  final bool pulse;
  final bool wide;

  @override
  Widget build(BuildContext context) {
    final latencyValue = settings.localVpn && telemetry.probeCount > 0
        ? '${telemetry.averageLatencyMs.round()} ms avg'
        : settings.localVpn
            ? '— ms avg'
            : 'OFF';

    final cards = [
      TelemetryCard(
        emoji: '🧹',
        title: 'PII Items Masked',
        value: '${telemetry.piiMasked}',
        subtitle: 'Cards, TCKN, API keys, email',
        accent: NexusBrand.neonGreen,
        pulse: pulse,
      ),
      TelemetryCard(
        emoji: '🏦',
        title: 'Banking & SMS OTP Interceptions',
        value: settings.bankingGuard ? '${telemetry.bankingIsolated}' : 'OFF',
        subtitle: 'Clipboard + OTP isolation',
        accent: NexusBrand.cyberCyan,
        pulse: pulse,
      ),
      TelemetryCard(
        emoji: '👁️',
        title: 'Deepfakes Flagged',
        value:
            settings.deepfakeScanner ? '${telemetry.deepfakesFlagged}' : 'OFF',
        subtitle: 'C2PA / synthetic heuristics',
        accent: NexusBrand.alertRed,
        pulse: pulse,
      ),
      TelemetryCard(
        emoji: '⚡',
        title: 'Avg Latency Badge',
        value: latencyValue,
        subtitle: 'Local scrub + action firewall',
        accent: NexusBrand.cyberCyan,
        pulse: pulse,
        badge: telemetry.averageLatencyMs > 0 && telemetry.averageLatencyMs < 12
            ? '<12ms'
            : null,
      ),
    ];

    return GridView.count(
      crossAxisCount: wide ? 4 : 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: wide ? 0.92 : 0.88,
      children: cards,
    );
  }
}
