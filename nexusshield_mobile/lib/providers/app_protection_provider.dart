import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

enum AppProtectionCategory {
  banking,
  aiClient,
  messaging,
  system,
}

class AppProtectionProfile {
  const AppProtectionProfile({
    required this.packageId,
    required this.displayName,
    required this.category,
    required this.icon,
    required this.recommended,
    this.piiFirewall = false,
    this.clipboardShield = false,
    this.promptInjectionGuard = false,
  });

  final String packageId;
  final String displayName;
  final AppProtectionCategory category;
  final IconData icon;
  final bool recommended;
  final bool piiFirewall;
  final bool clipboardShield;
  final bool promptInjectionGuard;

  AppProtectionProfile copyWith({
    bool? piiFirewall,
    bool? clipboardShield,
    bool? promptInjectionGuard,
  }) {
    return AppProtectionProfile(
      packageId: packageId,
      displayName: displayName,
      category: category,
      icon: icon,
      recommended: recommended,
      piiFirewall: piiFirewall ?? this.piiFirewall,
      clipboardShield: clipboardShield ?? this.clipboardShield,
      promptInjectionGuard: promptInjectionGuard ?? this.promptInjectionGuard,
    );
  }
}

List<AppProtectionProfile> _smartDefaults() {
  AppProtectionProfile app({
    required String packageId,
    required String displayName,
    required AppProtectionCategory category,
    required IconData icon,
    required bool recommended,
    bool pii = false,
    bool clip = false,
    bool inject = false,
  }) {
    return AppProtectionProfile(
      packageId: packageId,
      displayName: displayName,
      category: category,
      icon: icon,
      recommended: recommended,
      piiFirewall: pii,
      clipboardShield: clip,
      promptInjectionGuard: inject,
    );
  }

  return [
    app(
      packageId: 'com.bybit.app',
      displayName: 'Bybit',
      category: AppProtectionCategory.banking,
      icon: Icons.currency_bitcoin,
      recommended: true,
      pii: true,
      clip: true,
      inject: true,
    ),
    app(
      packageId: 'com.garanti.cepsubesi',
      displayName: 'Garanti BBVA',
      category: AppProtectionCategory.banking,
      icon: Icons.account_balance,
      recommended: true,
      pii: true,
      clip: true,
      inject: true,
    ),
    app(
      packageId: 'com.isbank.mobile',
      displayName: 'İşbank',
      category: AppProtectionCategory.banking,
      icon: Icons.account_balance_wallet,
      recommended: true,
      pii: true,
      clip: true,
      inject: true,
    ),
    app(
      packageId: 'com.openai.chatgpt',
      displayName: 'ChatGPT',
      category: AppProtectionCategory.aiClient,
      icon: Icons.smart_toy_outlined,
      recommended: true,
      pii: true,
      clip: false,
      inject: true,
    ),
    app(
      packageId: 'com.anthropic.claude',
      displayName: 'Claude',
      category: AppProtectionCategory.aiClient,
      icon: Icons.psychology_outlined,
      recommended: true,
      pii: true,
      clip: false,
      inject: true,
    ),
    app(
      packageId: 'com.whatsapp',
      displayName: 'WhatsApp',
      category: AppProtectionCategory.messaging,
      icon: Icons.chat_outlined,
      recommended: true,
      pii: true,
      clip: true,
      inject: true,
    ),
    app(
      packageId: 'org.telegram.messenger',
      displayName: 'Telegram',
      category: AppProtectionCategory.messaging,
      icon: Icons.send_outlined,
      recommended: true,
      pii: true,
      clip: true,
      inject: true,
    ),
    app(
      packageId: 'com.android.settings',
      displayName: 'System Settings',
      category: AppProtectionCategory.system,
      icon: Icons.settings_applications_outlined,
      recommended: false,
    ),
    app(
      packageId: 'com.google.android.gms',
      displayName: 'Google Play Services',
      category: AppProtectionCategory.system,
      icon: Icons.apps_outlined,
      recommended: false,
    ),
    app(
      packageId: 'com.android.chrome',
      displayName: 'Chrome',
      category: AppProtectionCategory.system,
      icon: Icons.language_outlined,
      recommended: false,
      pii: true,
      inject: true,
    ),
  ];
}

class AppProtectionController extends Notifier<List<AppProtectionProfile>> {
  @override
  List<AppProtectionProfile> build() => _smartDefaults();

  void _update(String packageId, AppProtectionProfile Function(AppProtectionProfile) fn) {
    state = [
      for (final app in state)
        if (app.packageId == packageId) fn(app) else app,
    ];
  }

  void setPiiFirewall(String packageId, bool value) =>
      _update(packageId, (a) => a.copyWith(piiFirewall: value));

  void setClipboardShield(String packageId, bool value) =>
      _update(packageId, (a) => a.copyWith(clipboardShield: value));

  void setPromptInjectionGuard(String packageId, bool value) =>
      _update(packageId, (a) => a.copyWith(promptInjectionGuard: value));

  void protectAllFinancialApps() {
    state = [
      for (final app in state)
        _isFinancial(app)
            ? app.copyWith(
                piiFirewall: true,
                clipboardShield: true,
                promptInjectionGuard: true,
              )
            : app,
    ];
  }

  void protectAllMessagingApps() {
    state = [
      for (final app in state)
        app.category == AppProtectionCategory.messaging
            ? app.copyWith(
                piiFirewall: true,
                clipboardShield: true,
                promptInjectionGuard: true,
              )
            : app,
    ];
  }

  void resetSmartDefaults() {
    state = _smartDefaults();
  }

  bool _isFinancial(AppProtectionProfile app) {
    return app.category == AppProtectionCategory.banking;
  }
}

final appProtectionProvider =
    NotifierProvider<AppProtectionController, List<AppProtectionProfile>>(
  AppProtectionController.new,
);

String categoryLabel(AppProtectionCategory category) {
  switch (category) {
    case AppProtectionCategory.banking:
      return 'Banking / Crypto';
    case AppProtectionCategory.aiClient:
      return 'AI Client';
    case AppProtectionCategory.messaging:
      return 'Messaging';
    case AppProtectionCategory.system:
      return 'System';
  }
}
