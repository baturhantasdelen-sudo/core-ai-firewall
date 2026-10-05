package ai.nexusshield.nexusshield_mobile

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        NexusShieldPlatformPlugin.registerWith(flutterEngine, applicationContext)
    }
}
