class DeepfakeAnalysis {
  const DeepfakeAnalysis({
    required this.confidenceScore,
    required this.isSynthetic,
    required this.detectionReasons,
  });

  final double confidenceScore;
  final bool isSynthetic;
  final List<String> detectionReasons;

  factory DeepfakeAnalysis.fromMap(Map<String, dynamic> map) {
    return DeepfakeAnalysis(
      confidenceScore: (map['confidenceScore'] as num).toDouble(),
      isSynthetic: map['isSynthetic'] as bool,
      detectionReasons: List<String>.from(map['detectionReasons'] as List),
    );
  }
}
