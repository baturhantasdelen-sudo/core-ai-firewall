enum AiSensitiveScope {
  clipboard,
  contacts,
  photos,
  microphone;

  String get id => name;

  String get labelTr => switch (this) {
        AiSensitiveScope.clipboard => 'Pano (clipboard)',
        AiSensitiveScope.contacts => 'Rehber',
        AiSensitiveScope.photos => 'Fotoğraflar / medya',
        AiSensitiveScope.microphone => 'Mikrofon',
      };
}

class AiConsentGrant {
  const AiConsentGrant({
    required this.providerId,
    required this.scopes,
    required this.grantedAt,
    required this.expiresAt,
    required this.consentTokenHint,
  });

  final String providerId;
  final Set<AiSensitiveScope> scopes;
  final DateTime grantedAt;
  final DateTime expiresAt;

  /// Opaque handle — full token stored in secure storage only.
  final String consentTokenHint;

  bool get isValid => DateTime.now().isBefore(expiresAt);

  Map<String, dynamic> toJson() => {
        'providerId': providerId,
        'scopes': scopes.map((s) => s.name).toList(),
        'grantedAt': grantedAt.toIso8601String(),
        'expiresAt': expiresAt.toIso8601String(),
        'consentTokenHint': consentTokenHint,
      };

  factory AiConsentGrant.fromJson(Map<String, dynamic> json) {
    final scopeNames = <AiSensitiveScope>{};
    for (final raw in json['scopes'] as List<dynamic>? ?? const []) {
      final name = '$raw';
      for (final scope in AiSensitiveScope.values) {
        if (scope.name == name) scopeNames.add(scope);
      }
    }
    return AiConsentGrant(
      providerId: '${json['providerId']}',
      scopes: scopeNames,
      grantedAt: DateTime.parse('${json['grantedAt']}'),
      expiresAt: DateTime.parse('${json['expiresAt']}'),
      consentTokenHint: '${json['consentTokenHint']}',
    );
  }
}
