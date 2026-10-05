import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/platform/nexus_platform_bridge.dart';

class CallFraudState {
  const CallFraudState({
    this.blockedNumbers = const [],
    this.synced = false,
    this.lastSync,
  });

  final List<String> blockedNumbers;
  final bool synced;
  final DateTime? lastSync;

  CallFraudState copyWith({
    List<String>? blockedNumbers,
    bool? synced,
    DateTime? lastSync,
  }) {
    return CallFraudState(
      blockedNumbers: blockedNumbers ?? this.blockedNumbers,
      synced: synced ?? this.synced,
      lastSync: lastSync ?? this.lastSync,
    );
  }
}

class CallFraudController extends Notifier<CallFraudState> {
  @override
  CallFraudState build() {
    Future.microtask(_loadFeedAndSync);
    return const CallFraudState();
  }

  Future<void> _loadFeedAndSync() async {
    try {
      final raw = await rootBundle.loadString(
        'assets/threat_intel/scam_numbers.json',
      );
      final decoded = jsonDecode(raw) as Map<String, dynamic>;
      final numbers = (decoded['numbers'] as List<dynamic>? ?? const [])
          .map((e) => '$e')
          .toList(growable: false);
      state = state.copyWith(blockedNumbers: numbers);
      await NexusPlatformBridge.syncCallBlockList(numbers);
      state = state.copyWith(synced: true, lastSync: DateTime.now());
    } catch (_) {
      state = state.copyWith(synced: false);
    }
  }

  Future<void> resync() => _loadFeedAndSync();
}

final callFraudProvider =
    NotifierProvider<CallFraudController, CallFraudState>(
  CallFraudController.new,
);
