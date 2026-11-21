# emumet-profile-inbox-relay Implementation Packet

## Goal

Connect the existing Emumet Profile inbox to Q1's durable post-relay admission ports. Preserve existing signature authentication and relation processing while applying canonical bounded JSON reading, Activity routing, immutable raw-body forwarding, and atomic receive-record/queue admission. Measure inbox acceptance under linked and unlinked load, including shared quota contention. This packet defines child-repository work; it does not modify Emumet code.

## Why This Slice Exists Now

The approved P1 order is C0/K1/L1 → Q1 → S1 → I1. C0 fixes the host contract and inbox fixtures, K1/L1 provide instance identity and lifecycle behavior, and merged Q1 (#122) supplies durable admission/receipt/quota ports. S1 is in progress as issue #123; it establishes the bounded sender and delivery baseline. I1 can be prepared after Q1, but it must not merge or enable inbox forwarding until S1 is merged. If S1 misses its delivery target, the lead's decision is a prerequisite to I1 activation.

## Current Observed State

- C0 issue #114 / PR #115, K1 issue #116 / PR #119, and L1 issue #117 / PR #120 are merged.
- Q1 issue #121 / PR #122 is merged and provides durable admission, quota, and cancellation interfaces. Q1 does not enable inbox reception.
- S1 issue #123 is open and its delivery PR is in progress. S1 owns the sender, operator recovery, and delivery performance baseline.
- The approved plan inspected Emumet `main` at `1259c731af496bb09ae11286a9b869b132a88f4d`. This is historical context; the implementing child agent must record the actual `main` SHA used after dependencies are present.
- The canonical inbox interpretation is host contract `intents/shuttlepub/contracts/emumet-post-relay/v1.md`, revision 3, §8, including its inbox-reading fixtures. The approved plan is the third edition; final I1 design constraints are DC-01/02/04/07/08/16/19.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/, application/, driver/, server/, migrations/, openapi.json`

Target part: I1 Profile inbox relay intake: bounded raw-body reading/evidence, contract routing, transaction-participating relation handling and Q1 admission, response/OpenAPI integration, additive migration `20261122000500`, and measured intake performance.

## Scope

- Use the existing Profile inbox route and verification flow. Return the actual signing key/owner evidence used by verification; retain signer-to-actor checks and do not call Ory for receive, queue, or forwarding.
- Read bounded raw JSON without requiring a typed Activity model for forwarding. Apply contract v1 revision 3 entry checks, duplicate-key checks at every nesting level, depth/node/string/array bounds, MIME rules, and envelope-compatible actor/Activity-id extraction.
- Classify `type` per contract §8.3. Follow and Block keep existing relation processing and are not forwarded. Undo/Accept/Reject are excluded only when every reference is certainly a stored or embedded Follow/Block. Unknown URLs, missing object, empty arrays, or mixed known/unknown arrays forward the whole body. Do not fetch `object` URLs or treat an early-Undo guard as evidence that a Follow exists. Reject a `type` array containing two or more recognized relation terms with `400 ambiguous_relation` and no relation changes; extension types alone do not reject or exclude.
- Preserve existing Follow/Block processing, signer verification, domain-block behavior, and early-Undo protection. Participate in Q1's transaction for receive records, required early-Undo guards, durable queue admission or body-free unlinked aggregation, and capacity/rate reservations. Return `202` only after commit; a `Duplicate` result alone never suppresses forwarding.
- Prove rollback/retry if admission fails after receiving/recording the Activity. A pre-existing receive record without a relay job must not suppress admission; commit followed by a lost response may duplicate but must not silently lose forwarding.
- Reuse Q1's shared PostgreSQL admission quotas/rate state; do not introduce a parallel or process-local queue/rate limiter. Profile limits return `429` plus `Retry-After`; global/audit/physical capacity unavailable or unknown returns `503` plus `Retry-After`; storage failures return retryable `5xx`.
- Forward documented Activity variants including `to`/`cc` strings, actor objects, missing Activity id, allowed `application/ld+json`, object arrays, and extension types. Preserve original request bytes and evidence; do not invent an Activity id or fetch external JSON-LD contexts.
- Unlinked reception stores no body or remote-selected identifiers. Keep logs, audit, metrics, and errors free of body, signing/private-key material, Cookie, authorization headers, and peer response bodies; use fixed labels, not Activity id, receipt, or actor.
- Add only the additive migration timestamp `20261122000500`; keep prior migrations unchanged.
- Measure I1's signature/read/admission transaction and time to `202` for linked/unlinked traffic, one Profile concentrated and multiple Profiles distributed, including Q1 shared-quota and hourly-bucket contention. Record environment, concurrency, requests/second, CPU/RSS, and DB/connection/lock waits.
- Extend the existing operational documentation and host post-relay intent evidence at closeout with measured results and any activation decision. The planned Emumet documentation path is `docs/post-relay-operations.md`; if S1 lands a different actual path, record that actual path as evidence instead of claiming the planned path exists.

## Out of Scope

- ShuttlePub production receiver, verification, duplicate removal or storage; P2 link-state/generation validation; K2 key rotation/revocation; contract revision; dev-image publication.
- New Activity-type allowlist, new Follow/Block policy, changes to existing Profile delivery/retry policy, or weakening existing signer/actor checks, relation processing, domain-block behavior, or early-Undo protection.
- HTTP send worker, sender recovery commands, or changes to Q1 quota/capacity interfaces (S1 and Q1 own those boundaries).
- Ory/Hydra changes, including `ory/hydra/hydra.yml`; unrelated login/consent or other service behavior.
- Inbox forwarding activation before the S1 delivery PR is merged. If S1's measured delivery target is unmet, activation additionally waits for a lead decision.

## Verification

Run all revision-3 contract inbox-reading fixtures, including accepted representations, D63 routing, and malformed/bounded inputs. Use real PostgreSQL and independent connections/processes for same-transaction receive-record/queue/aggregate/reservation, rollback/retry, existing-record-without-job, multiple-Profile independence, concurrent quota/rate contention, and exact response boundaries. Verify signature/key-owner evidence, no Ory dependency, raw-byte identity, no object URL fetch, no unlinked body persistence, and no sensitive/high-cardinality log fields. Exercise OpenAPI regeneration, empty and populated migration paths, relevant relation/domain-block regressions, format/lint/build/tests without DB skip, and `git diff --check`. Record I1 performance measurements and the S1 prerequisite decision; targets are not passing results unless actually measured.

## Knowledge Maintenance (G461)

- Intent placement: existing `intents/emumet/features/post-relay/overview.md`, with decisions and acceptance writeback to `decisions.md` and `acceptance.md`.
- ADR candidate: none; this implements approved contract and decisions.
- Diagram candidate: none.
- Docs update: required; planned child path `docs/post-relay-operations.md`. At closeout, cite the actual path if S1 landed documentation elsewhere.
- Closeout learning: required; record actual I1 routing, atomic admission, performance results, D63 handling, and whether S1's merge/performance decision permitted activation.

## Guide Reachability (G645)

No role-facing surface is added; the existing protocol inbox is not a human operator guide surface.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

The child implementation PR targets `main` and must not merge or enable inbox forwarding until S1 is merged. Record the actual implementation base SHA after dependencies are available.
