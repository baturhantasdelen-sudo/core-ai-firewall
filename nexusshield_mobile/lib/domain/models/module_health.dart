import 'protection_score.dart';

/// Per-module health snapshot returned by [SecurityModule.evaluate].
class ModuleHealth {
  const ModuleHealth({
    required this.moduleId,
    required this.title,
    required this.riskLevel,
    required this.score,
    required this.statusLabel,
    required this.detail,
  });

  final String moduleId;
  final String title;
  final RiskLevel riskLevel;

  /// 0–100 for this module (feeds aggregate [ProtectionScore]).
  final int score;
  final String statusLabel;
  final String detail;
}
