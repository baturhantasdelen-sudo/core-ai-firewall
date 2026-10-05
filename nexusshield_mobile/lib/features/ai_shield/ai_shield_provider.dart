import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/ai_consent_grant.dart';
import '../../providers/api_discovery_provider.dart';
import '../../providers/shield_providers.dart';
import '../../services/firewall_service.dart';
import 'ai_consent_service.dart';

final aiConsentServiceProvider = Provider<AiConsentService>(
  (ref) => AiConsentService(),
);

class AiShieldState {
  const AiShieldState({
    this.grants = const {},
    this.proxyReady = false,
  });

  final Map<String, AiConsentGrant> grants;
  final bool proxyReady;

  AiShieldState copyWith({
    Map<String, AiConsentGrant>? grants,
    bool? proxyReady,
  }) {
    return AiShieldState(
      grants: grants ?? this.grants,
      proxyReady: proxyReady ?? this.proxyReady,
    );
  }
}

class AiShieldController extends Notifier<AiShieldState> {
  @override
  AiShieldState build() => const AiShieldState();

  Future<void> bootstrapProxy() async {
    await FirewallService.instance.ensureInitialized();
    state = state.copyWith(proxyReady: true);
  }

  Future<AiConsentGrant?> grantConsent({
    required String providerId,
    required Set<AiSensitiveScope> scopes,
  }) async {
    final grant = await ref.read(aiConsentServiceProvider).grant(
          providerId: providerId,
          scopes: scopes,
        );
    state = state.copyWith(
      grants: {...state.grants, providerId: grant},
    );
    return grant;
  }

  Future<void> revoke(String providerId) async {
    await ref.read(aiConsentServiceProvider).revoke(providerId);
    final next = Map<String, AiConsentGrant>.from(state.grants)
      ..remove(providerId);
    state = state.copyWith(grants: next);
  }

  /// Proxied outbound text — requires active shield + optional consent for scope.
  Future<String> proxyOutbound({
    required String providerId,
    required String rawText,
    AiSensitiveScope? requiredScope,
  }) async {
    await bootstrapProxy();
    if (requiredScope != null) {
      final grant = state.grants[providerId] ??
          await ref.read(aiConsentServiceProvider).readGrant(providerId);
      if (grant == null || !grant.scopes.contains(requiredScope)) {
        throw StateError('AI consent required for ${requiredScope.labelTr}');
      }
    }
    final settings = ref.read(shieldSettingsProvider);
    final processed = FirewallService.instance.processOutboundPayload(
      rawText: rawText,
      bankingGuardEnabled: settings.bankingGuard,
    );
    return processed.scrubbedText;
  }
}

final aiShieldProvider =
    NotifierProvider<AiShieldController, AiShieldState>(
  AiShieldController.new,
);

/// Combines API discovery + consent for dashboard health.
final aiShieldHealthProvider = Provider<int>((ref) {
  ref.watch(aiShieldProvider);
  ref.watch(apiDiscoveryProvider);
  final shield = ref.watch(shieldStatusProvider);
  final settings = ref.watch(shieldSettingsProvider);
  var score = 40;
  if (settings.bankingGuard) score += 20;
  if (settings.deepfakeScanner) score += 15;
  if (shield) score += 25;
  final grants =
      ref.watch(aiShieldProvider).grants.values.where((g) => g.isValid);
  if (grants.isNotEmpty) score += 10;
  return score.clamp(0, 100);
});
