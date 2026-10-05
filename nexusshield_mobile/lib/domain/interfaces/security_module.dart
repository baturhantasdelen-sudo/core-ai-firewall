import '../models/module_health.dart';

/// Contract for pluggable security domains (shield, network, permissions, AI).
abstract interface class SecurityModule {
  String get id;

  String get displayName;

  Future<ModuleHealth> evaluate();
}
