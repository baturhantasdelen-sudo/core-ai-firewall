import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../domain/models/protection_score.dart';
import '../../../theme/app_theme.dart';

class ProtectionScoreRing extends StatelessWidget {
  const ProtectionScoreRing({
    super.key,
    required this.score,
    required this.onTap,
    this.busy = false,
  });

  final ProtectionScore score;
  final VoidCallback onTap;
  final bool busy;

  Color get _accent => switch (score.level) {
        RiskLevel.secure => NexusBrand.neonGreen,
        RiskLevel.warning => NexusBrand.amber,
        RiskLevel.critical => NexusBrand.alertRed,
      };

  @override
  Widget build(BuildContext context) {
    final shortest = MediaQuery.of(context).size.shortestSide;
    final diameter = (shortest * 0.48).clamp(180.0, 240.0);
    final progress = score.score / 100.0;

    return Semantics(
      button: true,
      label: 'Koruma skoru ${score.score}, ${score.headline}',
      child: GestureDetector(
        onTap: busy ? null : onTap,
        child: SizedBox(
          width: diameter,
          height: diameter,
          child: Stack(
            alignment: Alignment.center,
            children: [
              CustomPaint(
                size: Size.square(diameter),
                painter: _RingPainter(
                  progress: progress,
                  accent: _accent,
                  trackColor: Colors.white.withValues(alpha: 0.08),
                ),
              ),
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (busy)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 8),
                      child: SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: _accent.withValues(alpha: 0.9),
                        ),
                      ),
                    ),
                  Text(
                    '${score.score}',
                    style: TextStyle(
                      fontSize: 52,
                      fontWeight: FontWeight.w700,
                      color: _accent,
                      height: 1,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    score.headline,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Koruma skoru',
                    style: TextStyle(
                      fontSize: 12,
                      color: NexusBrand.muted,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  _RingPainter({
    required this.progress,
    required this.accent,
    required this.trackColor,
  });

  final double progress;
  final Color accent;
  final Color trackColor;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = size.width / 2 - 10;
    const stroke = 12.0;

    final track = Paint()
      ..color = trackColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    final arc = Paint()
      ..shader = SweepGradient(
        colors: [accent.withValues(alpha: 0.35), accent],
      ).createShader(Rect.fromCircle(center: center, radius: radius))
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, track);
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      2 * math.pi * progress.clamp(0.0, 1.0),
      false,
      arc,
    );
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.accent != accent;
  }
}
