import 'package:flutter/material.dart';

import '../../../domain/models/module_health.dart';
import '../../../domain/models/protection_score.dart';
import '../../../theme/app_theme.dart';

class SecurityStatusCard extends StatelessWidget {
  const SecurityStatusCard({
    super.key,
    required this.health,
    required this.icon,
    this.onTap,
  });

  final ModuleHealth health;
  final IconData icon;
  final VoidCallback? onTap;

  Color get _accent => switch (health.riskLevel) {
        RiskLevel.secure => NexusBrand.neonGreen,
        RiskLevel.warning => NexusBrand.amber,
        RiskLevel.critical => NexusBrand.alertRed,
      };

  @override
  Widget build(BuildContext context) {
    return CyberCard(
      borderColor: _accent,
      borderOpacity: 0.35,
      glowColor: _accent,
      glowStrength: health.riskLevel == RiskLevel.secure ? 0.12 : 0.06,
      padding: const EdgeInsets.all(14),
      child: InkWell(
        onTap: onTap,
        child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: _accent.withValues(alpha: 0.12),
              border: Border.all(color: _accent.withValues(alpha: 0.35)),
            ),
            child: Icon(icon, color: _accent, size: 24),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  health.title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  health.statusLabel,
                  style: TextStyle(
                    color: _accent,
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  health.detail,
                  style: const TextStyle(
                    color: NexusBrand.muted,
                    fontSize: 12,
                    height: 1.35,
                  ),
                ),
              ],
            ),
          ),
          Text(
            '${health.score}',
            style: TextStyle(
              color: _accent,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
        ],
        ),
      ),
    );
  }
}

IconData iconForModuleId(String moduleId) {
  return switch (moduleId) {
    'live_shield' => Icons.shield_moon_outlined,
    'network' => Icons.wifi_protected_setup_outlined,
    'permissions' => Icons.admin_panel_settings_outlined,
    'ai_guard' => Icons.psychology_alt_outlined,
    'call_fraud' => Icons.phone_disabled_outlined,
    'remote_access' => Icons.screen_lock_portrait_outlined,
    _ => Icons.security_outlined,
  };
}
