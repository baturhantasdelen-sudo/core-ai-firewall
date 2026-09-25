import 'package:flutter/material.dart';

import '../theme/app_theme.dart';

enum NexusLogoVariant {
  /// Shield + NEXUS SHIELD + AI • API • SEC
  lockup,

  /// Shield emblem only — for circular controls.
  emblem,
}

/// Transparent lockup scaled to the device shortest side.
class NexusLogo extends StatelessWidget {
  const NexusLogo({
    super.key,
    this.size = 40,
    this.maxWidth,
    this.variant = NexusLogoVariant.lockup,
    this.showFallbackIcon = true,
  });

  /// Design height at a 390pt shortest side.
  final double size;
  final double? maxWidth;
  final NexusLogoVariant variant;
  final bool showFallbackIcon;

  static const lockupAspect = 698 / 606;

  @override
  Widget build(BuildContext context) {
    final shortest = MediaQuery.of(context).size.shortestSide;
    final height = (size * (shortest / 390.0)).clamp(size * 0.72, size * 1.4);
    final cap = maxWidth ?? MediaQuery.sizeOf(context).width * 0.92;

    if (variant == NexusLogoVariant.emblem) {
      final side = height.clamp(24.0, cap);
      return SizedBox(
        width: side,
        height: side,
        child: ClipRect(
          child: Align(
            alignment: Alignment.topCenter,
            heightFactor: 0.68,
            child: _asset(
              width: side,
              height: side / 0.68,
            ),
          ),
        ),
      );
    }

    var width = height * lockupAspect;
    if (width > cap) {
      width = cap;
    }
    final resolvedHeight = width / lockupAspect;
    return _asset(width: width, height: resolvedHeight);
  }

  Widget _asset({required double width, required double height}) {
    return Image.asset(
      NexusBrand.logoAsset,
      width: width,
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.high,
      isAntiAlias: true,
      gaplessPlayback: true,
      errorBuilder: (context, error, stackTrace) {
        if (!showFallbackIcon) {
          return SizedBox(width: width, height: height);
        }
        return Icon(
          Icons.shield,
          size: height * 0.85,
          color: Colors.white70,
        );
      },
    );
  }
}
