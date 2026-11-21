# emumet-post-relay-delivery Implementation Packet

## Goal

Implement Emumet's P1 signed post-relay delivery worker and production-usable operator recovery path. Use Q1's durable ports and L1's lifecycle gate/lock order; use K1's instance key and parsed signing-handle cache. Add bounded concurrency, absolute send deadlines, receipt/Profile redelivery and explicit discard, emergency stop controls, and measured performance. Do not enable inbox reception (I1) in this slice.

## Why this unit is next

The approved P1 order places S1 after K1, L1 and Q1 and before I1 activation. K1 provides instance identity and key-handle caching; L1 provides the common lifecycle gate/lock order and unlink paths; Q1 provides the durable claim/authorize/record/finish ports. S1 must make the sender and operator recovery work together under the same authorization, expiry and concurrency rules before the inbox starts creating delivery work in I1.

## Accepted dependencies and baseline

- K1 `emumet-instance-identity`, issue #116, merged PR #119: instance key and parsed signing-handle cache.
- L1 `emumet-home-link`, issue #117, merged PR #120: link lifecycle, common gate and lock-order checks.
- Q1 `emumet-post-relay-storage`, issue #121, PR #122 under review: durable queue ports including claim/authorize/record/finish. Start implementation only after required changes are merged/present on main.
- Use the latest Emumet main at implementation start and record its full SHA; approved plan inspection baseline `1259c731af496bb09ae11286a9b869b132a88f4d` is historical only.
- Canonical contract is `intents/shuttlepub/contracts/emumet-post-relay/`, v1 revision 3. The approved plan is its third edition; S1 uses §3.2, §5.2, §5.4, §6.2-6.3, §6.6, §7, §8 S1, §9, §10.3 and §11.1.
- Add only migration timestamp `20261122000400`; never renumber or edit earlier migrations.
- Apply DC-01/03/04/05/06/10/11/12/16/18/19. Do not revise the contract as part of this unit.

## Delivery and lifecycle invariants

### Authorization and cancellation

- Claim, key lookup, or signature preparation is not send start. Persist the final send authorization in Q1's transaction; its commit is the start boundary.
- Store attempt, lease/fencing token, link ID/generation, database `authorized_at`, fixed `send_deadline`, and shared concurrency lease. If commit outcome is unknown, do not send.
- Automatic deadline: `min(authorized_at + 10s, received_at + 72h)`. Operator redelivery: `min(authorized_at + 10s, quarantine_expires_at)`. Commit work consumes the 10-second window; never renew it after commit, delay, stop/restart, or lease recovery.
- Include local wait, DNS, connection, TLS, request, and response in the absolute deadline. A task first scheduled after deadline must not send.
- HTTP runs with no transaction, DB connection, row lock or advisory lock. Link unlink/deactivation, Account projector and Profile lifecycle work cannot wait for HTTP.
- Follow L1's common lock order and gate in all send authorization, result, expiry and operator paths. Authorization committed before unlink may proceed only until its deadline; unlink committed first prevents a new authorization. Stale workers cannot write terminal results or restore bodies/capacity.

### HTTP and cryptography

- Send the stored immutable envelope bytes. Refresh only external Date and Cavage signature per attempt, with K1's Emumet instance key and cached parsed handle. Do not use Profile keys, remote Activity signatures, or per-delivery KDF.
- Cavage profile: RSA-2048/SHA-256 over `(request-target) host date digest`, SHA-256 digest over actual envelope bytes, HTTPS, no redirects, Date tolerance ±5 minutes.
- Classify outcomes per contract: 2xx success; 401/408/429/5xx and transient network/DNS/timeout/signing issues retry; other 4xx, 3xx, invalid URL and SSRF failure permanent. Never follow redirect.
- Retry base is `min(30 seconds × 2^(failure_count−1), 1 hour)` with equal jitter from 50% through 100%. Valid Retry-After is a lower bound constrained by one hour and remaining absolute expiry; invalid values use normal backoff. The 72-hour received_at deadline never extends.
- Enforce HTTPS, redirect refusal, DNS resolution validation and address pinning, and internal-address rejection even when allowlisted. Test bypass only in cfg(test)/test-mode. Allowlist removal creates a deadline-bounded policy hold; it is not immediate revocation.

### Worker, fairness and performance

- Initial bounded limits: global 16 and per-origin 4, shared across processes and operator sends. Protect healthy origins from an unresponsive one; include origin/Profile fairness and deadline starvation checks.
- At S1 start, measure serial one-worker against bounded concurrency using a local real HTTP receiver for ~64 KiB and ~1.34 MiB envelopes. Record hardware, release mode, DB placement, TLS, throughput, CPU, RSS, KDF/signing time, DB and lock/connection wait, HTTP/queue wait, and unlink/deactivation/projector latency.
- §7.3 targets (not measured facts): at 4 vCPU/8 GiB and release build, ≥100/s for 64 KiB; ≥20/s for max-body envelope; when one origin times out, healthy origin sustains ≥80% of its solo rate; stable RSS/connection/live rows over ≥10 minutes; KDF does not scale with deliveries; unlink during a slow HTTP request does not wait for peer response.
- If targets are missed, notify the lead, record evidence and request a decision before I1 is enabled. Do not describe targets as production guarantees or SLOs. Record backlog catch-up conditions as `backlog / (measured delivery capacity − continuing arrival rate)` where meaningful.

