# emumet-instance-identity Implementation Packet

## Goal

Add Emumet's stable instance identity, independently encrypted instance signing key, and public instance actor document. This is the K1 foundation for the P1 post-relay signer; it does not implement a delivery worker or key rotation.

## Why

The approved P1 plan introduces the shared contract first (C0), then allows K1 and L1 to proceed in parallel before storage and delivery. The instance actor/key must be separate from Profile identities and keys so later relay requests can be signed as the Emumet instance.

## Scope

- Implement the instance identity and signing-key model/port, provisioning, persistence/crypto adapter, server route/facade/DI, and additive database migration as needed.
- Expose anonymous `GET {PUBLIC_BASE_URL}/ap/instance` as an Application document with configured-origin-derived `id` and public key material. Keep the document shape compatible with multiple public keys.
- Serialize concurrent provisioning so one identity and one active key exist; use opaque, non-reusable key IDs.
- Reuse the existing encryption boundary while keeping instance key material distinct from Profile key material. Cache parsed keys only in process (maximum 2, TTL 15 minutes, single-flight on miss) rather than running KDF per delivery.
- Follow host contract commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3` and DC-01/03/12/15; the implementation base is the latest Emumet `main` at start, with the full SHA recorded in the PR.

## Out of scope

- Key rotation/revocation operations (K2), Profile key changes, home links (L1), relay storage/delivery (Q1/S1), inbox integration (I1), and ShuttlePub production receiver/P2 behavior.
- Changing `ory/hydra/hydra.yml` or introducing URLs derived from inbound Host.

## Verification

Test concurrent provisioning against the real database; verify identity/key stability across restart and the public actor document; verify fail-closed behavior for decryption/corruption/origin mismatch; and run Profile actor/key regression tests. Exercise additive migrations on an empty database and the supported pre-change schema without treating skipped DB tests as success. Run the repository's relevant formatting, lint, build, and test checks, plus `git diff --check`.

## Knowledge Maintenance (G461, optional)

Captured while the design context is fresh. Answer or explicitly decline:

- Intent placement: existing `intents/emumet/features/post-relay/overview.md`; no new intent node.
- ADR candidate: none; key/contract boundaries are already recorded in the host contract and `intents/emumet/decisions/0003-delegated-signing.md`.
- Diagram candidate: none identified.
- Docs update: do not duplicate or independently edit the host contract.
- Closeout learning: record any new provisioning/encryption constraints; `write_back_required: false`.

- Guide reachability (G645): no role-facing operational surface is added; `no_role_facing_surface: true`.

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
