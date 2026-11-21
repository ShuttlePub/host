# emumet-post-relay-delivery

## Goal

Implement Emumet's P1 signed post-relay delivery worker and operator recovery surface. Use K1's instance key/cache, L1's lifecycle gate and lock order, and Q1's durable queue ports. Add absolute send deadlines, bounded shared concurrency, receipt/Profile redelivery and explicit discard, sender-only emergency stop, and performance measurements. Keep inbox acceptance disabled; I1 owns activation.

## Why This Slice Exists Now

The approved P1 dependency order is K1 + L1 + Q1 → S1 → I1. Instance signing identity, lifecycle cancellation, and durable queue authorization must exist before the sender can safely deliver. S1 proves automated and operator sends share the same authorization, expiry, concurrency and cancellation rules before I1 begins enqueueing inbox traffic.

## Current Observed State

K1 (`#116`, merged PR #119) provides instance keys and parsed signing-handle caching; L1 (`#117`, merged PR #120) provides common lifecycle gates/lock order; Q1 (`#121`, PR #122 under review) provides durable queue ports. The signed sender, bounded delivery worker, operator redelivery/discard commands, sender-only stop, and S1 performance baseline are not yet delivered by this unit. Current inspected Emumet baseline in the approved plan was `1259c731af496bb09ae11286a9b869b132a88f4d`; implementation must use and record the actual current `main` SHA after dependencies are present.

## Accepted Baseline You May Assume

- The canonical contract is host `intents/shuttlepub/contracts/emumet-post-relay/`, v1 revision 3; Emumet's contract files are a pinned snapshot, not an independent source.
- The approved plan is its third edition, §3.2, §5.2, §5.4, §6.2-6.3, §6.6, §7, §8 S1, §9, §10.3 and §11.1. Apply DC-01/03/04/05/06/10/11/12/16/18/19.
- K1 is issue #116 / merged PR #119; L1 is issue #117 / merged PR #120; Q1 is issue #121 / PR #122 under review. Use their merged interfaces; do not begin implementation until required dependencies are available on main.
- Use additive migration timestamp `20261122000400`; do not renumber or modify earlier migrations.
- Initial limits and timeouts are targets, not measured facts. Measure at S1 start and report unmet targets to the lead for a decision before I1 activation.
- Do not modify `ory/hydra/hydra.yml`.

## Target Repo / Path / Part

Repository: `ShuttlePub/Emumet`

- Target paths: `kernel/, application/, driver/, server/, migrations/`

Target part: P1 signed delivery worker, shared bounded concurrency, K1 handle-cache use, durable send authorization/deadlines, operator recovery subcommands, sender-only emergency-stop configuration, migration `20261122000400`, performance measurement, and operational documentation.

## In Scope

- Implement the worker and safe HTTP sender using K1/Q1/L1 ports and lock ordering.
- Persist send authorization with attempt, lease/fencing token, link/generation, database authorized time, absolute deadline, and shared concurrency lease. Commit is the send-start boundary.
- Sign unchanged envelope bytes with the instance key; refresh only outer Date/signature, reuse parsed cached handle, avoid per-delivery KDF.
- Implement contract response classifications, retry/backoff/Retry-After, fixed 72-hour deadline, SSRF/DNS protections, and fair bounded global/per-origin concurrency.
- Add release-server operator dry-run/inspection, receipt/Profile redelivery, and separate explicit receipt/Profile discard with bounded 30-day body-free audit.
- Add schema-version-safe operator startup without migration, distinct ID worker identity, and no Ory/listener/S3 initialization.
- Add a sender-only disable switch while reception remains active; document emergency procedures and quota consequences.
- Run and record S1's baseline/throughput tests and write measured results to the specified operational/intent docs at closeout.

## Out Of Scope

- Enabling inbox reception or parsing/transaction integration (I1).
- ShuttlePub production receiver, P2 link-state validation, K2 rotation/revocation, and contract changes.
- Changing existing Profile-delivery tables or retry policy; Ory/Hydra changes; unrelated features.
- Automatic deletion of accepted bodies to relieve capacity. Discard is an explicit, audited recovery-abandonment operation only.

## Standalone Child Issue Contract

Implement P1's Emumet post-relay delivery worker and operator recovery against canonical contract v1 revision 3 and DC-01/03/04/05/06/10/11/12/16/18/19. Use K1's instance identity/cache, L1's lifecycle gate/lock order, and Q1's durable queue ports. The committed send authorization is the start boundary and fixes an absolute 10-second deadline bounded by the original 72-hour receive deadline or 30-day quarantine expiry; HTTP must hold no DB connection/lock. Preserve envelope/receipt/destination, retry classifications and SSRF protections. Provide bounded shared worker concurrency; release-image receipt/Profile redelivery and separate explicit discard; schema-compatible, migration-free operator startup with a distinct worker identity; and a sender-only stop that leaves reception running with its quota impact documented. At S1 start, measure serial and parallel delivery for ~64 KiB and ~1.34 MiB envelopes. Report missed targets to the lead and obtain a decision before I1 activation. No inbox activation, P2/K2, ShuttlePub receiver, or unrelated Profile-delivery changes.

## Acceptance Criteria

- [ ] S1 begins with a recorded real-HTTP local-mock baseline comparing serial one-worker and bounded parallel for ~64 KiB and ~1.34 MiB envelopes. Record hardware, release build, DB placement, TLS, throughput, CPU/RSS, KDF/signature time, DB/connection/lock wait, HTTP/queue wait, and unlink/deactivation/projector time. Under the plan's 4-vCPU/8-GiB release-build local-receiver conditions, targets are ≥100 deliveries/s for 64 KiB, ≥20/s for maximum-body envelopes, a healthy origin sustaining ≥80% of its solo rate while another origin times out, ≥10 minutes of stable RSS/connections/live rows, no delivery-proportional KDF, and unlink during slow HTTP completing without waiting for the peer. These are targets, not measured facts or unconditional SLOs. Missed targets are reported to the lead and decided before I1 activation.
- [ ] Send authorization is committed through Q1's port and is the send-start boundary. Store attempt, lease/fencing token, link/generation, DB `authorized_at`, absolute `send_deadline`, shared concurrency lease. Unknown commit outcome means no send.
- [ ] Automatic deadline is `min(authorized_at + 10 seconds, received_at + 72 hours)`; operator deadline is `min(authorized_at + 10 seconds, quarantine_expires_at)`. DNS/connect/TLS/send/response and post-authorization wait consume one fixed deadline; no renewal after delay, restart or lease recovery; late-scheduled tasks do not send.
- [ ] HTTP holds no transaction, DB connection, row lock, or advisory lock. L1 gate/lock ordering is obeyed for all authorization/result/operator paths. Unlink committed first prevents new authorization; prior authorization may proceed only to deadline. Slow HTTP does not delay unlink, deactivation, or projector. Stale results cannot restore deleted body or alter terminal/capacity state.
- [ ] Envelope bytes remain identical. Only outer Date and Cavage signature are refreshed per attempt with K1's instance key/parsed cached handle. No remote signature or Profile key is reused; KDF is not performed per delivery.
- [ ] Retry classes match contract: 2xx success; 401/408/429/5xx and transient network/DNS/timeout/signing failures retry; other 4xx (including 403/409), 3xx, invalid URL and SSRF failures are permanent. Redirects are never followed. Backoff is `min(30s × 2^(failure_count−1), 1h)` with 50-100% equal jitter; valid Retry-After is a bounded lower bound; received_at+72h never moves.
- [ ] Shared concurrency starts at target 16 globally and 4 per origin, including human sends and multiple processes. Tests show a slow origin does not starve healthy origins and origin/Profile fairness and near-deadline jobs are preserved. HTTP-in-flight DB connections are zero.
- [ ] Release server offers dry-run/inspection, receipt and bounded Profile redelivery, and distinct receipt/Profile explicit discard. Redelivery sends each selected envelope at most once per action, freezes batch selection boundary, rechecks owner/link/generation/allowlist/expiry, preserves envelope/receipt/destination and original expiry, shares worker gate/lease/fencing/concurrency, deletes body on success, and returns failure to the same expiry. No rehome/body edit/relink. Discard requires dry-run, target confirmation, operator and reason; it is never automatic for quota relief and refuses without audit capacity. Operator/batch action is recorded body-free for 30 days.
- [ ] Operator commands do not run migrations and refuse an incompatible schema version. They require a `WORKER_ID` distinct from the live server or an equally safe ID scheme, and do not initialize Ory, normal listener, S3 or unrelated services. Existing no-argument server startup and `cargo run -p server` remain valid.
- [ ] A setting can stop only post-relay sending while inbox reception continues. Operations docs distinguish sender-only stop, full server stop, and egress block; warn that authorized/forwarded bytes cannot be recalled and continued reception consumes quota.
- [ ] HTTPS-only, no redirect, DNS/address validation and connection pinning, internal-address rejection even when allowlisted, test-only exceptions, and deadline-bounded allowlist policy holds are verified.
- [ ] Successful/cancelled jobs and attempts leave no per-delivery terminal rows. Permanent failure retains unchanged envelope plus one body-free summary for 30 days from observed failing-attempt time; 72-hour timeout's terminal time is `received_at + 72 hours`, and retention ends 30 days from that time. Delayed purge and manual recovery never extend expiry; human send never crosses quarantine expiry.
- [ ] Real-DB P0-P4 and unlink stop-point races cover all three L1 paths and automatic/operator sends, plus stop/restart, lease reclaim and competing operator actions. Prove no post-unlink authorization, no expired send, no HTTP wait in lifecycle, and no stale-body resurrection.
- [ ] Release-image verification proves command availability without source/Cargo, schema refusal, distinct worker identity, no migration side effect, and no Ory/listener/S3 startup. Sender-only stop preserves reception and quota observability.
- [ ] No inbox activation, ShuttlePub receiver, P2/K2, Ory/Hydra change, existing Profile-delivery policy change, or contract revision is included.

## Verification

Run real-PostgreSQL tests with independent connections/processes for P0-P4 send authorization races, all three L1 unlink paths, automatic and human delivery, leases/fencing/stale results, shared concurrency and fairness. Use a local real HTTP receiver to measure the two envelope sizes in serial and bounded modes; run at least 10 minutes for RSS, connection and live-row stability. Exercise retry classifications, Retry-After, absolute deadlines, 72-hour/30-day injected-time boundaries, redirects, SSRF/DNS rebinding, allowlist hold, cancellation during hanging HTTP, and human actions competing with workers. Verify no HTTP-in-flight DB connection/lock, no per-delivery success rows, no sensitive/identifier leakage, and original quarantine expiry preservation. Run the release image without source/Cargo to verify operator commands, schema mismatch, distinct worker identity, no migration/Ory/listener/S3 side effect, and sender-only disable with continued reception. Run relevant format/lint/build/test checks and `git diff --check`; required DB tests are not passing when skipped.

## Related Links

- C0 contract issue: https://github.com/ShuttlePub/Emumet/issues/114
- K1 instance identity issue #116 / merged PR #119: https://github.com/ShuttlePub/Emumet/pull/119
- L1 home-link issue #117 / merged PR #120: https://github.com/ShuttlePub/Emumet/pull/120
- Q1 storage issue #121 / PR #122 under review: https://github.com/ShuttlePub/Emumet/pull/122
- Canonical contract v1 revision 3: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/contracts/emumet-post-relay/v1.md
- Approved P1 decisions D51-D67: https://github.com/ShuttlePub/host/blob/main/intents/shuttlepub/decisions/2026-11-21-emumet-p1-open-items.md
- Existing post-relay overview: https://github.com/ShuttlePub/host/blob/main/intents/emumet/features/post-relay/overview.md
- Existing post-relay decisions/acceptance: https://github.com/ShuttlePub/host/tree/main/intents/emumet/features/post-relay
- ADR 0003 quarantine exception: https://github.com/ShuttlePub/host/blob/main/intents/emumet/decisions/0003-delegated-signing.md

## Knowledge Maintenance

- Intent placement: `intents/emumet/features/post-relay/`; no new node.
- ADR/diagram: no new ADR or diagram expected; 30-day quarantine exception is already in ADR 0003.
- Docs: update `docs/post-relay-operations.md` with recovery commands, expiry, schema/identity safeguards, sender-only emergency stop vs full-stop/egress, quota impact and measurements.
- Closeout write-back is required: record measurements, final bounded worker settings and operational decisions in the existing post-relay decisions/acceptance.

## Guide Reachability

Operations staff discover the recovery and emergency-stop surfaces through `server --help` and the relevant operator subcommand's `--help`; operational documentation covers expiry and quota behavior.

## Base Branch Policy

Policy: `direct-main`
Expected PR base branch: `main`

Open the child PR against `main` after K1, L1, and Q1 dependencies are present on Emumet main.

## Additional Required Guidance

- The implementation PR body must include `Closes #<this S1 issue number>` (G311); replace the placeholder with the published issue number.
- Prefer intent-cli-backed workflow mutations. Do not mutate parent host queue-state, runs logs, packet files, intent tree, or workflow labels from the child repository.
- Keep the implementation isolated in the Emumet repository/worktree. Do not read host-local rules or copied workflow prompts; use installed intent-cli guides when required.
- Do not launch AI providers through intent-cli.