## Operator recovery and emergency stop

- Add release `server` subcommands, not HTTP admin APIs: inspect/dry-run; one-time redelivery by receipt; bounded Profile redelivery; explicit discard by receipt; explicit bounded Profile discard.
- Bound batch membership at selection time by Profile/link and selected upper boundary. Do not chase new arrivals indefinitely.
- Redelivery must reuse the same envelope bytes, receipt and destination, update only outer Date/signature, recheck owner/link/generation/allowlist/expiry, and share worker authorization, lease/fencing, gate and concurrency resources. Each selected envelope is attempted at most once per operator action. Success deletes body; failure returns it with its original expiry. Never extend automatic or quarantine expiry, rehome, edit, or revive an unlinked link.
- Discard is a distinct, explicit recovery-abandonment operation; require dry-run, exact target, confirmation, operator and reason. Never discard early automatically for capacity relief. If an audit reservation cannot be secured, refuse the discard. Store bounded body-free operation/batch audit for 30 days.
- Operator commands must not run migrations and must reject schema-version mismatch. Require a WORKER_ID distinct from a live server or an equally safe separate ID generation mechanism. Avoid Ory, normal HTTP listener, S3 and unrelated initialization; keep normal no-argument server and `cargo run -p server` behavior.
- Provide a configuration switch to stop only post-relay send workers while keeping inbox reception active. Document it as an emergency stop, distinguish process/full-server shutdown and egress blocking, explain that already authorized or delivered bytes cannot be recalled, and warn that continued reception consumes quota while sends are stopped.

## Retention and terminal states

- Successful and cancelled deliveries delete job/attempt rows and leave no per-delivery terminal record; retain only fixed counters/metrics.
- Permanent failure and 72-hour timeout move the unchanged envelope to quarantine and keep one body-free summary for 30 days from logical terminal time. For timeout, logical terminal time is `received_at + 72 hours`; for permanent failure, it is the time of the attempt at which the failure is observed. Delayed purge does not extend this expiry.
- Operator redelivery is forbidden at or beyond `quarantine_expires_at`; failure returns to the same original expiry. A successful human recovery does not extend the failure audit's expiry.
- Logs, audit and metric labels exclude envelope/body, secret key, Cookie, authorization headers, receiver response body, Activity/receipt/actor identifiers.

## Out of scope

Inbox parsing/activation (I1), ShuttlePub production receiver, P2 state checks, K2 rotation/revocation operations, Ory/Hydra configuration, existing Profile-delivery policy changes, and canonical-contract revision. Do not edit `ory/hydra/hydra.yml`.

## Verification

- Real PostgreSQL tests with separate connections/processes for send authorization and unlink ordering at P0–P4 plus unlink-side stop point, across all three L1 unlink paths and both automatic/operator sends.
- Prove pre-authorization unlink prevents send; pre-unlink authorization only proceeds within its immutable deadline; expired delayed task sends nothing; blocked HTTP never holds a DB connection/lock and never delays unlink; stale/lease-recovered results cannot restore deleted body or terminal/capacity state.
- Exercise 401 retry, 403/409 permanent failure, 3xx refusal, SSRF/DNS rebinding refusal, Retry-After limits, lease reclaim, worker stop/restart, and competing operator actions.
- Verify immutable envelope bytes/receipt/destination and only outer Date/signature refresh; KDF is independent of delivery count; bounded pool/fairness and zero HTTP-in-flight DB connections.
- Run performance baseline and ≥10-minute stability test with environment and actual results recorded. If target missed, obtain lead decision before I1 activation.
- Test release image commands without source/Cargo, schema mismatch refusal, distinct worker identity, no migration side effect/no Ory/listener/S3 initialization, sender-only stop with continued reception, and quota monitoring.
- Use injected time for 72-hour and 30-day boundaries and purge delay. Verify retention and body-free observability.
- Run relevant format/lint/build/test checks and `git diff --check`; required database tests are not passing when skipped.

## Knowledge maintenance

- Existing intent placement: `intents/emumet/features/post-relay/`; no new node.
- No new ADR or diagram expected; 30-day quarantine exception already exists in ADR 0003.
- Update `docs/post-relay-operations.md` with operator recovery, sender-only emergency stop, full-stop/egress distinction, quota behavior and monitoring.
- Closeout write-back is required: record actual measurements, final concurrency/deadline behavior and operational decisions in feature decisions/acceptance.
- Guide reachability: operators discover commands through `server --help` and the relevant operator subcommand `--help`.
