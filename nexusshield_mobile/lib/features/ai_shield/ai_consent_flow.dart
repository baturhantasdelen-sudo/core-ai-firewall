import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/ai_consent_grant.dart';
import '../../theme/app_theme.dart';
import 'ai_shield_provider.dart';

/// Explicit opt-in before AI clients access sensitive device data.
Future<bool> showAiConsentFlow(
  BuildContext context, {
  required String providerId,
  required String providerTitle,
  required Set<AiSensitiveScope> scopes,
}) async {
  final result = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    backgroundColor: NexusBrand.glassPanel,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) {
      return _AiConsentSheet(
        providerId: providerId,
        providerTitle: providerTitle,
        scopes: scopes,
      );
    },
  );
  return result == true;
}

class _AiConsentSheet extends ConsumerStatefulWidget {
  const _AiConsentSheet({
    required this.providerId,
    required this.providerTitle,
    required this.scopes,
  });

  final String providerId;
  final String providerTitle;
  final Set<AiSensitiveScope> scopes;

  @override
  ConsumerState<_AiConsentSheet> createState() => _AiConsentSheetState();
}

class _AiConsentSheetState extends ConsumerState<_AiConsentSheet> {
  var _busy = false;

  @override
  Widget build(BuildContext context) {
    final scopeLines = widget.scopes.map((s) => '• ${s.labelTr}').join('\n');
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: 20 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Yapay zeka erişim onayı',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            '${widget.providerTitle} aşağıdaki hassas verilere erişmek istiyor. '
            'Onay şifreli vault’ta saklanır; 24 saat sonra yenilenmelidir.',
            style: const TextStyle(color: NexusBrand.muted, height: 1.35),
          ),
          const SizedBox(height: 12),
          Text(scopeLines, style: const TextStyle(height: 1.4)),
          const SizedBox(height: 20),
          FilledButton(
            onPressed: _busy
                ? null
                : () async {
                    setState(() => _busy = true);
                    await ref.read(aiShieldProvider.notifier).grantConsent(
                          providerId: widget.providerId,
                          scopes: widget.scopes,
                        );
                    if (context.mounted) Navigator.pop(context, true);
                  },
            child: Text(_busy ? 'Kaydediliyor…' : 'Şifreli onay ver'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Reddet'),
          ),
        ],
      ),
    );
  }
}
