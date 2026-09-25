class TelemetryStats {
  const TelemetryStats({
    this.piiMasked = 0,
    this.bankingIsolated = 0,
    this.deepfakesFlagged = 0,
    this.averageLatencyMs = 0,
    this.probeCount = 0,
  });

  final int piiMasked;
  final int bankingIsolated;
  final int deepfakesFlagged;
  final double averageLatencyMs;
  final int probeCount;

  TelemetryStats copyWith({
    int? piiMasked,
    int? bankingIsolated,
    int? deepfakesFlagged,
    double? averageLatencyMs,
    int? probeCount,
  }) {
    return TelemetryStats(
      piiMasked: piiMasked ?? this.piiMasked,
      bankingIsolated: bankingIsolated ?? this.bankingIsolated,
      deepfakesFlagged: deepfakesFlagged ?? this.deepfakesFlagged,
      averageLatencyMs: averageLatencyMs ?? this.averageLatencyMs,
      probeCount: probeCount ?? this.probeCount,
    );
  }

  TelemetryStats recordLatency(int latencyMs) {
    final nextCount = probeCount + 1;
    final nextAvg =
        ((averageLatencyMs * probeCount) + latencyMs) / nextCount;
    return copyWith(
      averageLatencyMs: nextAvg,
      probeCount: nextCount,
    );
  }
}
