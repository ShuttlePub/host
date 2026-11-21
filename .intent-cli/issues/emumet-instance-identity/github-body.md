## Goal

TODO: state what this slice will change.

## Why This Slice Exists Now

TODO: explain why this is the next step.

## Current Observed State

TODO: describe current behavior or repro.

## Accepted Baseline You May Assume

- TODO

## Target Repo / Path / Part

Repository: `<owner/repo>`

- Target paths: `<comma- or space-separated paths>`

Target part: `<one-line target description>`

## In Scope

- TODO

## Out Of Scope

- TODO

## Standalone Child Issue Contract

TODO: one-paragraph restatement of exactly what the child PR must deliver, readable on its own without the surrounding design thread.

## Acceptance Criteria

- TODO

## Verification

TODO: focused tests and `git diff --check`.

## Related Links

- TODO

## Knowledge Maintenance

Optional (G461). Tells the implementer/reviewer whether intent / ADR / diagram / docs
writeback is expected for this slice. Answer or explicitly decline:

- Intent placement: TODO / none
- ADR candidate: TODO / none
- Diagram candidate: TODO / none
- Docs update: TODO / none
- Closeout writeback expected: no

## Guide Reachability (G645)

While the author still knows the answer, name the guide surface and role that route to every
role-facing surface this slice adds, or explicitly say that no role-facing surface is added. A
blank answer is not treated as no-surface. The closeout record is a debt check, not a merge gate.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open all child PRs against `main` directly.
## Goal

Add the Emumet instance identity and independently encrypted instance signing key required by the P1 post-relay contract, and publish the corresponding instance actor document. This is K1 only: no relay worker, link, or key rotation/revocation operation.

The shared contract is canonical in the host repository at `intents/shuttlepub/contracts/emumet-post-relay/`, host commit `cc19ad0887409601999e66b3f00fb8d0735ebfc3` (emumet-post-relay v1, revision 1). Emumet must not independently change that contract.

## Why This Slice Exists Now

The approved P1 plan sequences contract C0 before implementation. K1 (instance identity) and L1 (home link) both depend on C0 and may proceed in parallel; neither depends on the other. K1 establishes the instance-level signer and public key document that later delivery work will use.

## Target Repo / Paths / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/`, `application/`, `driver/`, `server/`, and the existing migration directory as required.
- Target part: model/port, provisioning, encrypted persistence, additive schema, anonymous instance actor route/document, and dependency wiring for the instance identity and signing key. Record the full Emumet `main` SHA used as the implementation baseline in the PR; the approved plan's observed baseline was `1259c731af496bb09ae11286a9b869b132a88f4d`.

## In Scope

- Implement a stable instance actor at `{PUBLIC_BASE_URL}/ap/instance`, with an anonymous GET document whose `id` matches that configured URL and whose type is `Application`.
- Publish public keys in a representation supporting multiple keys. Generate all identity/key URLs from configured `PUBLIC_BASE_URL`, never from an inbound Host header.
- Provision one instance identity and one active instance signing key under concurrent requests/processes, enforced by database uniqueness/serialization.
- Persist instance signing material encrypted at rest, using the existing crypto boundary but separate storage and identity from Profile keys. Use opaque, non-reusable key IDs.
- Preserve identity/key material across restart. Fail closed on decrypt failure, corruption, or configured public-origin mismatch; do not silently regenerate a replacement.
- Bound the parsed-key process cache to at most 2 entries with a 15-minute TTL and single-flight cache misses. Do not run KDF decryption per delivery or write parsed/private key material to disk, logs, or normal DTOs.
- Add only additive migrations when needed and cover an empty database plus the supported pre-change schema.

## Out of Scope

- Home links (L1), relay storage/queue (Q1), delivery/signing worker (S1), inbox integration (I1), Ory runtime changes (B1), login/consent boundary (A1), and E2E (T1).
- Key rotation/revocation operations (K2), Profile actor/key redesign, P2/link-state synchronization, ShuttlePub's production receiver, DCR, or publishing a dev image.
- Changes to `ory/hydra/hydra.yml`.

## Acceptance Criteria

- **K1-1 Concurrent provisioning:** against an empty database, simultaneous provisioning yields exactly one instance identity and exactly one active instance signing key, including across processes.
- **K1-2 Public actor:** anonymous `GET {PUBLIC_BASE_URL}/ap/instance` returns an Application document with the configured URL as `id`; its public-key representation can include multiple keys. Neither URLs nor identity are derived from request Host.
- **K1-3 Key isolation and persistence:** instance key material is encrypted at rest and separate from Profile keys. The public response and normal DTOs expose no private material. Identity/key remain stable after restart; key IDs are opaque and never reused.
- **K1-4 Fail closed:** decryption failure, corrupt stored material, and public-origin mismatch are observable errors and never trigger silent replacement key generation or identity repair.
- **K1-5 Bounded key access:** parsed keys remain process-local, at most 2 cached entries, 15-minute TTL, single-flight on misses, and no per-delivery KDF. No private key reaches logs or disk cache.
- **K1-6 Profile regression:** existing Profile actor documents and Profile signing/key behavior pass regression tests unchanged; an instance key cannot be used as a Profile key.
- **K1-7 Scope:** no rotate/revoke operation, relay delivery worker, link feature, P2 behavior, or ShuttlePub production receiver is introduced.
- **K1-8 Migration safety:** migrations are additive and tested on an empty database and the supported pre-change schema; DB tests are not skipped. Assess compatibility with the previous binary before relying on the migration.

## Verification

Run focused concurrent-provisioning and persistence tests, public actor route/document tests, failure-mode tests for corrupt/undecryptable/origin-mismatched keys, and existing Profile actor/key regression tests. Exercise migrations against both an empty database and the supported existing schema without skips. Run relevant repository fmt, clippy, build, and test checks, and `git diff --check`.

## Related Decisions and Constraints

- Host canonical contract: `intents/shuttlepub/contracts/emumet-post-relay/` at `cc19ad0887409601999e66b3f00fb8d0735ebfc3`.
- Host plan/design: `intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md` (D51, D61-D66); Emumet `intents/emumet/features/post-relay/`; `intents/emumet/decisions/0003-delegated-signing.md`.
- Apply DC-01, DC-03, DC-12, and DC-15. This issue depends on C0 (`emumet-p1-relay-contract`, issue #114); L1 also depends on C0 and is independent of K1.
- The Emumet checkout's existing uncommitted `ory/hydra/hydra.yml` must not be modified or included in a PR.

## Related Links

- [C0 contract issue #114](https://github.com/ShuttlePub/Emumet/issues/114)
- [Host canonical post-relay contract](https://github.com/ShuttlePub/host/tree/main/intents/shuttlepub/contracts/emumet-post-relay)
- [Approved Emumet P1 plan and design constraints](https://github.com/ShuttlePub/host/tree/main/intents/shuttlepub/decisions)

## Knowledge Maintenance

- Intent placement: existing `intents/emumet/features/post-relay/overview.md`; no new intent node.
- ADR/diagram: none required; host contract and existing delegated-signing decision remain canonical.
- Do not copy or independently revise the host contract.
- Closeout learning: capture any discovered provisioning/encrypted-key persistence constraints; writeback is not required.
- Guide reachability: no role-facing operational surface is added.

## Base Branch Policy

Open the child implementation PR against `main`. Do not merge without the lead's instruction.
