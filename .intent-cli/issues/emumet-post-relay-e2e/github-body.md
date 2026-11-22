## Goal

Add the P1 post-relay end-to-end test suite and operating evidence in `ShuttlePub/Emumet`.
Exercise real Kratos and Hydra authentication/link registration, signed inbox intake through a
source-built Emumet service to a P1 mock receiver, the required recovery/failure cases, capacity
and alarm behavior, and release-image operator recovery. The receiver must not maintain or
require link state. This issue changes Emumet only.

## Why This Slice Exists Now

The P1 contract, instance identity, home link, storage, signed delivery and inbox/runtime
integrations are being delivered as separate slices; T1 is the acceptance boundary that proves
they work together and documents how to operate and recover them. C0, K1, L1, Q1 and S1 are
merged. I1 is PR #126 and B1 is issue #127, pending merge when this packet is published. T1
support code may be prepared earlier, but the acceptance suite must run only after I1 and B1
are integrated. Tests must retain the approved P1 trust boundary rather than requiring P2
link-state synchronization.

## Current Observed State

- The approved P1 plan assigns `server/tests/e2e_post_relay.rs`, AP/receiver mocks and process
  control, scripts/CI, release-image operator verification, operations documentation,
  measurement and alarms to T1.
- Q1 supplies `server ... capacity report` and its fail-closed capacity state; in the test
  environment, T1 owns the physical PostgreSQL-capacity supplier.
- S1 supplies the operator recovery command and delivery worker. T1 must prove that release
  image operation works while that worker is running.
- The T1 integration acceptance is not yet established. At implementation start, inspect the
  latest `ShuttlePub/Emumet` `main` and record its full 40-character base SHA; the planning
  investigation SHA is historical context only.

## Accepted Baseline You May Assume

- Follow the approved P1 implementation plan, third edition: §6.6; §8 T1 purpose, ownership
  and completion; §9; §10; and all of §11, including mandatory cases 1–30 and §11.2.
- Preserve final design constraints DC-01 through DC-19, especially DC-03/04/16/17/18/19.
  Under P1, the receiver trusts a configured Emumet's `link_id` and `link_generation` claims;
  it does not consult a link ledger or reject generations based on synchronized state.
