import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';

import '../providers/api_discovery_provider.dart';
import '../providers/vault_provider.dart';
import '../theme/app_theme.dart';
import '../widgets/nexus_screen_header.dart';

class VaultScreen extends ConsumerStatefulWidget {
  const VaultScreen({super.key});

  @override
  ConsumerState<VaultScreen> createState() => _VaultScreenState();
}

class _VaultScreenState extends ConsumerState<VaultScreen> {
  final _controllers = <String, TextEditingController>{};
  final _localAuth = LocalAuthentication();
  bool _loading = true;
  final Set<String> _configured = {};

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  @override
  void dispose() {
    for (final c in _controllers.values) {
      c.dispose();
    }
    super.dispose();
  }

  TextEditingController _controllerFor(String? providerKey) {
    if (providerKey == null) {
      return TextEditingController();
    }
    return _controllers.putIfAbsent(providerKey, TextEditingController.new);
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    final vault = ref.read(vaultServiceProvider);
    final configured = await vault.listConfiguredProviders();
    if (!mounted) return;
    setState(() {
      _configured
        ..clear()
        ..addAll(configured);
      _loading = false;
    });
  }

  Future<void> _save(String provider) async {
    final vault = ref.read(vaultServiceProvider);
    final value = _controllerFor(provider).text.trim();
    if (value.isEmpty) {
      _showSnack('Enter an API key for ${provider.toUpperCase()}.');
      return;
    }
    try {
      await vault.saveApiKey(provider, value);
      _controllerFor(provider).clear();
      await ref.read(apiDiscoveryProvider.notifier).testAndAutoVerify(provider);
      await _refresh();
      if (!mounted) return;
      _showSnack('${provider.toUpperCase()} key stored in hardware vault.');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  Future<void> _reveal(String provider) async {
    final canCheck = await _localAuth.canCheckBiometrics;
    final supported = await _localAuth.isDeviceSupported();
    if (canCheck || supported) {
      final ok = await _localAuth.authenticate(
        localizedReason: 'Unlock to view masked ${provider.toUpperCase()} key',
      );
      if (!ok) return;
    }

    final vault = ref.read(vaultServiceProvider);
    final key = await vault.getApiKey(provider);
    if (!mounted) return;
    if (key == null) {
      _showSnack('No key stored for ${provider.toUpperCase()}.');
      return;
    }

    final masked = _maskKey(key);
    showDialog<void>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('${provider.toUpperCase()} Vault Entry'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Biometric unlock successful.'),
            const SizedBox(height: 8),
            SelectableText(masked),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }

  String _maskKey(String key) {
    if (key.length <= 8) return '••••••••';
    return '${key.substring(0, 4)}••••••••${key.substring(key.length - 4)}';
  }

  Future<void> _delete(String provider) async {
    try {
      final vault = ref.read(vaultServiceProvider);
      await vault.deleteApiKey(provider);
      await _refresh();
      if (!mounted) return;
      _showSnack('${provider.toUpperCase()} key removed.');
    } catch (e) {
      _showSnack(e.toString());
    }
  }

  void _showSnack(String message) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final discovery = ref.watch(apiDiscoveryProvider);

    return SafeArea(
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.all(20),
              children: [
                const NexusScreenHeader(
                  title: 'Hardware BYOK Vault',
                  subtitle:
                      'Auto-discover local AI endpoints and verify cloud keys with shielded handshake tests.',
                ),
                const SizedBox(height: 16),
                if (discovery.scanComplete && discovery.newlyDiscovered.isNotEmpty)
                  _DiscoveryBanner(
                    count: discovery.newlyDiscovered.length,
                    headline: discovery.newlyDiscovered.first.title,
                    endpoint: discovery.newlyDiscovered.first.subtitle,
                  ),
                const SizedBox(height: 16),
                for (final entry in discovery.endpoints) ...[
                  _EndpointVaultCard(
                    entry: entry,
                    configured: entry.providerKey != null &&
                        _configured.contains(entry.providerKey),
                    controller: entry.providerKey != null
                        ? _controllerFor(entry.providerKey)
                        : null,
                    onSave: entry.providerKey != null
                        ? () => _save(entry.providerKey!)
                        : null,
                    onReveal: entry.providerKey != null
                        ? () => _reveal(entry.providerKey!)
                        : null,
                    onDelete: entry.providerKey != null
                        ? () => _delete(entry.providerKey!)
                        : null,
                    onVerify: () => ref
                        .read(apiDiscoveryProvider.notifier)
                        .testAndAutoVerify(entry.id),
                  ),
                  const SizedBox(height: 12),
                ],
              ],
            ),
    );
  }
}

class _DiscoveryBanner extends StatelessWidget {
  const _DiscoveryBanner({
    required this.count,
    required this.headline,
    required this.endpoint,
  });

