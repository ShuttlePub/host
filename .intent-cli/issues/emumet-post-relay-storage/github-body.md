# emumet-post-relay-storage

## Goal

Implement Emumet's P1 dedicated PostgreSQL post-relay storage: transactional admission/capacity reservations, durable lease and fencing state, retry/terminal retention data, shared admission limits, and cancellation cleanup integrated with home-link lifecycle. Add a server operator command that reports physical database capacity. Do not implement inbox activation or the HTTP delivery sender.

## Why This Slice Exists Now

The approved P1 plan orders storage after the home-link lifecycle (L1) and before delivery (S1) or inbox activation (I1). L1 has three unlink paths—owner API, Account deactivation, and Account projector—and exposes a lifecycle participant within their transaction. Its Postgres cancellation participant is currently a no-op. Q1 must make cancellation, body cleanup, and logical capacity release durable before later units can enable enqueue or sending.

## Current Observed State

The approved Emumet P1 plan and canonical post-relay contract v1 revision 3 define the queue, retention, lifecycle and admission rules, but this Q1 storage unit has not been implemented. L1 is represented by Emumet issue #117 and PR #120; PR #120 is currently unmerged. Its `kernel::interfaces::home_link::LinkCancellationParticipant` is called inside the transaction on all three unlink paths, while driver `PostgresLinkCancellation` is currently a no-op. Q1 must wait for L1 to merge before implementing against that interface.

## Accepted Baseline You May Assume

