import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:nexusshield_mobile/main.dart';

void main() {
  testWidgets('Dashboard renders security panel and telemetry', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(
        child: NexusShieldApp(),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 1500));
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.textContaining('Güvenlik Panosu'), findsOneWidget);
    expect(find.textContaining('Koruma skoru'), findsOneWidget);
    expect(find.textContaining('PII Items Masked'), findsOneWidget);
    expect(find.text('Live Interceptor Playground'), findsOneWidget);
  });
}
