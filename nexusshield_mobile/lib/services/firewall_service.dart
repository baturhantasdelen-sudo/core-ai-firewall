import 'dart:typed_data';

import '../models/deepfake_analysis.dart';
import '../src/rust/frb_generated.dart';
import 'action_firewall.dart';

/// Rust FFI firewall engine + Action Firewall orchestration.
class FirewallService {
  FirewallService._();

  static final FirewallService instance = FirewallService._();

  bool _initialized = false;
  int _monitorTick = 0;

  Future<void> ensureInitialized() async {
    if (_initialized) {
      return;
    }
    await RustLib.init();
    _initialized = true;
  }

  String scrubPii(String input) {
    _assertReady();
    return RustLib.instance.api.scrubPii(input: input);
  }

  String scrubPiiStream(String input) {
    _assertReady();
    return RustLib.instance.api.scrubPiiStream(input: input);
  }

  double verifyC2paSignature(Uint8List imageBytes) {
    _assertReady();
    return RustLib.instance.api.verifyC2paSignature(imageBytes: imageBytes);
  }

  DeepfakeAnalysis analyzeMediaFrame(Uint8List frameBytes) {
    _assertReady();
    return RustLib.instance.api.analyzeMediaFrame(frameBytes: frameBytes);
  }

  /// Runs PII scrub + action firewall on a proxied payload.
  ProcessedPayload processOutboundPayload({
    required String rawText,
    required bool bankingGuardEnabled,
  }) {
    _assertReady();
    _monitorTick++;
    final packageId =
        ActionFirewall.instance.simulatedForegroundPackage(tick: _monitorTick);
    final decision = ActionFirewall.instance.evaluate(
      foregroundPackageId: packageId,
      inboundText: rawText,
      bankingGuardEnabled: bankingGuardEnabled,
    );

    var text = scrubPiiStream(rawText);
    if (decision.blockPromptInjection) {
      text = ActionFirewall.instance.filterPromptInjection(text);
    }
    if (decision.blockOtpLeak) {
      text = text.replaceAll(RegExp(r'\b\d{4,8}\b'), '[HIDDEN_OTP]');
    }

    return ProcessedPayload(
      scrubbedText: text,
      decision: decision,
      latencyMs: 8 + (_monitorTick % 4),
    );
  }

  void _assertReady() {
    if (!_initialized) {
      throw StateError('Call ensureInitialized() before using FirewallService.');
    }
  }
}

class ProcessedPayload {
  const ProcessedPayload({
    required this.scrubbedText,
    required this.decision,
    required this.latencyMs,
  });

  final String scrubbedText;
  final ActionFirewallDecision decision;
  final int latencyMs;
}
