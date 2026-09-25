import 'package:flutter/material.dart';

/// NexusShield design tokens — single source of truth for UI/UX consistency.
abstract final class NexusBrand {
  static const logoAsset = 'assets/images/nexusshield-logo.png';

  static const deepSlate = Color(0xFF0B1220);
  static const glassPanel = Color(0xFF1E293B);
  static const glassPanelOpacity = 0.92;

  static const neonGreen = Color(0xFF00FF9D);
  static const cyberCyan = Color(0xFF00F0FF);
  static const amber = Color(0xFFFFB800);
  static const alertRed = Color(0xFFFF3B30);
  static const muted = Color(0xFF94A3B8);

  static const cardRadius = 16.0;
  static Border cyberBorder({double opacity = 0.12, double width = 1}) =>
      Border.all(color: cyberCyan.withValues(alpha: opacity), width: width);
}

ThemeData buildAppTheme() {
  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: NexusBrand.deepSlate,
    colorScheme: ColorScheme.fromSeed(
      seedColor: NexusBrand.neonGreen,
      brightness: Brightness.dark,
      primary: NexusBrand.neonGreen,
      secondary: NexusBrand.cyberCyan,
      surface: NexusBrand.glassPanel,
      error: NexusBrand.alertRed,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: NexusBrand.deepSlate,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: Colors.transparent,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(NexusBrand.cardRadius),
      ),
    ),
    textTheme: const TextTheme(
      bodyLarge: TextStyle(color: Colors.white, height: 1.4),
      bodyMedium: TextStyle(color: Colors.white, height: 1.4),
      titleLarge: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: const Color(0xFF1A2438),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      labelStyle: const TextStyle(color: NexusBrand.muted),
      hintStyle: const TextStyle(color: NexusBrand.muted),
    ),
    switchTheme: SwitchThemeData(
      thumbColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? NexusBrand.neonGreen
            : NexusBrand.muted,
      ),
      trackColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? NexusBrand.neonGreen.withValues(alpha: 0.35)
            : const Color(0xFF334155),
      ),
      trackOutlineColor: WidgetStateProperty.resolveWith(
        (states) => states.contains(WidgetState.selected)
            ? NexusBrand.cyberCyan.withValues(alpha: 0.35)
            : NexusBrand.muted.withValues(alpha: 0.4),
      ),
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: NexusBrand.glassPanel.withValues(alpha: 0.95),
      indicatorColor: NexusBrand.neonGreen.withValues(alpha: 0.15),
      labelTextStyle: WidgetStateProperty.all(
        const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
      ),
    ),
  );
}

/// Glassmorphic cyber card used across dashboard, vault, playground, matrix.
class CyberCard extends StatelessWidget {
  const CyberCard({
    super.key,
    required this.child,
    this.padding,
    this.borderColor,
    this.borderOpacity = 0.12,
    this.backgroundOpacity = NexusBrand.glassPanelOpacity,
    this.glowColor,
    this.glowStrength = 0,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final Color? borderColor;
  final double borderOpacity;
  final double backgroundOpacity;
  final Color? glowColor;
  final double glowStrength;

  @override
  Widget build(BuildContext context) {
    final border = borderColor ?? NexusBrand.cyberCyan;
    return Material(
      color: NexusBrand.glassPanel.withValues(alpha: backgroundOpacity),
      borderRadius: BorderRadius.circular(NexusBrand.cardRadius),
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(NexusBrand.cardRadius),
          border: Border.all(
            color: border.withValues(alpha: borderOpacity),
            width: 1,
          ),
          boxShadow: glowStrength > 0 && glowColor != null
              ? [
                  BoxShadow(
                    color: glowColor!.withValues(alpha: glowStrength),
                    blurRadius: 18,
                    spreadRadius: 0,
                  ),
                ]
              : null,
        ),
        child: Padding(
          padding: padding ?? EdgeInsets.zero,
          child: child,
        ),
      ),
    );
  }
}
