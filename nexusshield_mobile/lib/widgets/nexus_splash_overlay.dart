import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'nexus_logo.dart';

class NexusSplashOverlay extends StatefulWidget {
  const NexusSplashOverlay({
    super.key,
    required this.child,
    this.duration = const Duration(milliseconds: 1400),
  });

  final Widget child;
  final Duration duration;

  @override
  State<NexusSplashOverlay> createState() => _NexusSplashOverlayState();
}

class _NexusSplashOverlayState extends State<NexusSplashOverlay> {
  bool _showSplash = true;

  @override
  void initState() {
    super.initState();
    Future<void>.delayed(widget.duration, () {
      if (mounted) setState(() => _showSplash = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;

    return Stack(
      fit: StackFit.expand,
      children: [
        widget.child,
        if (_showSplash)
          AnimatedOpacity(
            opacity: _showSplash ? 1 : 0,
            duration: const Duration(milliseconds: 350),
            child: Container(
              color: NexusBrand.deepSlate,
              alignment: Alignment.center,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: NexusLogo(
                      size: 112,
                      maxWidth: width * 0.86,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Personal AI Guard',
                    style: TextStyle(color: NexusBrand.muted.withValues(alpha: 0.9)),
                  ),
                  const SizedBox(height: 24),
                  const SizedBox(
                    width: 28,
                    height: 28,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.5,
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }
}
