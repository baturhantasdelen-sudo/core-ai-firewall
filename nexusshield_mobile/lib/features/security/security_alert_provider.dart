import 'package:flutter_riverpod/flutter_riverpod.dart';

enum SecurityAlertKind {
  permission,
  network,
  call,
  remoteAccess,
  ai,
}

class SecurityAlert {
  const SecurityAlert({
    required this.title,
    required this.body,
    required this.kind,
    this.createdAt,
  });

  final String title;
  final String body;
  final SecurityAlertKind kind;
  final DateTime? createdAt;
}

class SecurityAlertController extends Notifier<List<SecurityAlert>> {
  @override
  List<SecurityAlert> build() => const [];

  void push(SecurityAlert alert) {
    state = [
      SecurityAlert(
        title: alert.title,
        body: alert.body,
        kind: alert.kind,
        createdAt: DateTime.now(),
      ),
      ...state,
    ].take(20).toList(growable: false);
  }

  void dismiss(int index) {
    if (index < 0 || index >= state.length) return;
    state = [...state]..removeAt(index);
  }
}

final securityAlertProvider =
    NotifierProvider<SecurityAlertController, List<SecurityAlert>>(
  SecurityAlertController.new,
);
