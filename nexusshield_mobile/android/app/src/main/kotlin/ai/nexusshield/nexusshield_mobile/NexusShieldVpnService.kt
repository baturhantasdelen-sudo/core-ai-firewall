package ai.nexusshield.nexusshield_mobile

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor

/**
 * Local TUN proxy entry point for on-device AI traffic filtering.
 * Wire Rust core scrubbing into the packet pipeline in a production build.
 */
class NexusShieldVpnService : VpnService() {
    private var tunInterface: ParcelFileDescriptor? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (tunInterface == null) {
            val builder = Builder()
                .setSession("NexusShield Local Guard")
                .addAddress("10.0.0.2", 32)
                .addDnsServer("1.1.1.1")
            tunInterface = builder.establish()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        tunInterface?.close()
        tunInterface = null
        super.onDestroy()
    }
}
