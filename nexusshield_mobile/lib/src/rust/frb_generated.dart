// Temporary bridge facade — replace by running:
//   flutter_rust_bridge_codegen integrate
//   flutter_rust_bridge_codegen generate

import 'dart:typed_data';

import '../../models/deepfake_analysis.dart';
import '../../services/nexus_core_dart.dart';

abstract class RustLibApi {
  String scrubPii({required String input});

  String scrubPiiStream({required String input});

  double verifyC2paSignature({required Uint8List imageBytes});

  DeepfakeAnalysis analyzeMediaFrame({required Uint8List frameBytes});
}

class _DartRustLibApi implements RustLibApi {
  final NexusCoreDart _core = NexusCoreDart();

  @override
  String scrubPii({required String input}) => _core.scrubPii(input);

  @override
  String scrubPiiStream({required String input}) => _core.scrubPiiStream(input);

  @override
  double verifyC2paSignature({required Uint8List imageBytes}) =>
      _core.verifyC2paSignature(imageBytes);

  @override
  DeepfakeAnalysis analyzeMediaFrame({required Uint8List frameBytes}) =>
      _core.analyzeMediaFrame(frameBytes);
}

class RustLib {
  RustLib._();

  static RustLibApi _api = _DartRustLibApi();

  static Future<void> init() async {}

  static void initMock({required RustLibApi api}) {
    _api = api;
  }

  static RustLibHolder get instance => RustLibHolder._(_api);
}

class RustLibHolder {
  RustLibHolder._(this.api);

  final RustLibApi api;
}
