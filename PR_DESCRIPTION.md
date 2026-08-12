## Summary

- Adds a guardrails guide for [@baturhantasdelen/nexus-shield-edge](https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge), an edge-native, zero-dependency PII masking library for the Vercel AI SDK and Edge Runtime.
- Documents input sanitization on Vercel Edge (`export const runtime = 'edge'`) and Cloudflare Workers middleware integration.
- Highlights sub-millisecond, in-memory execution with no network roundtrip to an external guardrail service.

## Motivation

The AI SDK already documents [language model middleware](/docs/ai-sdk-core/middleware) for output-side guardrails. Many production apps also need **input-side PII redaction** before prompts reach an LLM. Remote guardrail APIs add latency and fail when the network is slow or unavailable.

`@baturhantasdelen/nexus-shield-edge` runs compiled regex patterns directly in the Edge Runtime or Cloudflare Workers isolate, typically in **< 0.1 ms**, with zero npm dependencies.

## Changes

| File | Action |
| :--- | :--- |
| `content/docs/06-advanced/12-guardrails.mdx` | **Add** — new guide |
| `content/docs/03-ai-sdk-core/40-middleware.mdx` | **Optional** — add Community Middleware cross-link |

## Test plan

- [ ] `pnpm build` in `apps/docs` succeeds
- [ ] New page renders at `/docs/advanced/guardrails`
- [ ] Code samples use TypeScript and match existing MDX conventions
- [ ] Links to npm package and middleware doc resolve correctly

## Package

- npm: https://www.npmjs.com/package/@baturhantasdelen/nexus-shield-edge
- Source: https://github.com/baturhantasdelen-sudo/core-ai-firewall/tree/main/packages/edge
