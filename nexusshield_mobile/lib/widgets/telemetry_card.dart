import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

class TelemetryCard extends StatefulWidget {
  const TelemetryCard({
    super.key,
    required this.emoji,
    required this.title,
    required this.value,
    required this.accent,
    required this.pulse,
    this.subtitle,
    this.badge,
  });

  final String emoji;
  final String title;
  final String value;
  final String? subtitle;
  final String? badge;
  final Color accent;
  final bool pulse;

  @override
  State<TelemetryCard> createState() => _TelemetryCardState();
}

class _TelemetryCardState extends State<TelemetryCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _syncPulse();
  }

  @override
  void didUpdateWidget(covariant TelemetryCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncPulse();
  }

  void _syncPulse() {
    if (widget.pulse) {
      if (!_controller.isAnimating) _controller.repeat(reverse: true);
    } else {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final glow = widget.pulse ? 0.12 + (_controller.value * 0.18) : 0.0;
        return CyberCard(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          borderColor: widget.accent,
          borderOpacity: widget.pulse ? 0.28 : 0.12,
          glowColor: widget.accent,
          glowStrength: glow,
          child: child!,
        );
      },
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(widget.emoji, style: const TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  widget.title,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.25,
                  ),
                ),
              ),
              if (widget.badge != null)
                Container(
                  margin: const EdgeInsets.only(left: 6),
                  padding:
                      const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
                  decoration: BoxDecoration(
                    color: NexusBrand.neonGreen.withValues(alpha: 0.18),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    widget.badge!,
                    style: const TextStyle(
                      color: NexusBrand.neonGreen,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          FittedBox(
            fit: BoxFit.scaleDown,
            alignment: Alignment.centerLeft,
            child: Text(
              widget.value,
              maxLines: 1,
              style: TextStyle(
                fontSize: 26,
                fontWeight: FontWeight.w800,
                color: widget.accent,
                letterSpacing: -0.5,
              ),
            ),
          ),
          if (widget.subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              widget.subtitle!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: NexusBrand.muted,
                fontSize: 11,
                height: 1.2,
              ),
            ),
          ],
        ],
      ),
    );
  }
}
