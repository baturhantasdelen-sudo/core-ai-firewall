import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers/playground_provider.dart';
import '../theme/app_theme.dart';

class LivePlaygroundPanel extends ConsumerStatefulWidget {
  const LivePlaygroundPanel({super.key});

  @override
  ConsumerState<LivePlaygroundPanel> createState() =>
      _LivePlaygroundPanelState();
}

class _LivePlaygroundPanelState extends ConsumerState<LivePlaygroundPanel> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _runIntercept() async {
    await ref
        .read(playgroundProvider.notifier)
        .intercept(_controller.text);
  }

  void _applyPreset(String sample) {
    _controller.text = sample;
    _runIntercept();
  }

  @override
  Widget build(BuildContext context) {
    final result = ref.watch(playgroundProvider);

    return CyberCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Live Interceptor Playground',
            style: TextStyle(
              color: Colors.white,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 6),
          const Text(
            'Type a prompt or tap a sample — see PII scrubbing and action '
            'firewall output in real time.',
            style: TextStyle(color: NexusBrand.muted, height: 1.35),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _controller,
            minLines: 3,
            maxLines: 5,
            style: const TextStyle(color: Colors.white, height: 1.4),
            decoration: const InputDecoration(
              hintText: 'Paste sensitive prompt payload…',
              hintStyle: TextStyle(color: NexusBrand.muted),
            ),
            onChanged: (_) => _runIntercept(),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              for (final sample in playgroundPresets)
                ActionChip(
                  label: Text(
                    sample.length > 42
                        ? '${sample.substring(0, 42)}…'
                        : sample,
                    style: const TextStyle(fontSize: 11, color: Colors.white),
                  ),
                  backgroundColor: NexusBrand.glassPanel,
                  side: BorderSide(
                    color: NexusBrand.cyberCyan.withValues(alpha: 0.25),
                  ),
                  onPressed: () => _applyPreset(sample),
                ),
            ],
          ),
          const SizedBox(height: 14),
          FilledButton.icon(
            onPressed: _runIntercept,
            icon: const Icon(Icons.bolt_outlined),
            label: const Text('Run Interceptor'),
          ),
          if (result.input.isNotEmpty) ...[
            const SizedBox(height: 16),
            _PayloadCompare(result: result),
          ],
        ],
      ),
    );
  }
}

class _PayloadCompare extends StatelessWidget {
  const _PayloadCompare({required this.result});

  final PlaygroundResult result;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final stacked = width < 720;

    final inbound = _PayloadPane(
      title: 'BEFORE (raw)',
      body: result.input,
      borderColor: NexusBrand.alertRed,
      borderOpacity: 0.55,
    );
    final outbound = _PayloadPane(
      title: 'AFTER (scrubbed)',
      body: result.scrubbed,
      borderColor: NexusBrand.neonGreen,
      borderOpacity: 0.55,
      footer: _FirewallFooter(result: result),
    );

    if (stacked) {
      return Column(
        children: [
          inbound,
          const SizedBox(height: 12),
          outbound,
        ],
      );
    }

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Expanded(child: inbound),
          const SizedBox(width: 12),
          Expanded(child: outbound),
        ],
      ),
    );
  }
}

class _PayloadPane extends StatelessWidget {
  const _PayloadPane({
    required this.title,
    required this.body,
    required this.borderColor,
    this.borderOpacity = 0.45,
    this.footer,
  });

  final String title;
  final String body;
  final Color borderColor;
  final double borderOpacity;
  final Widget? footer;

  @override
  Widget build(BuildContext context) {
    return CyberCard(
      padding: const EdgeInsets.all(12),
      borderColor: borderColor,
      borderOpacity: borderOpacity,
      backgroundOpacity: 0.88,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: TextStyle(
              color: borderColor,
              fontWeight: FontWeight.w700,
              fontSize: 12,
              letterSpacing: 0.6,
            ),
          ),
          const SizedBox(height: 8),
          SelectableText(
            body,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 13,
              height: 1.45,
            ),
          ),
          if (footer != null) ...[
            const SizedBox(height: 10),
            footer!,
          ],
        ],
      ),
    );
  }
}

class _FirewallFooter extends StatelessWidget {
  const _FirewallFooter({required this.result});

  final PlaygroundResult result;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Latency: ${result.latencyMs} ms',
          style: const TextStyle(color: NexusBrand.cyberCyan, fontSize: 12),
        ),
        if (result.firewallReasons.isNotEmpty) ...[
          const SizedBox(height: 6),
          const Text(
            'Action firewall',
            style: TextStyle(
              color: NexusBrand.muted,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          ...result.firewallReasons.map(
            (r) => Padding(
              padding: const EdgeInsets.only(top: 2),
              child: Text(
                '• $r',
                style: const TextStyle(color: Colors.white70, fontSize: 11),
              ),
            ),
          ),
        ],
        if (result.blockedInjection)
          const Padding(
            padding: EdgeInsets.only(top: 6),
            child: Text(
              '⚠ Prompt injection pattern intercepted',
              style: TextStyle(color: NexusBrand.alertRed, fontSize: 11),
            ),
          ),
      ],
    );
  }
}
