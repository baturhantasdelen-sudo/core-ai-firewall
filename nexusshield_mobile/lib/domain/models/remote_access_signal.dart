class RemoteAccessSignalReport {
  const RemoteAccessSignalReport({
    required this.screenCaptureActive,
    required this.suspiciousAccessibilityCount,
    required this.overlayAppsCount,
    required this.detail,
  });

  final bool screenCaptureActive;
  final int suspiciousAccessibilityCount;
  final int overlayAppsCount;
  final String detail;

  bool get isThreat =>
      screenCaptureActive ||
      suspiciousAccessibilityCount > 0 ||
      overlayAppsCount > 2;

  factory RemoteAccessSignalReport.fromMap(Map<String, dynamic> map) {
    return RemoteAccessSignalReport(
      screenCaptureActive: map['screenCaptureActive'] == true,
      suspiciousAccessibilityCount:
          (map['suspiciousAccessibilityCount'] as num?)?.toInt() ?? 0,
      overlayAppsCount: (map['overlayAppsCount'] as num?)?.toInt() ?? 0,
      detail: '${map['detail'] ?? ''}',
    );
  }
}
