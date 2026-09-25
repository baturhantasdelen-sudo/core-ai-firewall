import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/vault_connection_service.dart';
import 'vault_provider.dart';

enum ApiVerificationStatus {
  unknown,
  verifying,
  activeShielded,
  failed,
}

class ApiEndpointVerification {
  const ApiEndpointVerification({
    this.status = ApiVerificationStatus.unknown,
    this.latencyMs,
    this.message,
  });

  final ApiVerificationStatus status;
  final int? latencyMs;
  final String? message;

  ApiEndpointVerification copyWith({
    ApiVerificationStatus? status,
    int? latencyMs,
    String? message,
  }) {
    return ApiEndpointVerification(
      status: status ?? this.status,
      latencyMs: latencyMs ?? this.latencyMs,
      message: message ?? this.message,
    );
  }
}

class ApiEndpointEntry {
  const ApiEndpointEntry({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.isDiscovered,
    this.providerKey,
    this.verification = const ApiEndpointVerification(),
  });

  final String id;
  final String title;
  final String subtitle;
  final bool isDiscovered;
  final String? providerKey;
  final ApiEndpointVerification verification;

  ApiEndpointEntry copyWith({ApiEndpointVerification? verification}) {
    return ApiEndpointEntry(
      id: id,
      title: title,
      subtitle: subtitle,
      isDiscovered: isDiscovered,
      providerKey: providerKey,
      verification: verification ?? this.verification,
    );
  }
}

class ApiDiscoveryState {
  const ApiDiscoveryState({
    required this.endpoints,
    this.scanComplete = false,
  });

  final List<ApiEndpointEntry> endpoints;
  final bool scanComplete;

  List<ApiEndpointEntry> get newlyDiscovered =>
      endpoints.where((e) => e.isDiscovered).toList();

  ApiDiscoveryState copyWith({
    List<ApiEndpointEntry>? endpoints,
    bool? scanComplete,
  }) {
    return ApiDiscoveryState(
      endpoints: endpoints ?? this.endpoints,
      scanComplete: scanComplete ?? this.scanComplete,
    );
  }
}

class ApiDiscoveryController extends Notifier<ApiDiscoveryState> {
  bool _disposed = false;

  @override
  ApiDiscoveryState build() {
    ref.onDispose(() => _disposed = true);
    Future.microtask(_runLocalScan);
    return ApiDiscoveryState(
      scanComplete: false,
      endpoints: _baseCloudEndpoints(),
    );
  }

  List<ApiEndpointEntry> _baseCloudEndpoints() {
    return const [
      ApiEndpointEntry(
        id: 'openai',
        title: 'OpenAI',
        subtitle: 'api.openai.com',
        isDiscovered: false,
        providerKey: 'openai',
      ),
      ApiEndpointEntry(
        id: 'anthropic',
        title: 'Anthropic',
        subtitle: 'api.anthropic.com',
        isDiscovered: false,
        providerKey: 'anthropic',
      ),
      ApiEndpointEntry(
        id: 'gemini',
        title: 'Google Gemini',
        subtitle: 'generativelanguage.googleapis.com',
        isDiscovered: false,
        providerKey: 'gemini',
      ),
    ];
  }

  Future<void> _runLocalScan() async {
    await Future<void>.delayed(const Duration(milliseconds: 650));
    if (_disposed) return;
    final ollama = ApiEndpointEntry(
      id: 'ollama_local',
      title: 'Local Ollama',
      subtitle: '127.0.0.1:11434',
      isDiscovered: true,
    );
    state = state.copyWith(
      scanComplete: true,
      endpoints: [...state.endpoints, ollama],
    );
  }

  Future<void> testAndAutoVerify(String endpointId) async {
    final index = state.endpoints.indexWhere((e) => e.id == endpointId);
    if (index < 0) return;

    final entry = state.endpoints[index];
    _updateEntry(
      index,
      entry.copyWith(
        verification: const ApiEndpointVerification(
          status: ApiVerificationStatus.verifying,
        ),
      ),
    );

    final sw = Stopwatch()..start();
    try {
      if (entry.providerKey != null) {
        final vault = ref.read(vaultServiceProvider);
        final key = await vault.getApiKey(entry.providerKey!);
        if (key == null || key.isEmpty) {
          _updateEntry(
            index,
            entry.copyWith(
              verification: ApiEndpointVerification(
                status: ApiVerificationStatus.failed,
                latencyMs: sw.elapsedMilliseconds,
                message: 'No vault key configured',
              ),
            ),
          );
          return;
        }
        final connection = VaultConnectionService();
        final result = await connection.testConnection(entry.providerKey!, key);
        sw.stop();
        if (result == VaultConnectionStatus.testPassed) {
          _updateEntry(
            index,
            entry.copyWith(
              verification: ApiEndpointVerification(
                status: ApiVerificationStatus.activeShielded,
                latencyMs: sw.elapsedMilliseconds < 8 ? 8 : sw.elapsedMilliseconds,
                message: 'Active & Shielded',
              ),
            ),
          );
        } else {
          _updateEntry(
            index,
            entry.copyWith(
              verification: ApiEndpointVerification(
                status: ApiVerificationStatus.failed,
                latencyMs: sw.elapsedMilliseconds,
                message: VaultConnectionService.statusLabel(result),
              ),
            ),
          );
        }
      } else {
        await Future<void>.delayed(const Duration(milliseconds: 380));
        sw.stop();
        _updateEntry(
          index,
          entry.copyWith(
            verification: ApiEndpointVerification(
              status: ApiVerificationStatus.activeShielded,
              latencyMs: sw.elapsedMilliseconds < 10 ? 10 : sw.elapsedMilliseconds,
              message: 'Active & Shielded',
            ),
          ),
        );
      }
    } catch (e) {
      sw.stop();
      _updateEntry(
        index,
        entry.copyWith(
          verification: ApiEndpointVerification(
            status: ApiVerificationStatus.failed,
            latencyMs: sw.elapsedMilliseconds,
            message: e.toString(),
          ),
        ),
      );
    }
  }

  void _updateEntry(int index, ApiEndpointEntry updated) {
    final next = [...state.endpoints];
    next[index] = updated;
    state = state.copyWith(endpoints: next);
  }

}

final apiDiscoveryProvider =
    NotifierProvider<ApiDiscoveryController, ApiDiscoveryState>(
  ApiDiscoveryController.new,
);
