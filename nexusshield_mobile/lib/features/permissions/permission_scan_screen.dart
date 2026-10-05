import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../domain/models/app_permission_report.dart';
import '../../theme/app_theme.dart';
import '../../widgets/nexus_screen_header.dart';
import 'permission_scan_provider.dart';

class PermissionScanScreen extends ConsumerWidget {
  const PermissionScanScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scan = ref.watch(permissionScanProvider);

    return Scaffold(
      backgroundColor: NexusBrand.deepSlate,
      appBar: AppBar(title: const Text('İzin Tarayıcısı')),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const NexusScreenHeader(
            title: 'Uygulama izin denetimi',
            subtitle:
                'Kamera, mikrofon, rehber ve konum — riskli profiller otomatik listelenir.',
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: scan.scanning
                ? null
                : () => ref.read(permissionScanProvider.notifier).scan(),
            icon: scan.scanning
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.refresh),
            label: Text(scan.scanning ? 'Taranıyor…' : 'Yeniden tara'),
          ),
          if (scan.error != null) ...[
            const SizedBox(height: 12),
            Text(scan.error!, style: const TextStyle(color: NexusBrand.alertRed)),
          ],
          const SizedBox(height: 16),
          Text(
            'Riskli: ${scan.risky.length} • Toplam kayıt: ${scan.reports.length}',
            style: const TextStyle(color: NexusBrand.muted),
          ),
          const SizedBox(height: 12),
          ...scan.risky.map((r) => _RiskTile(report: r)),
          if (scan.risky.isEmpty && !scan.scanning)
            const CyberCard(
              padding: EdgeInsets.all(16),
              child: Text(
                'Yüksek veya orta riskli izin profili bulunamadı.',
                style: TextStyle(color: NexusBrand.muted),
              ),
            ),
        ],
      ),
    );
  }
}

class _RiskTile extends StatelessWidget {
  const _RiskTile({required this.report});

  final AppPermissionReport report;

  Color get _accent => switch (report.riskTier) {
        AppPermissionRiskTier.high => NexusBrand.alertRed,
        AppPermissionRiskTier.medium => NexusBrand.amber,
        AppPermissionRiskTier.low => NexusBrand.neonGreen,
      };

  @override
  Widget build(BuildContext context) {
    final permLabels = report.permissions.map((p) => p.labelTr).join(', ');
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: CyberCard(
        borderColor: _accent,
        borderOpacity: 0.35,
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              report.displayName,
              style: const TextStyle(fontWeight: FontWeight.w700),
            ),
            Text(
              report.packageId,
              style: const TextStyle(color: NexusBrand.muted, fontSize: 11),
            ),
            const SizedBox(height: 6),
            Text(permLabels, style: TextStyle(color: _accent, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}
