import 'dart:convert';
import 'dart:math';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import '../../domain/models/ai_consent_grant.dart';

class AiConsentService {
  AiConsentService({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _keyPrefix = 'nexus_ai_consent_';

  final FlutterSecureStorage _storage;
  final _rng = Random.secure();

  Future<AiConsentGrant?> readGrant(String providerId) async {
    final raw = await _storage.read(key: '$_keyPrefix$providerId');
    if (raw == null || raw.isEmpty) return null;
    final grant = AiConsentGrant.fromJson(
      jsonDecode(raw) as Map<String, dynamic>,
    );
    if (!grant.isValid) {
      await revoke(providerId);
      return null;
    }
    return grant;
  }

  Future<AiConsentGrant> grant({
    required String providerId,
    required Set<AiSensitiveScope> scopes,
    Duration ttl = const Duration(hours: 24),
  }) async {
    final tokenBytes = List<int>.generate(32, (_) => _rng.nextInt(256));
    final token = base64UrlEncode(tokenBytes);
    final now = DateTime.now();
    final grant = AiConsentGrant(
      providerId: providerId,
      scopes: scopes,
      grantedAt: now,
      expiresAt: now.add(ttl),
      consentTokenHint: token.substring(0, 8),
    );
    await _storage.write(
      key: '$_keyPrefix$providerId',
      value: jsonEncode(grant.toJson()),
    );
    await _storage.write(key: '${_keyPrefix}token_$providerId', value: token);
    return grant;
  }

  Future<String?> consentToken(String providerId) async {
    final grant = await readGrant(providerId);
    if (grant == null) return null;
    return _storage.read(key: '${_keyPrefix}token_$providerId');
  }

  Future<void> revoke(String providerId) async {
    await _storage.delete(key: '$_keyPrefix$providerId');
    await _storage.delete(key: '${_keyPrefix}token_$providerId');
  }
}
