/// Sensitive foreground targets monitored by Banking Guard.
enum SensitiveAppCategory {
  banking,
  cryptoWallet,
  smsMessaging,
}

class SensitiveAppTarget {
  const SensitiveAppTarget({
    required this.packageId,
    required this.displayName,
    required this.category,
  });

  final String packageId;
  final String displayName;
  final SensitiveAppCategory category;
}

class IsolationRule {
  const IsolationRule({
    required this.id,
    required this.description,
    required this.enabled,
  });

  final String id;
  final String description;
  final bool enabled;
}

class ActionFirewallDecision {
  const ActionFirewallDecision({
    required this.blockClipboard,
    required this.blockOtpLeak,
    required this.blockPromptInjection,
    required this.reasons,
  });

  final bool blockClipboard;
  final bool blockOtpLeak;
  final bool blockPromptInjection;
  final List<String> reasons;
}

/// Action firewall + banking guard rule engine (Dart-side orchestration).
class ActionFirewall {
  ActionFirewall._();

  static final ActionFirewall instance = ActionFirewall._();

  static const sensitiveTargets = <SensitiveAppTarget>[
    SensitiveAppTarget(
      packageId: 'com.chase.sig.android',
      displayName: 'Chase Mobile',
      category: SensitiveAppCategory.banking,
    ),
    SensitiveAppTarget(
      packageId: 'com.coinbase.android',
      displayName: 'Coinbase',
      category: SensitiveAppCategory.cryptoWallet,
    ),
    SensitiveAppTarget(
      packageId: 'com.google.android.apps.messaging',
      displayName: 'Google Messages',
      category: SensitiveAppCategory.smsMessaging,
    ),
    SensitiveAppTarget(
      packageId: 'com.whatsapp',
      displayName: 'WhatsApp',
      category: SensitiveAppCategory.smsMessaging,
    ),
  ];

  static const isolationRules = <IsolationRule>[
    IsolationRule(
      id: 'clipboard_block',
      description: 'Block clipboard access while banking/crypto app is focused',
      enabled: true,
    ),
    IsolationRule(
      id: 'otp_node_scrub',
      description: 'Prevent accessibility OTP nodes from reaching LLM inputs',
      enabled: true,
    ),
    IsolationRule(
      id: 'prompt_injection_filter',
      description: 'Intercept indirect prompt injection transaction commands',
      enabled: true,
    ),
  ];

  static final _injectionPatterns = [
    RegExp(r'ignore (all )?previous instructions', caseSensitive: false),
    RegExp(r'transfer\s+\$?\d+', caseSensitive: false),
    RegExp(r'send (all )?funds to', caseSensitive: false),
    RegExp(r'approve wire (transfer|payment)', caseSensitive: false),
    RegExp(r'execute (crypto )?transaction', caseSensitive: false),
  ];

  static final _otpPattern = RegExp(r'\b\d{4,8}\b');

  SensitiveAppTarget? matchTarget(String? packageId) {
    if (packageId == null || packageId.isEmpty) return null;
    for (final target in sensitiveTargets) {
      if (packageId == target.packageId) return target;
    }
    return null;
  }

  ActionFirewallDecision evaluate({
    required String? foregroundPackageId,
    required String inboundText,
    required bool bankingGuardEnabled,
  }) {
    if (!bankingGuardEnabled) {
      return const ActionFirewallDecision(
        blockClipboard: false,
        blockOtpLeak: false,
        blockPromptInjection: false,
        reasons: [],
      );
    }

    final target = matchTarget(foregroundPackageId);
    final reasons = <String>[];
    var blockClipboard = false;
    var blockOtpLeak = false;
    var blockPromptInjection = false;

    if (target != null) {
      blockClipboard = true;
      reasons.add('Clipboard isolated for ${target.displayName}');
      if (target.category == SensitiveAppCategory.smsMessaging &&
          _otpPattern.hasMatch(inboundText)) {
        blockOtpLeak = true;
        reasons.add('OTP surface detected in SMS/messaging context');
      }
    }

    for (final pattern in _injectionPatterns) {
      if (pattern.hasMatch(inboundText)) {
        blockPromptInjection = true;
        reasons.add('Indirect prompt injection pattern blocked');
        break;
      }
    }

    return ActionFirewallDecision(
      blockClipboard: blockClipboard,
      blockOtpLeak: blockOtpLeak,
      blockPromptInjection: blockPromptInjection,
      reasons: reasons,
    );
  }

  String filterPromptInjection(String input) {
    var out = input;
    for (final pattern in _injectionPatterns) {
      out = out.replaceAll(pattern, '[BLOCKED_INJECTION]');
    }
    return out;
  }

  /// Simulates rotating foreground app focus for telemetry demos.
  String? simulatedForegroundPackage({required int tick}) {
    if (sensitiveTargets.isEmpty) return null;
    return sensitiveTargets[tick % sensitiveTargets.length].packageId;
  }
}