- Implement against the latest `ShuttlePub/Emumet` `main` at start and record the actual full 40-character base SHA in the PR. The plan's inspected baseline `1259c731af496bb09ae11286a9b869b132a88f4d` is historical context, not the implementation base.
- The canonical contract is `ShuttlePub/host/intents/shuttlepub/contracts/emumet-post-relay/`, v1 revision 3. The Emumet `docs/contracts` copy is pinned to a host commit and is not independently edited.
- C0 is Emumet issue #114. K1 is issue #116 and is independent. L1 is issue #117 / PR #120 and is a hard prerequisite. Do not start Q1 implementation until L1 PR #120 is merged and the current main exposes its lifecycle interface.
- Use the contract's dedicated `post_relay_jobs`, bounded attempts, quarantine/dead-letter bodies, body-free audits, fixed counters and shared capacity/admission state; do not reuse or change existing Profile-delivery tables or retry policy.
- Apply DC-01/02/05/06/07/10/15/16/18/19. Reserve additive migration timestamp `20261122000300`.
- The initial limits/timeouts below are targets to verify, not measured facts.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/, application/, driver/, server/, migrations/`

Target part: dedicated post-relay storage, transactional reservation/admission ports and adapters, lifecycle cancellation, shared rate/capacity controls, migration `20261122000300`, and operator capacity reporting.

## In Scope

- Add dedicated storage and ports for immutable envelopes/jobs, bounded attempts, quarantine, audits, fixed counters, admission-rate state, logical row/byte reservations, leases/fencing, expiry and purge.
- Keep the contract's one shared body budget for unfinished jobs plus quarantined envelopes: 100,000 / 20 GiB globally and 2,000 / 512 MiB per Profile. Moving an accepted job to quarantine cannot count it twice. Reserve future quarantine, at most 16 bounded attempts, and one bounded terminal summary at admission.
- Preserve terminal behavior: success and cancellation delete job/attempt rows and release unused reservations without a per-delivery terminal row; permanent failure and 72-hour expiry retain the unchanged envelope for 30 days plus one bounded body-free summary for 30 days. Bound unlinked aggregates and operator audit data.
- Implement contract-aligned response classification, exponential backoff with jitter, fixed 72-hour expiry, lease/fencing, and stale-token protection. Persist the send-authorization boundary; do not implement an HTTP sender.
- Implement shared PostgreSQL rate limiting and capacity reservations so multiple processes cannot exceed per-Profile/global row and byte limits.
- Integrate `kernel::interfaces::home_link::LinkCancellationParticipant` with `PostgresLinkCancellation` in the same transaction used by all three L1 unlink paths. An unlink/deactivation invalidates the link generation, disallows new sends/retries, deletes queued and quarantined bodies and releases logical capacity; stale workers cannot restore them. Preserve L1's common lock order and gate.
- At the start of Q1, measure real-DB cancellation of a Profile at the full 2,000-item / 512-MiB limit and deactivation of an Account with multiple Profiles. Record profile/job counts, bytes, environment, statement and full-transaction timings against §5.4's 3-second statement / 5-second transaction budgets. If physical deletion does not fit, invalidate the link, prevent new send/retry authorization and logically release capacity in the unlink transaction, then physically delete in bounded batches. Prove after unlink that no send or redelivery occurs and that DC-06/DC-16 remain satisfied. Record the selected strategy.
- Put unlinked time-bucket aggregation in a separate bounded reserve from job/quarantine reservations, or calculate and document a safe aggregate cap including Profile population. Demonstrate that exhaustion of unlinked aggregates does not block admission for a linked Profile.
- Add an operator-only `server capacity report` (or equivalent) command that writes available physical DB bytes, availability ratio, and sample time to shared capacity state. Do not add an HTTP management API. The command must not apply migrations and must refuse incompatible schema versions. Missing/stale capacity is unknown and stops new admission. T1 supplies the capacity provider in compose/E2E.
- Add only additive migration `20261122000300`. Test empty and supported pre-change databases.
- Keep the inbox disabled; I1 owns inbox parsing and activation. Keep T1's compose/E2E provider outside this unit.

## Out Of Scope

- Enabling the inbox route, parsing ActivityPub input, or wiring accepted inbox requests (I1).
- HTTP delivery sender/worker, automated delivery, operator redelivery/discard, or full operational runbook (S1/T1).
- ShuttlePub production receiver, P2 link-state checking, K1 identity/signing-key work, Ory/Hydra configuration, or modifying the canonical contract.
- HTTP admin/capacity API, capacity-source implementation in compose/E2E (T1), and changes to existing Profile delivery.
- Automatic early deletion of accepted bodies for capacity relief, or any bypass of L1's cancellation gate/lock order.

## Standalone Child Issue Contract

Implement dedicated Emumet P1 post-relay PostgreSQL storage against canonical contract v1 revision 3 and DC-01/02/05/06/07/10/15/16/18/19. Admission reservations must be atomic and enforce shared global and per-Profile row/byte limits across processes. Jobs and quarantine share one body budget; accepted bodies reserve bounded attempt and terminal-summary capacity. Preserve retry/expiry/retention rules, delete success/cancel attempts and bodies without per-delivery terminal rows, retain only bounded quarantine/audit data for failures, and prevent stale workers from changing terminal state or capacity. Integrate `PostgresLinkCancellation` into L1's same-transaction cancellation participant so all three unlink paths prohibit new sends/retries, remove queued/quarantined bodies and release logical capacity. Before implementation, measure full-capacity cancellation for a 2,000-item/512-MiB Profile and a multi-Profile Account against 3-second statement/5-second transaction budgets; if needed, logically invalidate/release in the unlink transaction and physically purge in bounded batches, with real-DB proof of no post-unlink send/redelivery. Isolate unlinked aggregates so their exhaustion cannot block linked admission. Add a migration at `20261122000300` and a server operator capacity-report command that publishes available bytes, ratio and timestamp without an HTTP API or migration side effects, rejects incompatible schema, and treats missing/stale data as unknown. T1 supplies test-environment capacity reporting. Do not enable the inbox or implement delivery sending.

## Acceptance Criteria

- [ ] A dedicated post-relay repository/port and PostgreSQL tables persist jobs/envelopes, bounded attempts, quarantine, body-free audits, fixed counters, shared admission limits and capacity reservations, separate from existing Profile delivery.
- [ ] Admission writes its required receipt/undo-defense data, job or unlinked aggregate and all needed reservations in one transaction. Q1 does not enable an inbox route.
- [ ] Concurrent real-DB admission cannot exceed global limits (100,000 items / 20 GiB body budget) or Profile limits (2,000 / 512 MiB). The job-plus-quarantine body budget is shared and a job-to-quarantine transition does not double count.
- [ ] Future quarantine, at most 16 bounded attempt rows and one bounded terminal summary are reserved at admission. Success/cancellation delete job and attempts, release unused reservations and leave no per-delivery terminal row. Permanent failure/72-hour expiry move the unchanged envelope to 30-day quarantine and preserve one body-free summary for 30 days.
- [ ] Retry classifications/backoff, absolute 72-hour deadline, lease/fencing and send-authorization persistence follow the canonical contract. A stale token cannot change result, body or capacity. No HTTP sender is introduced.
- [ ] `PostgresLinkCancellation` implements L1's lifecycle participant within the transaction for owner unlink, Account deactivation and Account projector. Once unlink/deactivation commits, no new send/retry authorization is possible; queued and quarantined bodies and logical reservations are removed. Stale results cannot resurrect them; common lock order is preserved.
- [ ] Before implementation, full-capacity Profile cancellation and a multi-Profile Account deactivation are measured on real PostgreSQL. Results include environment, profile and row counts, bytes, statement duration and transaction duration, and are compared to 3-second statement / 5-second transaction limits. If either deletion path does not fit, the bounded physical-delete fallback is implemented and tests prove immediate link invalidation/no new send or redelivery/logical capacity release before physical batches. The selected approach is documented.
- [ ] Unlinked aggregation uses a separate bounded reserve or a documented Profile-population-based safe limit. Tests exhaust that budget and prove linked Profile admission still succeeds; unrecordable unlinked requests do not receive 202.
- [ ] Shared rate limiting and capacity reservation work across multiple processes. Per-Profile limits produce 429 + Retry-After; global/audit/physical/unknown-or-stale capacity limits produce 503 + Retry-After. No per-rejected-request audit rows are added.
- [ ] An operator-only `server capacity report` command writes available DB bytes, available ratio and sample time to shared capacity state. It adds no HTTP API, runs no migration, refuses an incompatible schema version, and treats unset/stale data as unhealthy. T1 provides the compose/E2E test source.
- [ ] Migration `20261122000300` is additive and tested from an empty database and the supported pre-change schema. Required database tests are not skipped; rollback/recovery does not silently lose accepted bodies.
- [ ] Injected-time tests cover 72-hour expiry, 30-day quarantine/audit expiry and purge without wall-clock waiting. Observability exposes bounded counts/bytes, oldest receipt age, purge/retention failures, reservations, throttling and fixed success/cancellation counters without payloads, secrets, cookies, auth headers, receiver bodies or arbitrary IDs in logs/audit/metric labels.
- [ ] Tests show successful delivery volume does not increase retained rows proportionally; attempts disappear on success/cancel; unlinked aggregates stay bounded; capacity/retention inconsistencies are observable; concurrent reservations remain correct.
- [ ] No inbox activation, HTTP admin API, sender/worker, S1 redelivery/discard command, ShuttlePub receiver, P2 behavior, contract revision, or existing Profile-delivery policy change is included.

## Verification

Run real PostgreSQL tests with separate connections/processes for admission/reservation races, shared rate limits, leases/fencing, three-path unlink cancellation, full-capacity and multi-Profile cancellation, terminal retention/purge, stale/missing physical capacity, schema-version mismatch, and unlinked-budget isolation. Use injected time/randomness for 72-hour/30-day boundaries. Test migration `20261122000300` from empty and supported pre-change databases. Record full-capacity cancellation setup and timings, selected strategy, and the no-send/no-redelivery proof if using bounded physical deletion. Run relevant formatting, lint, build and test checks and `git diff --check`. Database skips are not passing results.

## Related Links

- C0 contract issue: https://github.com/ShuttlePub/Emumet/issues/114
- L1 home-link issue (hard dependency): https://github.com/ShuttlePub/Emumet/issues/117
- L1 PR (must merge before Q1 implementation): https://github.com/ShuttlePub/Emumet/pull/120
- K1 instance identity (independent): https://github.com/ShuttlePub/Emumet/issues/116
- Canonical post-relay contract v1 revision 3: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/contracts/emumet-post-relay/v1.md
- P1 decisions D61-D67: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md
- Existing post-relay overview: https://github.com/ShuttlePub/host/blob/main/intents/emumet/features/post-relay/overview.md
- Existing post-relay decisions: https://github.com/ShuttlePub/host/blob/main/intents/emumet/features/post-relay/decisions.md
- ADR 0003 quarantine exception: https://github.com/ShuttlePub/host/blob/main/intents/emumet/decisions/0003-delegated-signing.md

## Knowledge Maintenance

- Intent placement: existing `intents/emumet/features/post-relay/`; no new intent node.
- ADR: no new ADR; the 30-day quarantine is already the limited exception in ADR 0003.
- Diagram: none expected.
- Docs: document `server capacity report` and its schema-version/freshness behavior; T1 owns the compose/E2E capacity provider and integrated operational procedure.
- Closeout writeback is required: record real cancellation timings and the selected deletion strategy, the unlinked-aggregate budget, and the capacity-report interface in the existing post-relay decisions/acceptance.

## Guide Reachability

This adds an operator-facing `server capacity report` command. Operators reach it via `server --help` / `capacity report --help`; it writes physical DB-capacity state for shared relay admission and does not provide an HTTP management API.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open the child PR against `main` after L1 PR #120 is merged.
