# Nexus Shield AI — First Customer Pilot Overview

## Purpose

Demonstrate **independent outcome assurance**: when an AI agent or tool reports success, Nexus Shield verifies the authoritative business state and produces traceable evidence when the outcome did not occur.

## Pilot scope

- One organization (API key scoped)
- Finance/refund or payment-status workflow (read-only observation)
- Proof Center lookup of persisted `verification_id`
- Deterministic DEMO fixtures when live ERP sandbox is not configured

## Out of scope

- Financial writes (refunds, payments, invoice mutations)
- Production ERP production environment reads
- Multi-region HA deployment

## Success statement

> An AI agent reports success, but Nexus Shield independently detects that the intended business outcome did not occur and produces traceable evidence.
