import 'package:flutter/material.dart';

import 'app_theme.dart';

export 'app_theme.dart';

/// Legacy aliases — prefer [NexusBrand] from `app_theme.dart`.
abstract final class NexusColors {
  static const deepSlate = Color(0xFF0B1220);
  static const panel = Color(0xFF1E293B);
  static const neonGreen = Color(0xFF00FF9D);
  static const cyan = Color(0xFF00F0FF);
  static const muted = Color(0xFF94A3B8);
  static const danger = Color(0xFFFF3B30);
  static const amber = Color(0xFFFFB800);
}

ThemeData buildNexusTheme() => buildAppTheme();
