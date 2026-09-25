import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/app_protection_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/nexus_logo.dart';

class AppProtectionScreen extends ConsumerWidget {
  const AppProtectionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apps = ref.watch(appProtectionProvider);
    final notifier = ref.read(appProtectionProvider.notifier);

    final recommended = apps.where((a) => a.recommended).toList();
    final systemApps = apps.where((a) => !a.recommended).toList();

    return Scaffold(
      backgroundColor: NexusBrand.deepSlate,
      appBar: AppBar(
        title: Row(
          children: [
            const NexusLogo(size: 26, maxWidth: 132),
            const SizedBox(width: 10),
            const Expanded(
              child: Text(
                'Per-App Protection Matrix',
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text(
            'Choose which installed apps receive PII scrubbing, clipboard '
            'isolation, and prompt-injection guards.',
            style: TextStyle(color: NexusBrand.muted, height: 1.35),
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _QuickActionChip(
                label: 'Protect All Financial Apps',
                onTap: notifier.protectAllFinancialApps,
              ),
              _QuickActionChip(
                label: 'Protect All Messaging Apps',
                onTap: notifier.protectAllMessagingApps,
              ),
              _QuickActionChip(
                label: 'Reset to Smart Defaults',
                onTap: notifier.resetSmartDefaults,
              ),
            ],
          ),
          const SizedBox(height: 20),
          const _SectionHeader(title: 'Recommended Apps (Auto-Enabled)'),
          const SizedBox(height: 8),
          for (final app in recommended) ...[
            _AppProtectionTile(app: app),
            const SizedBox(height: 10),
          ],
          const SizedBox(height: 12),
          const _SectionHeader(title: 'System & Other Apps'),
          const SizedBox(height: 8),
          for (final app in systemApps) ...[
            _AppProtectionTile(app: app),
            const SizedBox(height: 10),
          ],
        ],
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(
      title,
      style: const TextStyle(
        color: Colors.white,
        fontWeight: FontWeight.bold,
        fontSize: 16,
      ),
    );
  }
}

class _QuickActionChip extends StatelessWidget {
  const _QuickActionChip({required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      label: Text(label, style: const TextStyle(fontSize: 12, color: Colors.white)),
      backgroundColor: NexusBrand.glassPanel,
      side: BorderSide(color: NexusBrand.cyberCyan.withValues(alpha: 0.35)),
      onPressed: onTap,
    );
  }
}

class _AppProtectionTile extends ConsumerWidget {
  const _AppProtectionTile({required this.app});

  final AppProtectionProfile app;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(appProtectionProvider.notifier);

    return CyberCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: NexusBrand.cyberCyan.withValues(alpha: 0.45),
                  ),
                  gradient: LinearGradient(
                    colors: [
                      NexusBrand.glassPanel,
                      NexusBrand.cyberCyan.withValues(alpha: 0.12),
                    ],
                  ),
                ),
                child: CircleAvatar(
                  radius: 22,
                  backgroundColor: NexusBrand.deepSlate,
                  child: Icon(app.icon, color: NexusBrand.neonGreen, size: 22),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      app.displayName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    Text(
                      app.packageId,
                      style: const TextStyle(
                        color: NexusBrand.muted,
                        fontSize: 11,
                      ),
                    ),
                    Text(
                      categoryLabel(app.category),
                      style: const TextStyle(
                        color: NexusBrand.cyberCyan,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              if (app.recommended)
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: NexusBrand.neonGreen.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Text(
                    'REC',
                    style: TextStyle(
                      color: NexusBrand.neonGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const Divider(height: 20, color: Color(0xFF334155)),
          _ToggleRow(
            emoji: '🧹',
            label: 'PII Firewall',
            value: app.piiFirewall,
            onChanged: (v) => notifier.setPiiFirewall(app.packageId, v),
          ),
          _ToggleRow(
            emoji: '📋',
            label: 'Clipboard Shield',
            value: app.clipboardShield,
            onChanged: (v) => notifier.setClipboardShield(app.packageId, v),
          ),
          _ToggleRow(
            emoji: '🛑',
            label: 'Prompt Injection Guard',
            value: app.promptInjectionGuard,
            onChanged: (v) =>
                notifier.setPromptInjectionGuard(app.packageId, v),
          ),
        ],
      ),
    );
  }
}

class _ToggleRow extends StatelessWidget {
  const _ToggleRow({
    required this.emoji,
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String emoji;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(
        '$emoji $label',
        style: const TextStyle(color: Colors.white, fontSize: 13),
      ),
      value: value,
      onChanged: onChanged,
    );
  }
}
