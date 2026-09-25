package ai.nexusshield.nexusshield_mobile

import android.accessibilityservice.AccessibilityService
import android.view.accessibility.AccessibilityEvent

/**
 * Banking / SMS isolation guard. Extend with package allowlists and overlay blocking.
 */
class NexusShieldAccessibilityService : AccessibilityService() {
    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Hook banking app foreground events and SMS OTP surfaces here.
    }

    override fun onInterrupt() = Unit
}
