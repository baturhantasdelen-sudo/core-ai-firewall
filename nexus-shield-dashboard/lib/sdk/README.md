# Nexus Shield SDK (TypeScript)

```typescript
import { verifyAction, SecurityException } from '@/lib/sdk/verify-action';

try {
  const decision = verifyAction({
    agent: 'finance-agent-04',
    intent: 'retrieve_invoice_8291',
    action: { name: 'read_invoice', args: { invoice_id: '8291' } },
    authority: ['READ', 'API_CALL'],
    policyYaml: `agent: finance-agent
allowed_intents:
  - READ_INVOICE`,
  });
  console.log(decision.actionProofHash);
} catch (e) {
  if (e instanceof SecurityException) {
    throw e;
  }
}
```

REST: `POST /api/v1/action/evaluate` with the same fields (`authority`, `policy_yaml`, `transaction_id`, `state_before`, `state_after`, `api_result`).

Python: `from nexus_shield.sdk import verify_action, SecurityException`
