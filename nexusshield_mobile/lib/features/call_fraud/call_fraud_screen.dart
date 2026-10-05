import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/app_theme.dart';
import '../../widgets/nexus_screen_header.dart';
import 'call_fraud_provider.dart';

class CallFraudScreen extends ConsumerWidget {
  const CallFraudScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fraud = ref.watch(callFraudProvider);

    return Scaffold(
      backgroundColor: NexusBrand.deepSlate,
      appBar: AppBar(title: const Text('Arama koruması')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const NexusScreenHeader(
            title: 'Dolandırıcı numara engeli',
            subtitle:
                'Android: CallScreeningService • iOS: Call Directory Extension (Xcode hedefi)',
          ),
          CyberCard(
            padding: const EdgeInsets.all(14),
            child: Text(
              fraud.synced
                  ? '${fraud.blockedNumbers.length} numara native katmana senkronize edildi.'
                  : 'Feed yüklenemedi veya senkron bekliyor.',
              style: const TextStyle(height: 1.35),
            ),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: () => ref.read(callFraudProvider.notifier).resync(),
            icon: const Icon(Icons.sync),
            label: const Text('Listeyi yeniden senkronize et'),
          ),
          const SizedBox(height: 16),
          ...fraud.blockedNumbers.take(25).map(
                (n) => ListTile(
                  dense: true,
                  leading: const Icon(Icons.block, color: NexusBrand.alertRed),
                  title: Text(n),
                ),
              ),
        ],
      ),
    );
  }
}
