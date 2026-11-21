# emumet-post-relay-storage Implementation Packet

## Goal

Implement the dedicated PostgreSQL storage and transactional capacity controls for Emumet's P1 post-relay queue, including durable leases/fencing, terminal retention, shared admission limits, Q1's cancellation participant for L1's lifecycle transactions, and a server operator command that reports physical database capacity. Do not implement inbox activation or an HTTP sender.

## Why

The approved P1 plan places Q1 after L1 and before delivery/inbox activation. L1's unlink API, Account deactivation path, and projector already call a lifecycle participant in their transaction, but the Postgres participant is currently a no-op. Q1 must make cancellation and body/capacity cleanup durable before any later unit enables enqueue or delivery.

## Scope

- Implement dedicated `post_relay_jobs`, bounded attempts, quarantine/dead-letter bodies, audits, fixed counters, quota/reservation state, and ports/adapters.
- Ensure the queue-to-quarantine transition shares one common job/quarantine body budget and does not double-reserve.
- Implement contract-aligned backoff, expiry, cancellation, purge, terminal cleanup, fencing, and multi-process shared admission rate/capacity controls.
- Connect `kernel::interfaces::home_link::LinkCancellationParticipant` to the Postgres cancellation implementation. On all three L1 unlink paths, invalidate sending/retries, remove queued and quarantined bodies, and release logical capacity in the same transaction (or use the documented bounded-batch physical-delete fallback only if the required real-DB timing measurement fails).
- At Q1 start, measure deletion/cancellation at the full per-Profile limit and for a multi-Profile Account against §5.4's 3-second statement / 5-second whole-transaction budgets. Record setup and results; if full physical deletion misses the bound, atomically invalidate the link, prevent send/retry, release logical capacity, and delete bodies in bounded batches after the transaction.
- Isolate bounded unlinked-aggregate storage from job/quarantine reservations, or justify a Profile-population-based safe limit; prove that its exhaustion does not block linked Profile admission.
- Add a server operator-only `capacity report` subcommand to publish available DB bytes, ratio, and sample time into shared capacity state. It must refuse a schema-version mismatch and must not run/apply migrations. No HTTP management API.
- Reserve additive migration `20261122000300`. T1 owns the physical-capacity provider in compose/E2E environments.
- Preserve the canonical v1 revision 3 contract; leave I1 inbox activation, S1 delivery sender/operator redelivery, and the ShuttlePub production receiver to later units.

## Dependencies and baseline

- Blocked on L1 (`emumet-home-link`, Emumet issue #117, PR #120), which is currently unmerged. Implement only after L1's lifecycle port, gate, and lock order are available and merged.
- C0 (`emumet-p1-relay-contract`, issue #114) defines canonical envelope/retry/retention rules. K1 (issue #116) is independent.
- Use the latest Emumet `main` at implementation start; record its full SHA in the PR. The plan's inspected baseline `1259c731af496bb09ae11286a9b869b132a88f4d` is historical context, not the implementation base.
- Canonical text/schema/fixtures: host `intents/shuttlepub/contracts/emumet-post-relay/`, v1 revision 3. Approved plan: third edition, §4.3, §5.4, §6, §8 Q1, §9, §10, §11.1; apply DC-01/02/05/06/07/10/15/16/18/19.

## Out of scope

- Inbox parsing/transaction activation (I1), HTTP sender/worker or automatic delivery (S1), operator redelivery/discard commands (S1), and ShuttlePub production receiver.
- HTTP capacity/admin API; any migration run by the capacity-report command.
- K1 instance identity/signing-key changes, P2 behavior, Ory/Hydra changes, post-relay contract revision, and changes to existing Profile delivery.
- Implementing compose/E2E capacity sampling; T1 supplies that provider.

## Verification

- Start with real PostgreSQL measurements for a 2,000-job / 512-MiB Profile and a multi-Profile Account cancellation; record actual data and meet §5.4 timeouts or test the bounded physical-delete fallback and post-unlink no-send/no-redelivery invariants.
- Run real-database tests with separate connections/processes for concurrent admission, row/byte reservation limits, lease/fencing races, link cancellation across all three paths, retention/purge, multi-Profile cancellation, shared rate limiting, capacity staleness/schema mismatch, and unlinked-budget isolation. Required DB tests may not be skipped.
- Use injected time/randomness for 72-hour and 30-day boundaries, expiry, backoff, and audit behavior.
- Verify terminal row counts and capacity accounting match §6.3/§6.4; success/cancellation do not leave per-delivery terminal rows or grow rows with success volume.
- Verify no payload, secret, cookie, auth header, arbitrary receipt/actor value, or receiver response body leaks to logs, audits, or metric labels.
- Test migration `20261122000300` from empty and supported pre-change databases; assess rollback without dropping accepted job bodies.
- Run the relevant formatting, lint, build, test checks and `git diff --check`.

## Knowledge Maintenance (G461)

- Intent placement: existing post-relay overview/decisions/acceptance; no new intent node.
- ADR: no new decision; the 30-day quarantine exception is already in ADR 0003.
- Diagram: none expected.
- Docs: document the capacity-report command and schema/freshness behavior; T1 supplies the compose/E2E capacity provider and integrated operational procedure.
- Closeout writeback is required: record real cancellation timing/strategy, unlinked aggregate budget, and capacity-report behavior in the existing host feature decisions/acceptance.
- Guide reachability: the `server --help` / `capacity report --help` surface routes operations staff to the capacity-state writer.
