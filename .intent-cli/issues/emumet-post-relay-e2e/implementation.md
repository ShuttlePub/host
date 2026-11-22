# emumet-post-relay-e2e Implementation Packet

## Goal

Add the P1 post-relay integration E2E, alarm/failure-injection and operating evidence in
`ShuttlePub/Emumet`. The suite must use real Kratos and Hydra, source-built service and release
images, exercise the full accepted P1 contract against a mock receiver that has no link-state
ledger, supply real PostgreSQL physical-capacity information to the existing operator command,
and validate recovery/operator behavior. This packet defines work for the child repository; no
implementation is performed in the host repository.

## Why

The approved P1 plan makes an end-to-end run the final proof that the individually merged
contract, identity, link, storage, delivery and inbox units work together. I1 (#126) and B1
(#127) are not yet merged at packet creation. T1 support code can be prepared earlier, but
acceptance must run after those integrations are on the latest `main`. The tests must not turn
the P1 trust boundary into a P2 link-state check or mistake an Emumet container's free space for
the PostgreSQL volume's capacity.

## Scope

- Implement `server/tests/e2e_post_relay.rs` and bounded test support/process control, scripts,
  compose/CI wiring, E2E failure injection, operational alert assertions and
  `docs/post-relay-operations.md` updates.
- Start real Kratos and Hydra for authentication and link registration; build Emumet from source.
  Use a mock HTTP receiver for the ShuttlePub endpoint. The receiver validates the P1 envelope
  and HTTP signature but has no link registry and accepts trusted `link_id` /
  `link_generation` claims without P2 state synchronization.
- Cover all 30 mandatory cases in §11.1 and all applicable §11.2 regression, load, capacity,
  retention, physical-storage, alert, recovery and documentation checks.
- As T1's assigned test-environment provider, measure PostgreSQL data/WAL/tablespace volume
  capacity (or an equivalent DB-volume metric) and update the existing
  `server ... capacity report` input at least every 30 seconds. Prove that information older
  than 90 seconds, missing information and unsafe capacity fail closed, and document the
  source, thresholds and recovery procedure.
- Run the release-image operator command against non-empty recovery state while a normal
  delivery worker remains active. Build that image from source and do not publish it.
- Record hardware/runtime/build/DB/TLS-or-HTTP conditions, throughput, resource use, queue and
  DB waits, lock/connection behavior, alerts, and limitations in the operations/measurement
  documentation.

## Out of scope

- Implementing relay contracts, identity, links, queue/storage, sender/worker, inbox intake or
  Ory-independent runtime beyond the integration support specifically owned by T1.
- ShuttlePub production receiving/persistence, P2 link-state or generation validation, link
  synchronization, K2 rotation/revocation E2E, or rotation controls.
- Publishing a dev image, publishing anything to GHCR, creating image tags/releases, or
  relying on a previously published dev image.
- Changes to existing Profile delivery policy, login/consent semantics, authentication policy,
  migrations unrelated to approved additions, or `ory/hydra/hydra.yml`.
- Treating test/benchmark results as a production SLO or certification of ShuttlePub's
  production receiver.

## Required verification

The published issue contains the full §11.1 checklist (30 cases). Run the suite after I1 and B1
are integrated. Also:

- Preserve Profile actor, WebFinger, Follow, domain-block, login/consent and authentication
  regressions; regenerate/compare OpenAPI as applicable. A required database check skipped is
  not a pass.
- Exercise real signature creation and instance-key retrieval/verification over HTTP, exact
  envelope/raw-body byte stability, the mock receiver's P1 trust boundary, retries, forced
  process stops, the three unlink/lifecycle revokers, and operator recovery.
- Verify physical capacity reporting is sourced from the DB volume, written at least every
  30 seconds, fresh for no more than 90 seconds, and obeys the initial 10 GiB / 10% stop
  thresholds with recovery hysteresis. Inject missing, stale, low-capacity and recovery cases.
- Verify alerts for 80% warning / 95% critical body or audit capacity, sustained quota 429/503
  and quarantine-full admission rejection, repeated 401, deadline-near backlog, purge lag,
  reservation mismatch, physical-capacity loss/age/threshold, DB lock/connection waits and
  projector failures. Test alert diagnosis and documented recovery.
- From a source-built release image, run operator status/preview and a non-empty bounded
  redelivery or discard operation while the worker is active; verify exclusion/fencing,
  audit, outcome and remaining capacity. The image must not need source/Cargo at runtime.
- Measure about 64 KiB and maximum-body (~1.34 MiB envelope) local HTTP deliveries, serial and
  bounded-concurrent workers, shared quota/rate contention and an unhealthy isolated origin.
  Record environment and results; check the plan's 100/s and 20/s goals, 80% healthy-origin
  fairness, 10-minute stability, bounded RSS/connections/live rows, and that KDF work does not
  scale per delivery. Do not describe unmeasured goals as achieved.
- Run the focused compose/E2E and CI checks, format/lint/build as applicable, and
  `git diff --check`.

## Knowledge Maintenance (G461)

- Intent placement: `intents/emumet/features/post-relay/overview.md` and `acceptance.md`; no
  new intent node.
- ADR candidate: none; this validates the approved plan and DC-01 through DC-19.
- Diagram candidate: none.
- Docs update: required; update `docs/post-relay-operations.md` with the capacity source,
  30-second report cadence, 90-second freshness boundary, alert triage, recovery and measured
  versus unmeasured boundaries.
- Closeout learning: required; record the exact E2E cases/outcomes, capacity supplier and
  freshness behavior, alerts/recovery, release-image concurrency test, measured performance
  and exclusions in the intent acceptance and operations documentation.
- Guide reachability (G645): no new role-facing surface is added; the operations document
  update is to the established surface.

`improve` (G456 / G460) is the later safety net; packet-time maintenance is the normal path.
