import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'nexus_logo.dart';

class ShieldButton extends StatelessWidget {
  const ShieldButton({
    super.key,
    required this.active,
    required this.onPressed,
    this.latencyMs,
  });

  final bool active;
  final VoidCallback onPressed;
  final int? latencyMs;

  @override
  Widget build(BuildContext context) {
    final shortest = MediaQuery.of(context).size.shortestSide;
    final diameter = (shortest * 0.52).clamp(168.0, 220.0);
    final accent = active ? const Color(0xFFCBD5E1) : NexusBrand.muted;
    final label = active ? 'SHIELD ACTIVE' : 'SHIELD INACTIVE';

    return Column(
      children: [
        GestureDetector(
          onTap: onPressed,
          child: Container(
            width: diameter,
            height: diameter,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: NexusBrand.glassPanel.withValues(alpha: 0.45),
              border: Border.all(
                color: Colors.white.withValues(alpha: active ? 0.22 : 0.12),
                width: 1,
              ),
            ),
            clipBehavior: Clip.antiAlias,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 20, 22, 14),
              child: Column(
                children: [
                  const Expanded(
                    child: NexusLogo(
                      size: 96,
                      variant: NexusLogoVariant.emblem,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    label,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: accent,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.1,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (latencyMs != null) ...[
          const SizedBox(height: 12),
          Text(
            'Local proxy filter: $latencyMs ms avg',
            style: TextStyle(
              color: latencyMs! < 12 ? NexusBrand.neonGreen : NexusBrand.cyberCyan,
              fontSize: 12,
            ),
          ),
        ],
      ],
    );
  }
}