  final int count;
  final String headline;
  final String endpoint;

  @override
  Widget build(BuildContext context) {
    return CyberCard(
      padding: const EdgeInsets.all(14),
      borderColor: NexusBrand.neonGreen,
      borderOpacity: 0.35,
      backgroundOpacity: 0.85,
      glowColor: NexusBrand.neonGreen,
      glowStrength: 0.12,
      child: Row(
        children: [
          const Icon(Icons.radar, color: NexusBrand.neonGreen),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Discovered $count new AI Endpoint${count == 1 ? '' : 's'}: '
              '$headline ($endpoint)',
              style: const TextStyle(color: Colors.white, height: 1.35),
            ),
          ),
        ],
      ),
    );
  }
}

class _EndpointVaultCard extends StatelessWidget {
  const _EndpointVaultCard({
    required this.entry,
    required this.configured,
    required this.onVerify,
    this.controller,
    this.onSave,
    this.onReveal,
    this.onDelete,
  });

  final ApiEndpointEntry entry;
  final bool configured;
  final TextEditingController? controller;
  final VoidCallback? onSave;
  final VoidCallback? onReveal;
  final VoidCallback? onDelete;
  final VoidCallback onVerify;

  @override
  Widget build(BuildContext context) {
    final verification = entry.verification;
    final isActive =
        verification.status == ApiVerificationStatus.activeShielded;

    return CyberCard(
      padding: const EdgeInsets.all(16),
      child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        entry.title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        entry.subtitle,
                        style: const TextStyle(
                          color: NexusBrand.muted,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                if (entry.isDiscovered)
                  const Icon(Icons.wifi_tethering, color: NexusBrand.cyberCyan),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                _StatusDot(status: verification.status),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    _statusText(verification),
                    style: TextStyle(
                      color: _statusColor(verification.status),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (isActive && verification.latencyMs != null)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: NexusBrand.neonGreen.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      '${verification.latencyMs}ms',
                      style: const TextStyle(
                        color: NexusBrand.neonGreen,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
              ],
            ),
            if (controller != null) ...[
              const SizedBox(height: 12),
              TextField(
                controller: controller,
                obscureText: true,
                decoration: InputDecoration(
                  labelText: '${entry.title} API Key',
                  hintText: configured ? '••••••••••••' : 'sk-...',
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  if (onSave != null)
                    Expanded(
                      child: FilledButton(
                        onPressed: onSave,
                        child: const Text('Save to Vault'),
                      ),
                    ),
                  if (configured && onReveal != null) ...[
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Reveal masked',
                      onPressed: onReveal,
                      icon: const Icon(Icons.visibility_outlined),
                    ),
                    if (onDelete != null)
                      IconButton(
                        tooltip: 'Delete',
                        onPressed: onDelete,
                        icon: const Icon(Icons.delete_outline),
                      ),
                  ],
                ],
              ),
            ],
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: verification.status == ApiVerificationStatus.verifying
                  ? null
                  : onVerify,
              icon: verification.status == ApiVerificationStatus.verifying
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.verified_user_outlined),
              label: const Text('Test & Auto-Verify'),
            ),
          ],
      ),
    );
  }

  String _statusText(ApiEndpointVerification verification) {
    switch (verification.status) {
      case ApiVerificationStatus.unknown:
        return configured ? 'Stored — verify to shield' : 'Not verified';
      case ApiVerificationStatus.verifying:
        return 'Running handshake test…';
      case ApiVerificationStatus.activeShielded:
        return verification.message ?? 'Active & Shielded';
      case ApiVerificationStatus.failed:
        return verification.message ?? 'Verification failed';
    }
  }

  Color _statusColor(ApiVerificationStatus status) {
    switch (status) {
      case ApiVerificationStatus.activeShielded:
        return NexusBrand.neonGreen;
      case ApiVerificationStatus.failed:
        return NexusBrand.alertRed;
      case ApiVerificationStatus.verifying:
        return NexusBrand.cyberCyan;
      case ApiVerificationStatus.unknown:
        return NexusBrand.amber;
    }
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.status});

  final ApiVerificationStatus status;

  @override
  Widget build(BuildContext context) {
    return Icon(
      Icons.circle,
      size: 10,
      color: switch (status) {
        ApiVerificationStatus.activeShielded => NexusBrand.neonGreen,
        ApiVerificationStatus.failed => NexusBrand.alertRed,
        ApiVerificationStatus.verifying => NexusBrand.cyberCyan,
        ApiVerificationStatus.unknown => NexusBrand.amber,
      },
    );
  }
}
