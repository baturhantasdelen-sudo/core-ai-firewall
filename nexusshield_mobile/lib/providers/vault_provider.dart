import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../services/vault_service.dart';

final vaultServiceProvider = Provider<VaultService>((ref) => VaultService());
