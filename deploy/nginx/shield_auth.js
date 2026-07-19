/**
 * Nexus Quantum Guard — Nginx njs gateway doğrulama modülü
 *
 * auth_request alt isteği GET gönderdiği için POST gövdesi iletilemez.
 * js_access fazında tam chat/completions gövdesi /v1/shield/validate-chat'e iletilir.
 */
async function shieldAuth(r) {
    if (r.method !== "POST") {
        return;
    }

    var shieldResp = await r.subrequest("/_internal_shield_validate", {
        method: "POST",
        body: r.requestBody,
    });

    if (shieldResp.status === 403) {
        r.return(
            403,
            '{"status":"REJECTED","reason":"Security Policy Violation - Nexus Quantum Guard","error_code":403}'
        );
        return;
    }

    if (shieldResp.status >= 400) {
        r.return(
            503,
            '{"status":"ERROR","reason":"Nexus Quantum Guard unavailable","error_code":503}'
        );
    }
}

export default { shieldAuth };
