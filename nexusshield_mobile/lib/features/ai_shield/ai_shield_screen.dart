import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/ai_consent_grant.dart';
import '../../providers/api_discovery_provider.dart';
import '../../theme/app_theme.dart';
import '../../widgets/nexus_screen_header.dart';
import 'ai_consent_flow.dart';
import 'ai_shield_provider.dart';

class AiShieldScreen extends ConsumerWidget {
  const AiShieldScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final discovery = ref.watch(apiDiscoveryProvider);
    final ai = ref.watch(aiShieldProvider);

    return Scaffold(
      backgroundColor: NexusBrand.deepSlate,
      appBar: AppBar(title: const Text('AI API Kalkanı')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const NexusScreenHeader(
            title: 'Harici AI köprüsü',
            subtitle:
                'Keşfedilen uç noktalar Rust firewall üzerinden; hassas erişim için açık rıza gerekir.',
          ),
          CyberCard(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Icon(
                  ai.proxyReady ? Icons.verified_user : Icons.hourglass_empty,
                  color: ai.proxyReady ? NexusBrand.neonGreen : NexusBrand.amber,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    ai.proxyReady
                        ? 'Proxy motoru hazır (Rust FFI + Action Firewall)'
                        : 'Motor ilk kullanımda başlatılır',
                    style: const TextStyle(height: 1.35),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Keşfedilen servisler',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 8),
          ...discovery.endpoints.map(
            (e) => ListTile(
              title: Text(e.title),
              subtitle: Text(
                e.subtitle,
                style: const TextStyle(color: NexusBrand.muted, fontSize: 12),
              ),
              trailing: IconButton(
                icon: const Icon(Icons.lock_open_outlined),
                onPressed: () async {
                  await showAiConsentFlow(
                    context,
                    providerId: e.id,
                    providerTitle: e.title,
                    scopes: const {
                      AiSensitiveScope.clipboard,
                      AiSensitiveScope.contacts,
                    },
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text(
            'Aktif onaylar',
            style: TextStyle(fontWeight: FontWeight.w700),
          ),
          if (ai.grants.isEmpty)
            const Text(
              'Henüz rıza kaydı yok.',
              style: TextStyle(color: NexusBrand.muted),
            )
          else
            ...ai.grants.entries.map(
              (entry) => ListTile(
                title: Text(entry.key),
                subtitle: Text(
                  entry.value.scopes.map((s) => s.labelTr).join(', '),
                  style: const TextStyle(color: NexusBrand.muted, fontSize: 12),
                ),
                trailing: IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () =>
                      ref.read(aiShieldProvider.notifier).revoke(entry.key),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
