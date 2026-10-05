enum SensitivePermissionKind {
  camera,
  microphone,
  contacts,
  location,
  unknown;

  static SensitivePermissionKind fromNative(String raw) {
    return switch (raw.toLowerCase()) {
      'camera' => SensitivePermissionKind.camera,
      'microphone' => SensitivePermissionKind.microphone,
      'contacts' => SensitivePermissionKind.contacts,
      'location' => SensitivePermissionKind.location,
      _ => SensitivePermissionKind.unknown,
    };
  }

  String get labelTr => switch (this) {
        SensitivePermissionKind.camera => 'Kamera',
        SensitivePermissionKind.microphone => 'Mikrofon',
        SensitivePermissionKind.contacts => 'Rehber',
        SensitivePermissionKind.location => 'Konum',
        SensitivePermissionKind.unknown => 'Diğer',
      };
}

enum AppPermissionRiskTier {
  low,
  medium,
  high;

  static AppPermissionRiskTier fromNative(String raw) {
    return switch (raw.toLowerCase()) {
      'high' => AppPermissionRiskTier.high,
      'medium' => AppPermissionRiskTier.medium,
      _ => AppPermissionRiskTier.low,
    };
  }
}

class AppPermissionReport {
  const AppPermissionReport({
    required this.packageId,
    required this.displayName,
    required this.permissions,
    required this.riskTier,
  });

  final String packageId;
  final String displayName;
  final List<SensitivePermissionKind> permissions;
  final AppPermissionRiskTier riskTier;

  bool get isRisky =>
      riskTier == AppPermissionRiskTier.high ||
      riskTier == AppPermissionRiskTier.medium;

  factory AppPermissionReport.fromMap(Map<String, dynamic> map) {
    final permsRaw = map['permissions'] as List<dynamic>? ?? const [];
    final perms = permsRaw
        .map((e) => SensitivePermissionKind.fromNative('$e'))
        .where((p) => p != SensitivePermissionKind.unknown)
        .toList(growable: false);
    return AppPermissionReport(
      packageId: '${map['packageId'] ?? ''}',
      displayName: '${map['displayName'] ?? map['packageId'] ?? 'App'}',
      permissions: perms,
      riskTier: AppPermissionRiskTier.fromNative('${map['risk'] ?? 'low'}'),
    );
  }
}
