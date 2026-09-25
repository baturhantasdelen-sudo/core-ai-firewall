import 'package:flutter/material.dart';

import '../theme/app_theme.dart';
import 'nexus_logo.dart';

class NexusScreenHeader extends StatelessWidget {
  const NexusScreenHeader({
    super.key,
    required this.title,
    this.subtitle,
  });

  final String title;
  final String? subtitle;

  @override
  Widget build(BuildContext context) {
    final maxLogoWidth = MediaQuery.sizeOf(context).width - 48;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        NexusLogo(size: 52, maxWidth: maxLogoWidth.clamp(160.0, 420.0)),
        const SizedBox(height: 14),
        Text(
          title,
          style: Theme.of(context).textTheme.titleLarge?.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
        ),
        if (subtitle != null) ...[
          const SizedBox(height: 4),
          Text(
            subtitle!,
            style: const TextStyle(
              color: NexusBrand.muted,
              height: 1.35,
            ),
          ),
        ],
      ],
    );
  }
}
