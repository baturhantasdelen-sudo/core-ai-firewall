import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:local_auth/local_auth.dart';

/// Hardware-backed BYOK vault (EncryptedSharedPreferences / Keychain + biometrics).
class VaultService {
  VaultService({
    FlutterSecureStorage? storage,
    LocalAuthentication? localAuth,
  })  : _storage = storage ?? _defaultStorage,
        _localAuth = localAuth ?? LocalAuthentication();

  static final _defaultStorage = FlutterSecureStorage(
    aOptions: AndroidOptions.biometric(
      enforceBiometrics: false,
      requireBiometricsPerOperation: true,
      biometricPromptTitle: 'NexusShield Vault',
    ),
    iOptions: const IOSOptions(
      accountName: 'nexusshield_byok_vault',
      accessibility: KeychainAccessibility.passcode,
      accessControlFlags: [AccessControlFlag.biometryAny],
      useSecureEnclave: true,
      synchronizable: false,
    ),
  );

  final FlutterSecureStorage _storage;
  final LocalAuthentication _localAuth;

  String _keyForProvider(String provider) => 'nexusshield.api.$provider';

  Future<bool> _ensureBiometricGate() async {
    final canCheck = await _localAuth.canCheckBiometrics;
    final supported = await _localAuth.isDeviceSupported();
    if (!canCheck && !supported) {
      return true;
    }
    return _localAuth.authenticate(
      localizedReason: 'Unlock NexusShield BYOK Vault',
    );
  }

  Future<void> saveApiKey(String provider, String key) async {
    final ok = await _ensureBiometricGate();
    if (!ok) {
      throw StateError('Biometric authentication required to save API keys.');
    }
    await _storage.write(key: _keyForProvider(provider), value: key);
  }

  Future<String?> getApiKey(String provider) async {
    final ok = await _ensureBiometricGate();
    if (!ok) {
      return null;
    }
    return _storage.read(key: _keyForProvider(provider));
  }

  Future<void> deleteApiKey(String provider) async {
    final ok = await _ensureBiometricGate();
    if (!ok) {
      throw StateError('Biometric authentication required to delete API keys.');
    }
    await _storage.delete(key: _keyForProvider(provider));
  }

  Future<List<String>> listConfiguredProviders() async {
    final all = await _storage.readAll();
    const prefix = 'nexusshield.api.';
    return all.keys
        .where((k) => k.startsWith(prefix))
        .map((k) => k.substring(prefix.length))
        .toList()
      ..sort();
  }
}
