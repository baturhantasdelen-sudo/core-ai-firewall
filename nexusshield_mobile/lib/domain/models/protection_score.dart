/// Aggregate device protection posture derived from [ModuleHealth] evaluations.
class ProtectionScore {
  const ProtectionScore({
    required this.score,
    required this.level,
    required this.headline,
    required this.evaluatedAt,
  });

  /// 0–100 composite protection index.
  final int score;

  final RiskLevel level;

  /// Short status for the score ring (e.g. "Güvende").
  final String headline;

  final DateTime evaluatedAt;

  static ProtectionScore fromModuleScores({
    required List<int> moduleScores,
    required DateTime evaluatedAt,
  }) {
    if (moduleScores.isEmpty) {
      return ProtectionScore(
        score: 0,
        level: RiskLevel.critical,
        headline: RiskLevel.critical.labelTr,
        evaluatedAt: evaluatedAt,
      );
    }
    final avg =
        moduleScores.reduce((a, b) => a + b) ~/ moduleScores.length;
    final level = RiskLevel.fromScore(avg);
    return ProtectionScore(
      score: avg.clamp(0, 100),
      level: level,
      headline: level.labelTr,
      evaluatedAt: evaluatedAt,
    );
  }
}

enum RiskLevel {
  secure,
  warning,
  critical;

  static RiskLevel fromScore(int score) {
    if (score >= 80) return RiskLevel.secure;
    if (score >= 50) return RiskLevel.warning;
    return RiskLevel.critical;
  }

  String get labelTr => switch (this) {
        RiskLevel.secure => 'Güvende',
        RiskLevel.warning => 'Dikkat',
        RiskLevel.critical => 'Risk altında',
      };
}
