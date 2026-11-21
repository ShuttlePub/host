# emumet-profile-inbox-relay: Profile inbox relay intake

## Goal

Connect Emumet's existing Profile inbox to Q1's durable post-relay admission path. Preserve signature and relation-processing behavior while applying canonical bounded Activity reading/routing, atomically saving receive state and relay admission, and measuring actual intake under quota contention. This implementation unit targets Emumet only.

## Why This Slice Exists Now

The approved P1 dependency order is C0/K1/L1 → Q1 → S1 → I1. C0 provides the canonical contract and inbox fixtures; K1/L1 provide instance identity and lifecycle behavior; merged Q1 (#122) provides durable admission and quota ports. S1 is being implemented under issue #123. I1 may be prepared after Q1, but it must not merge or enable forwarding until S1 is merged. If S1 misses its delivery target, the lead's decision is required before I1 activation.

## Current Observed State

- C0 issue #114 / PR #115, K1 issue #116 / PR #119, and L1 issue #117 / PR #120 are merged.
- Q1 issue #121 / PR #122 is merged and supplies durable admission/quota ports; it does not enable inbox forwarding.
- S1 issue #123 is open and its delivery PR is in progress. S1's sender and performance decision are prerequisites to I1 merge/activation.
- The approved plan inspected Emumet `main` at `1259c731af496bb09ae11286a9b869b132a88f4d`. Record the actual 40-character implementation base SHA after required dependency changes are present.
- Canonical contract: host `intents/shuttlepub/contracts/emumet-post-relay/`, v1 revision 3, including inbox-reading fixtures. Emumet `docs/contracts/` is a pinned snapshot, not an independent source.

## Accepted Baseline You May Assume

- Apply the approved P1 plan's third edition, §§3.1-3.2, 4, 6.4, 6.6, 7.3 (I1 intake measurement), 8 I1, 9, 10.3 and 11.1, and final constraints DC-01/02/04/07/08/16/19.
- Use additive migration timestamp `20261122000500`; do not renumber or change earlier migrations.
- Q1 owns durable admission, shared PostgreSQL quota/rate enforcement and capacity status. I1 integrates those ports into the existing inbox and measures intake; it must not create a process-local substitute.
- User decision ② / D63: exclude Follow/Block themselves and Undo/Accept/Reject only when every reference certainly identifies a known Follow/Block. Unknown, absent, empty or mixed references are forwarded; do not fetch object URLs; an early-Undo guard is not evidence of a stored Follow. Two or more recognized relation terms in `type` return 400 with no relationship mutation; extension types alone do not reject or exclude.
- S1 issue #123 is in progress. Do not merge I1 or enable forwarding until S1 merges; if S1's delivery target is not met, wait for the lead's decision before activation.
- The §7.3 throughput figures are targets, not measured facts or unconditional production SLOs.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/, application/, driver/, server/, migrations/, openapi.json`

Target part: I1 Profile inbox relay intake — bounded raw Activity reading/evidence, contract routing, atomic transaction-participating receive/queue admission, response/OpenAPI integration, migration `20261122000500`, and measured intake performance.

## In Scope

- Use the existing Profile inbox route and signature-verification flow. Return the key/owner actually used as bounded verification evidence; preserve signer-to-actor checks. Do not require typed Activity conversion for forwarding or fetch external JSON-LD contexts.
- Apply contract revision 3 §8 entry and extraction rules, bounds, MIME behavior, duplicate-key rejection at every depth, and schema-compatible actor/id/type extraction.
- Route without a type allowlist. Preserve Follow/Block relation handling, domain-block behavior and early-Undo protection. Apply D63's known-reference-only exclusion for Undo/Accept/Reject, with no object URL fetch.
- In one transaction, persist the receive record, required early-Undo protection, Q1 job or body-free unlinked aggregate, and Q1 capacity/rate reservation. Return 202 after commit. Do not suppress relay because of a `Duplicate` receive record alone.
- Preserve original Activity bytes and evidence. Accept documented representation variants; do not invent an Activity id. Do not persist an unlinked request body or remote-selected identifiers.
- Reuse Q1 shared PostgreSQL admission/quota/rate state and response mapping: Profile limit 429 with Retry-After, global/audit/unknown or insufficient physical capacity 503 with Retry-After, storage failure retryable 5xx.
- Measure I1 intake at linked/unlinked and concentrated/distributed Profile loads, including shared quota/hour-bucket contention. Record environment, rate, CPU/RSS, and DB/connection/lock waits.
- At closeout, extend the host post-relay intent evidence and operational documentation with actual routing, atomicity, metrics, and the S1 activation decision. Planned documentation target: `docs/post-relay-operations.md`; if S1 uses a different actual path, cite the actual path in closeout evidence.

## Out Of Scope

- ShuttlePub production receiver, verification, deduplication/storage; P2 link-state or generation checks; K2 key rotation/revocation; contract revision; dev-image publication.
- New Activity-type allowlist, new Follow/Block policy, changes to existing Profile delivery/retry policy, or weakened signature, relation, domain-block or early-Undo handling.
- S1's HTTP sender, worker and recovery commands; changes to Q1's admission, quota or physical-capacity ports.
- Ory/Hydra or unrelated service changes. Do not modify `ory/hydra/hydra.yml`.
- Inbox forwarding merge/activation before S1 merges; if S1's delivery target is unmet, activation waits for the lead's decision.

## Standalone Child Issue Contract

Implement I1 Profile inbox relay intake in `ShuttlePub/Emumet` against canonical contract v1 revision 3 and DC-01/02/04/07/08/16/19. Use Q1's merged transactional admission and shared PostgreSQL quota/rate ports. Preserve original raw Activity bytes, signer verification, existing relation/domain-block behavior and early-Undo protection. Apply D63 exactly: only Follow/Block and Undo/Accept/Reject certainly referencing known Follow/Block are excluded; unknown/empty/absent/mixed references forward, no object URL is fetched, and early-Undo state alone is not Follow evidence. Persist receive state, guard, queue or body-free unlinked aggregate and reservation atomically; acknowledge 202 only after commit. Measure linked/unlinked intake with concentrated/distributed Profile load and quota contention. Use additive migration `20261122000500`; do not change prior migrations, Ory/Hydra, existing Profile delivery or the canonical contract. Do not merge I1 or enable forwarding before S1 merges, and if S1 misses its target wait for the lead's decision.

## Acceptance Criteria

- **I1-1 — contract and evidence:** retain current signature authentication and actual key/owner evidence. Apply contract §8 bounds, MIME, duplicate-key, actor/id/type and JSON rules. No typed Activity conversion is required for relay forwarding; no external context fetch.
- **I1-2 — D63 routing:** no type allowlist. Follow/Block are excluded from forwarding while existing relation handling remains. Undo/Accept/Reject are excluded only if all references certainly identify stored or embedded Follow/Block; unknown URL, absent object, empty array, or any mixed array forwards the whole Activity. No object URL fetch; early-Undo guard alone is not a stored Follow. Two or more recognized relation terms in `type` return 400 `ambiguous_relation` and leave relations unchanged. Extension-type co-annotation alone neither rejects nor excludes.
- **I1-3 — atomicity:** receive record, required early-Undo protection, Q1 job or body-free unlinked aggregate, and capacity/rate reservation share one transaction. Return 202 only after commit. A `Duplicate` result alone cannot suppress admission. Failure after receive-record/guard rolls back; retry can enqueue; a pre-existing receive record without a job does not suppress enqueue; a lost post-commit response may duplicate but cannot silently lose relay. Same Activity sent to multiple Profiles remains independent.
- **I1-4 — bytes and variants:** preserve original Activity bytes; do not invent an id. Cover Create, Update, Delete, Like, Announce and extensions; `to`/`cc` strings, actor objects, missing id, allowed `application/ld+json`, object arrays, all-depth duplicate keys, type arrays, header-evidence omission, and all revision-3 inbox-reading fixtures. Unlinked reception stores no body or remote-selected identifiers.
- **I1-5 — quota/errors:** use Q1 shared PostgreSQL state; Profile limits map to 429 + Retry-After, global/audit/physical-capacity unavailable or unknown maps to 503 + Retry-After, and storage failure to retryable 5xx. Concurrent callers cannot bypass shared reservations or use a process-local competing limiter.
- **I1-6 — privacy and measurement:** no Activity body, private-key material, Cookie, authorization header or peer response body in logs/audit/metrics/errors; use fixed labels, not Activity id, receipt or actor. Measure linked/unlinked and concentrated/distributed Profiles with shared quota/hour-bucket contention, recording environment, requests/second, CPU/RSS and DB/connection/lock wait. Compare with the plan's 100 requests/second target; do not claim an unconditional production SLO.
- **I1-7 — integration:** only additive migration `20261122000500`; test empty and populated DB paths without changing prior migrations. Verify generated OpenAPI and existing relation/domain-block/signature/early-Undo regressions. A required DB test skipped is not a pass.
- **I1-8 — activation gate:** I1 does not merge or enable inbox forwarding before S1 merges. If the S1 delivery target is unmet, obtain the lead's decision before I1 merge/activation.

## Verification

Run the full contract inbox-reading fixture set and real-PostgreSQL tests for transaction rollback/retry, pre-existing receive record without a job, distinct Profiles, shared quota/rate contention and concurrent reservations. Verify signature/key-owner evidence, raw-byte preservation, no Ory or external/object URL fetch, no unlinked body persistence, exact 202/429/503/retryable-5xx mapping, and no high-cardinality or sensitive log fields. Check empty and populated migration paths, OpenAPI regeneration, existing Follow/Block/domain-block/early-Undo behavior, relevant fmt/lint/build/tests without DB skips, and `git diff --check`. Record actual intake metrics and the S1 merge/target decision; a plan target is not a result.

## Related Links

- C0 issue #114 / merged PR #115: https://github.com/ShuttlePub/Emumet/pull/115
- K1 issue #116 / merged PR #119: https://github.com/ShuttlePub/Emumet/pull/119
- L1 issue #117 / merged PR #120: https://github.com/ShuttlePub/Emumet/pull/120
- Q1 issue #121 / merged PR #122: https://github.com/ShuttlePub/Emumet/pull/122
- S1 issue #123 (delivery PR in progress): https://github.com/ShuttlePub/Emumet/issues/123
- Canonical contract v1 revision 3: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/contracts/emumet-post-relay/v1.md
- Decisions D61-D67, especially D63: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md
- Existing post-relay intent: https://github.com/ShuttlePub/host/tree/main/intents/emumet/features/post-relay
- Approved P1 implementation plan, third edition: `thread-rd4012ty`, run `run-01m7yc2nagh0z7g2jh14g6qb8x` (§§3.1-3.2, 4, 6.4, 6.6, 7.3, 8 I1, 9, 10.3, 11.1).

## Knowledge Maintenance

- Intent placement: existing `intents/emumet/features/post-relay/overview.md`; required decisions/acceptance writeback to `decisions.md` and `acceptance.md`.
- ADR candidate: none; this implements approved contract and decisions.
- Diagram candidate: none.
- Docs update: required, planned target `docs/post-relay-operations.md`. At closeout, cite actual path if S1 landed documentation elsewhere.
- Closeout writeback expected: yes; record actual routing, atomic admission, measured results and S1 activation decision.

## Guide Reachability (G645)

No role-facing surface is added; the protocol inbox is not a human operator guide surface.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open the child implementation PR against `main`. It must not merge or enable inbox forwarding until S1 merges.

## Additional Required Guidance

- Keep implementation and tests in `ShuttlePub/Emumet`; do not modify host intent/packet/queue state from the child repository.
- Do not modify `ory/hydra/hydra.yml`.
- The child PR must include `Closes #<this I1 issue number>` after issue publication (G311).
- Preserve approved constraints DC-01/02/04/07/08/16/19 and contract revision 3. Propose a separately approved contract change if a real gap is found.
- If S1's delivery target is unmet, wait for the lead's decision before merging or activating I1.
