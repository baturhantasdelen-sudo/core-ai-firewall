enum VaultConnectionStatus {
  notConfigured,
  formatValid,
  formatInvalid,
  testPassed,
  testFailed,
}

class VaultConnectionService {
  static VaultConnectionStatus validateKeyFormat(String provider, String key) {
    if (key.trim().isEmpty) {
      return VaultConnectionStatus.notConfigured;
    }
    switch (provider) {
      case 'openai':
        return key.startsWith('sk-')
            ? VaultConnectionStatus.formatValid
            : VaultConnectionStatus.formatInvalid;
      case 'anthropic':
        return key.startsWith('sk-ant-')
            ? VaultConnectionStatus.formatValid
            : VaultConnectionStatus.formatInvalid;
      case 'gemini':
        return key.length >= 20
            ? VaultConnectionStatus.formatValid
            : VaultConnectionStatus.formatInvalid;
      default:
        return VaultConnectionStatus.formatInvalid;
    }
  }

  /// Lightweight offline handshake simulation (no network call).
  Future<VaultConnectionStatus> testConnection(String provider, String key) async {
    await Future<void>.delayed(const Duration(milliseconds: 450));
    final format = validateKeyFormat(provider, key);
    if (format != VaultConnectionStatus.formatValid) {
      return format;
    }
    return VaultConnectionStatus.testPassed;
  }

  static String statusLabel(VaultConnectionStatus status) {
    switch (status) {
      case VaultConnectionStatus.notConfigured:
        return 'Not configured';
      case VaultConnectionStatus.formatValid:
        return 'Format OK';
      case VaultConnectionStatus.formatInvalid:
        return 'Invalid format';
      case VaultConnectionStatus.testPassed:
        return 'Test passed';
      case VaultConnectionStatus.testFailed:
        return 'Test failed';
    }
  }
}
