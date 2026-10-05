enum WifiEncryptionClass {
  wpa3,
  wpa2,
  wpa,
  open,
  unknown;

  static WifiEncryptionClass fromNative(String? raw) {
    final v = (raw ?? '').toUpperCase();
    if (v.contains('WPA3')) return WifiEncryptionClass.wpa3;
    if (v.contains('WPA2')) return WifiEncryptionClass.wpa2;
    if (v.contains('WPA')) return WifiEncryptionClass.wpa;
    if (v.contains('OPEN') || v.contains('NONE')) return WifiEncryptionClass.open;
    return WifiEncryptionClass.unknown;
  }

  String get label => switch (this) {
        WifiEncryptionClass.wpa3 => 'WPA3',
        WifiEncryptionClass.wpa2 => 'WPA2',
        WifiEncryptionClass.wpa => 'WPA',
        WifiEncryptionClass.open => 'Açık ağ',
        WifiEncryptionClass.unknown => 'Bilinmiyor',
      };
}

class WifiSecurityReport {
  const WifiSecurityReport({
    required this.connected,
    required this.ssid,
    required this.encryption,
    required this.isCaptivePortalSuspect,
    required this.isDnsHijackSuspect,
    required this.isArpPoisonSuspect,
    required this.recommendVpnTunnel,
    required this.detail,
  });

  final bool connected;
  final String ssid;
  final WifiEncryptionClass encryption;
  final bool isCaptivePortalSuspect;
  final bool isDnsHijackSuspect;
  final bool isArpPoisonSuspect;
  final bool recommendVpnTunnel;
  final String detail;

  bool get isUrgent =>
      encryption == WifiEncryptionClass.open ||
      isDnsHijackSuspect ||
      isArpPoisonSuspect;

  factory WifiSecurityReport.fromMap(Map<String, dynamic> map) {
    return WifiSecurityReport(
      connected: map['connected'] == true,
      ssid: '${map['ssid'] ?? '—'}',
      encryption: WifiEncryptionClass.fromNative(map['encryption'] as String?),
      isCaptivePortalSuspect: map['captivePortalSuspect'] == true,
      isDnsHijackSuspect: map['dnsHijackSuspect'] == true,
      isArpPoisonSuspect: map['arpPoisonSuspect'] == true,
      recommendVpnTunnel: map['recommendVpnTunnel'] == true,
      detail: '${map['detail'] ?? ''}',
    );
  }

  factory WifiSecurityReport.disconnected() {
    return const WifiSecurityReport(
      connected: false,
      ssid: '—',
      encryption: WifiEncryptionClass.unknown,
      isCaptivePortalSuspect: false,
      isDnsHijackSuspect: false,
      isArpPoisonSuspect: false,
      recommendVpnTunnel: false,
      detail: 'Wi‑Fi veya hücresel bağlantı yok',
    );
  }
}