- C0, K1, L1, Q1 and S1 are merged. I1 (#126) and B1 (#127) are prerequisites to final
  acceptance. Rebase/inspect latest `main` and record the actual full base SHA before
  implementation and again as required by the child PR process.
- Use real Kratos and Hydra for E2E authentication and link registration. Build Emumet/test
  images from source; do not rely on a published dev image. Do not publish to GHCR, create
  image tags, or create a release.
- T1 supplies PostgreSQL physical-capacity information in compose/E2E using the existing
  `server ... capacity report` command. Measure the database data/WAL/tablespace volume or an
  equivalent DB capacity metric, not the Emumet container filesystem. Update at least every
  30 seconds; information older than 90 seconds is stale and admission must fail closed.
- Run release-image operator recovery while a normal delivery worker is active. Rotation E2E
  is excluded. Do not modify `ory/hydra/hydra.yml`.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `server/tests/e2e_post_relay.rs, server/tests/, scripts/, .github/workflows/, docs/post-relay-operations.md`

Target part: P1 E2E harness, process/failure controls, source-built real-Ory test environment,
physical-capacity supplier, alarm/recovery verification, release-image operator test and
operations documentation.

## In Scope

- Implement `server/tests/e2e_post_relay.rs` and bounded test process/support code, mock AP
  receiver, scripts/CI and operations documentation.
- Start real Kratos and Hydra; register/authenticate a user and Profile link; send real signed
  inbound Activity through Emumet and verify transfer over HTTP.
- Have the test receiver validate the P1 envelope and instance signature without a link-state
  database. It must accept the trusted link ID/generation claims without P2 synchronization.
- Run all 30 mandatory cases below, including failures, restart/lease recovery, three revokers,
  capacity exhaustion, operations alarms and release-image recovery.
- Supply and test physical DB-volume capacity at a 30-second cadence with 90-second freshness,
  configured thresholds and recovery hysteresis; document the actual source and limitations.
- Build the tested/release image from source; verify the non-empty operator recovery path while
  a normal worker is running. Do not publish the image.
- Run §11.2 regression and measured-performance checks and document environment, actual
  results and exclusions.

## Out Of Scope

- ShuttlePub production receiver/persistence, P2 link-state validation/synchronization, K2 key
  rotation/revocation, and rotation E2E.
- Reimplementing C0/K1/L1/Q1/S1/I1/B1-owned production behavior or changing existing Profile
  delivery policy, auth/login/consent semantics, retry/lease/fencing or admission policy.
- Published dev images, GHCR publication, image tags or releases; tests that depend on a
  previously published dev image.
- Changes to `ory/hydra/hydra.yml`, unrelated migrations, or host packet/queue/intent state
  from the child repository.
- Claiming P1 mock E2E as ShuttlePub production acceptance or describing unmeasured goals as
  achieved SLOs.

## Standalone Child Issue Contract

Implement the T1 P1 E2E, operational alarm and recovery work in `ShuttlePub/Emumet` against
the approved third-edition plan and DC-01 through DC-19. Use real Kratos/Hydra and source-built
Emumet images, then exercise signed inbox transfer to a mock receiver that has no link-state
ledger and treats P1 link ID/generation as trusted Emumet claims. Run every mandatory case
below and the §11.2 regression/measurement checks after I1 (#126) and B1 (#127) are integrated.
As T1, provide physical PostgreSQL capacity in compose/E2E through `server ... capacity report`
at least every 30 seconds; stale means older than 90 seconds and must fail closed. Verify
capacity/failure alarms and recovery. Build a release image from source and run a non-empty
operator recovery action while a normal worker is active. Do not publish dev images/GHCR/tags/
releases; do not include rotation E2E or modify `ory/hydra/hydra.yml`.

## Acceptance Criteria

### T1 integration and boundaries

- **T1-1 — real Ory and delivery:** E2E starts real Kratos and Hydra, performs user
  authentication and link registration, submits a real signed Activity to Emumet and verifies
  the transfer through HTTP to a mock receiver.
- **T1-2 — P1 receiver:** the mock validates sender/instance identity, request signature,
  digest, date, schema and envelope, but has no link-state ledger. It accepts the configured
  Emumet's link ID/generation claims and does not impose P2 synchronization.
- **T1-3 — source-built test/release image:** tests build from source and run without relying
  on a published dev image. No GHCR publication, image tag or release is created.
- **T1-4 — capacity provider:** test compose/E2E samples physical PostgreSQL volume/DB capacity
  (not Emumet-container free space) and calls `server ... capacity report` at least every
  30 seconds. Missing/stale (>90 seconds)/unsafe capacity fails closed; thresholds,
  hysteresis and recovery are tested and documented.
- **T1-5 — operator concurrency:** from the source-built release image, execute a non-empty
  bounded operator redelivery or discard workflow while a normal delivery worker is running.
  Verify selection bounds, serialization/fencing, audit, result and remaining capacity; the
  image does not require source/Cargo at runtime. Rotation is not tested.
- **T1-6 — failure alarms and operations:** inject missing/stale/low physical capacity,
  quota/quarantine saturation, reservation mismatch, purge delay, deadline-near backlog,
  repeated 401, lock/connection wait and projector failure. Verify the specified warning/
  critical alerts, triage/recovery runbook, and that alert labels/logs contain no body,
  secrets, arbitrary Activity ID, receipt or actor.
- **T1-7 — regression and measurement:** preserve Profile actor, WebFinger, Follow,
  domain-block, login/consent and authentication regressions; compare generated OpenAPI.
  Measure the §7.3 / §11.2 workload and report environment, actual throughput, CPU/RSS,
  KDF, DB/connection/lock and queue wait, origin isolation, live-row and stability results.
  Required database tests skipped are not passing.
- **T1-8 — exact scope:** do not modify `ory/hydra/hydra.yml`, production receiver behavior,
  existing Profile delivery policy or unrelated auth behavior. No rotation E2E or image
  publication.

### Mandatory §11.1 E2E cases (all 30 required)

1. Real user authentication → Profile → link registration → signed inbox request → relay.
2. Preserve raw body bytes (including unknown fields, non-ASCII and whitespace).
3. Handle `to` as string, actor object, absent Activity ID, `ld+json` and array object.
4. Reject duplicate JSON keys at all levels; cover type arrays and oversized original headers.
5. Exclude Follow/Block and classify known versus unknown Undo/Accept/Reject references.
6. Preserve early-Undo defense and independence of delivery to separate Profiles.
7. Inject failure after receipt persistence and before job persistence; retry must not lose work.
8. Deliver one Activity independently to multiple Profiles.
9. Unlinked receipt produces bounded bucket audit only, with no stored body.
10. Verify 401/503 retry, 400/403/409 permanent failure and redirect rejection.
11. Receiver accepts then disconnects: retry the same receipt and unchanged envelope.
12. Stop after persistence, restart and recover through lease expiry/fencing.
13. Exercise P0–P4 and all three revokers (unlink, Account deactivation/command, projector) for
    both automatic and operator delivery.
14. A stalled HTTP response does not make unlink/deactivation/projector wait for that response.
15. Worker whose absolute send deadline expires after authorization does not send.
16. After relinking to another home, old jobs/quarantine never reach the new home.
17. Transfer preserves the same link; former owner cannot operate it.
18. Suspend, BAN, deactivate, reactivate; deactivation revokes even if the Profile row remains,
    and reactivation does not restore the old link.
19. Cover deactivate/reactivate in one projector batch, replay of an old event and protection
    of a newly registered link.
20. With Ory stopped/restarted or JWKS response withheld, verify the B1 Ory-independent
    listener/relay behavior and fail-closed protected APIs.
21. Race shared quota, cross-process rate limits and reservation enforcement.
22. Success/cancel leaves no job, attempts or per-delivery terminal row.
23. Verify quarantine and audit retention/expiry without extending the original deadline.
24. Exercise Profile-bulk redelivery/discard, operation audit and worker contention.
25. Full quarantine rejects new admission but does not automatically discard accepted bodies.
26. P1 receiver verifies successfully without any link-state table.
27. Reject mismatching origin, Host, Digest, Date and schema.
28. Redeliver an approximately 33-day-old `received_at` with a fresh valid outer signature.
29. Run the operator command from a source-built release image with a live worker; do not
    publish the image.
30. Verify logs, audit and metrics do not disclose body or secrets.

Use injected time for 72-hour and 30-day boundaries; do not wait those durations in wall time.

### §11.2 regression, performance and physical recovery

- Preserve Profile actor/WebFinger/Follow/domain-block and login/consent/authentication E2E;
  regenerate/compare OpenAPI. A skipped required DB test is a failure to verify.
- Run local real-HTTP measurements for ~64 KiB and ~1.34 MiB envelope, serial and bounded
  concurrency. Record hardware/runtime, release build, DB placement and transport conditions.
- Verify plan targets: ≥100 deliveries/s for ~64 KiB and ≥20/s for maximum-body workload on
  the stated 4-vCPU/8-GiB release setup; healthy origin retains ≥80% of its single-origin
  throughput when another origin stalls; sustain ≥10 minutes with stable RSS/connections/live
  rows; KDF work does not grow per delivery; a slow HTTP peer does not delay unlink.
- Include shared quota and hourly-bucket contention; verify successful delivery count does not
  cause proportional persistent rows. Check full quarantine reservations, logical/physical
  volume, WAL/MVCC/vacuum, capacity loss, purge lag, saturation alert and recovery.
- Verify initial physical admission stop (<10 GiB free or <10% free) with recovery hysteresis;
  sample/report at least every 30 seconds and fail closed after 90 seconds without a fresh
  report. Test 80% warning and 95% critical body/audit capacity, sustained 429/503, and the
  other alert conditions in §6.6.
- Document operational steps: inspect Profile capacity, dry-run, bounded bulk redelivery and
  verify result/remaining capacity, or explicitly discard with reason/audit. State limits,
  measured values and any unmeasured production conditions.

## Verification

Run the focused T1 compose/E2E after I1 and B1 merge, including all 30 cases above; run relevant
server integration/DB, regression and CI checks without treating skipped DB checks as passing.
Build the release image from source, test non-empty operator recovery concurrently with the
worker, and verify no GHCR/tag/release side effect. Run format/lint/build and
`git diff --check`. Preserve the actual test output, performance environment/results, capacity
report cadence/freshness, alert evidence and known exclusions.

## Related Links

- P1 contract: `intents/emumet/features/post-relay/overview.md` and `acceptance.md` in the host.
- Q1 storage/capacity foundation: Emumet PR #122.
- S1 delivery/operator foundation: https://github.com/ShuttlePub/Emumet/pull/125
- I1 inbox integration prerequisite: https://github.com/ShuttlePub/Emumet/pull/126
- B1 Ory-independent runtime prerequisite: https://github.com/ShuttlePub/Emumet/issues/127
- Approved P1 implementation plan, third edition: thread `thread-rd4012ty`, run
  `run-01m7yc2nagh0z7g2jh14g6qb8x`.
- Final design constraints DC-01–DC-19: thread `thread-rd4012ty`, run
  `run-01m7yd22411cm1n36mybvg0xcv`.

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/post-relay/overview.md` and `acceptance.md`; no
  new intent node.
- ADR candidate: none; apply the approved plan and DC-01–DC-19.
- Diagram candidate: none.
- Docs update: required; update `docs/post-relay-operations.md` with physical-capacity source,
  30-second reporting, 90-second freshness, alerts, triage/recovery and measurement boundaries.
- Closeout writeback expected: yes; record the exact mandatory E2E coverage/results, real
  Kratos/Hydra and source-build results, capacity supplier/freshness, alarm and operator
  concurrency evidence, measured performance and exclusions.

## Guide Reachability (G645)

No new role-facing surface is added; update the established operations documentation.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open the child implementation PR against `main`; it must include `Closes #<this T1 issue
number>`. Prepare support code earlier if useful, but run final acceptance only after I1 #126
and B1 #127 are integrated.

## Additional Required Guidance

- Implement only in `ShuttlePub/Emumet`; do not edit host packet, intent, queue or runs state
  from the child repository.
- Use the latest child `main` as the implementation base and record its full 40-character SHA.
- Do not modify `ory/hydra/hydra.yml`; do not publish a dev image, GHCR artifact, tag or
  release; do not include rotation E2E.
- Keep the mock receiver at the P1 trust boundary. Do not add link-state synchronization or
  P2 generation validation to make E2E pass.
- Do not ask `intent-cli` to launch an AI provider. Use intent-cli for workflow metadata and
  label transitions; do not hand-edit labels.
