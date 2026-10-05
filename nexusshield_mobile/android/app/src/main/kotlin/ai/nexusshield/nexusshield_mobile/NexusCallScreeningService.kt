package ai.nexusshield.nexusshield_mobile

import android.os.Build
import android.telecom.Call
import android.telecom.CallScreeningService
import androidx.annotation.RequiresApi

@RequiresApi(Build.VERSION_CODES.N)
class NexusCallScreeningService : CallScreeningService() {
    override fun onScreenCall(callDetails: Call.Details) {
        val handle = callDetails.handle?.schemeSpecificPart
        val blocked = CallBlockStore.isBlocked(this, handle)
        val response = CallResponse.Builder()
            .setDisallowCall(blocked)
            .setRejectCall(blocked)
            .setSkipCallLog(blocked)
            .setSkipNotification(blocked)
            .build()
        respondToCall(callDetails, response)
    }
}
